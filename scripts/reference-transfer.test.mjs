import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { stableJSON, objectKey } from "./reference-corpus.mjs";
import {
  createTransfer,
  directoryStore,
  PART_BYTES,
  TransferError,
  officialSource,
} from "./reference-transfer.mjs";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ID = "1".repeat(32);
const hash = (algorithm, data) =>
  createHash(algorithm).update(data).digest("hex");
// Deliberately synthetic approved metadata: these are not original Minecraft bytes.
function fixture(...texts) {
  const data = new Map(
    texts.map((s) => {
      const raw = Buffer.from(s);
      return [hash("sha1", raw), raw];
    }),
  );
  const body = {
    schema: 1,
    target: "26.3",
    scope: "all-declared-version-downloads",
    files: [...data].map(([sha1, raw]) => ({
      sha1,
      bytes: raw.length,
      key: objectKey(sha1),
      sources: [],
      references: [],
    })),
    summary: {
      uniqueObjects: data.size,
      totalBytes: [...data.values()].reduce((n, b) => n + b.length, 0),
    },
    pending: ["private-persistent-transfer", "independent-backup-and-restore"],
    fullCorpusReady: false,
  };
  const plan = { ...body, planSHA256: hash("sha256", stableJSON(body)) };
  const first = [...data.keys()][0];
  const calls = [];
  const source = async function* (range) {
    const { objectSHA1, offset, length, totalBytes, signal } = range;
    calls.push({ objectSHA1, offset, length, totalBytes });
    const raw = data.get(objectSHA1);
    assert.equal(totalBytes, raw.length);
    for (let i = offset; i < offset + length; i += 2) {
      signal?.throwIfAborted();
      yield raw.subarray(i, Math.min(i + 2, offset + length));
    }
  };
  return {
    plan,
    data,
    first,
    calls,
    source,
    session: (options = {}) =>
      createTransfer(plan, { id: ID, partBytes: 4, ...options }),
  };
}
function memoryStore() {
  const records = new Map(),
    calls = [];
  return {
    records,
    calls,
    async read(key, limit) {
      calls.push(["read", key, limit]);
      return records.has(key) ? Buffer.from(records.get(key)) : null;
    },
    async create(key, bytes) {
      calls.push(["create", key]);
      if (records.has(key)) return false;
      records.set(key, Buffer.from(bytes));
      return true;
    },
  };
}
const completion = (store) =>
  [...store.records.keys()].filter((k) => k.endsWith("/complete.json"));
const parts = (store) =>
  [...store.records.keys()].filter((k) => k.endsWith(".bin"));
async function privateDir(t) {
  const parent = path.join(ROOT, ".cache");
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, "transfer-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function fileList(dir, base = "") {
  const files = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(base, e.name);
    if (e.isDirectory())
      files.push(...(await fileList(path.join(dir, e.name), p)));
    else files.push(p);
  }
  return files.sort();
}

test("part size is below existing Storage limit and sessions reject invalid parameters/plans", () => {
  assert.ok(PART_BYTES + 1032 < 10 * 1024 * 1024);
  const f = fixture("synthetic reference");
  for (const id of ["../unsafe", "a".repeat(31), "A".repeat(32), null, [], {}])
    assert.throws(() => f.session({ id }));
  for (const partBytes of [0, -1, 1.5, PART_BYTES + 1, NaN])
    assert.throws(() => f.session({ partBytes }));
  const p = structuredClone(f.plan);
  p.files[0].bytes++;
  assert.throws(() => createTransfer(p));
  const large = structuredClone(f.plan);
  large.files[0].bytes = 1024 ** 3;
  large.summary.totalBytes = 1024 ** 3;
  const { planSHA256: _, ...body } = large;
  large.planSHA256 = hash("sha256", stableJSON(body));
  const session = createTransfer(large, { id: ID, partBytes: 1 });
  assert.throws(() => session.describe(f.first), /too-many-parts/);
});
test("transfers exact ranges, verifies whole SHA-1/SHA-256 and only then publishes completion", async () => {
  const f = fixture("synthetic reference"),
    store = memoryStore();
  const result = await f
    .session()
    .transfer(f.first, { store, source: f.source });
  assert.equal(result.fetchedParts, 5);
  assert.equal(result.resumedParts, 0);
  assert.deepEqual(
    f.calls.map((r) => [r.offset, r.length]),
    [
      [0, 4],
      [4, 4],
      [8, 4],
      [12, 4],
      [16, 4 - 1],
    ],
  );
  assert.equal(result.receipt.objectBytes, f.data.get(f.first).length);
  assert.equal(result.receipt.sha256, hash("sha256", f.data.get(f.first)));
  assert.equal(result.receipt.parts.length, 5);
  assert.equal(completion(store).length, 1);
  assert.equal(
    store.calls.filter((c) => c[0] === "create").at(-1)[1],
    completion(store)[0],
  );
  assert.equal(result.fullCorpusReady, false);
  assert.equal(result.independentBackupVerified, false);
  assert.equal(result.originalObjectExecuted, false);
});
test("interruption leaves complete parts, and a fresh coordinator fetches only missing ranges", async () => {
  const f = fixture("synthetic resumable payload"),
    store = memoryStore();
  const failing = async (range) => {
    if (range.offset === 8) throw new Error("offline");
    return f.source(range);
  };
  await assert.rejects(
    f.session().transfer(f.first, { store, source: failing }),
    /offline/,
  );
  assert.equal(parts(store).length, 2);
  assert.equal(completion(store).length, 0);
  f.calls.length = 0;
  const result = await f
    .session()
    .transfer(f.first, { store, source: f.source });
  assert.equal(result.resumedParts, 2);
  assert.ok(f.calls.every((r) => r.offset >= 8));
  assert.equal(completion(store).length, 1);
});
test("ACK lost after committed part is safely resumed without fetching that part again", async () => {
  const f = fixture("synthetic ack loss"),
    store = memoryStore(),
    create = store.create.bind(store);
  let fail = true;
  store.create = async (key, bytes) => {
    const r = await create(key, bytes);
    if (fail) {
      fail = false;
      throw new Error("lost ack");
    }
    return r;
  };
  await assert.rejects(
    f.session().transfer(f.first, { store, source: f.source }),
    /lost ack/,
  );
  assert.equal(completion(store).length, 0);
  f.calls.length = 0;
  const r = await f.session().transfer(f.first, { store, source: f.source });
  assert.equal(r.resumedParts, 1);
  assert.equal(f.calls[0].offset, 4);
});
test("ACK alone is not accepted when store fails to persist or returns wrong bytes", async () => {
  for (const mode of ["drop", "wrong", "bad-ack"]) {
    const f = fixture("synthetic store failure"),
      store = memoryStore();
    store.create = async (key, bytes) => {
      if (mode === "wrong") store.records.set(key, Buffer.from("bad"));
      return mode === "bad-ack" ? "success" : true;
    };
    await assert.rejects(
      f.session().transfer(f.first, { store, source: f.source }),
      TransferError,
    );
    assert.equal(completion(store).length, 0);
  }
});
test("concurrent identical transfers are idempotent and immutable conflicts do not overwrite", async () => {
  const f = fixture("synthetic concurrency"),
    store = memoryStore();
  const [a, b] = await Promise.all(
    [1, 2].map(() =>
      f.session().transfer(f.first, { store, source: f.source }),
    ),
  );
  assert.deepEqual(a.receipt, b.receipt);
  assert.equal(completion(store).length, 1);
  assert.equal(parts(store).length, a.receipt.partCount);
  const before = new Map(
    [...store.records].map(([k, v]) => [k, Buffer.from(v)]),
  );
  await f.session().transfer(f.first, {
    store,
    source: () => {
      throw new Error("must not fetch");
    },
  });
  for (const [k, v] of before) assert.deepEqual(store.records.get(k), v);
});
test("verify re-reads persisted parts and does not trust a completion marker", async () => {
  const f = fixture("synthetic verified data"),
    store = memoryStore();
  const a = await f.session().transfer(f.first, { store, source: f.source });
  f.calls.length = 0;
  const writes = store.calls.filter((c) => c[0] === "create").length;
  const b = await f.session().verify(f.first, { store });
  assert.deepEqual(a.receipt, b.receipt);
  assert.equal(b.fetchedParts, 0);
  assert.equal(f.calls.length, 0);
  assert.equal(store.calls.filter((c) => c[0] === "create").length, writes);
  store.records.get(parts(store)[0])[0] ^= 1;
  await assert.rejects(f.session().verify(f.first, { store }), TransferError);
});
test("same-size corruption, truncation, oversized records and invalid header are rejected untouched", async () => {
  for (const mode of ["payload", "truncate", "oversize", "header"]) {
    const f = fixture("synthetic corruption"),
      store = memoryStore();
    await f.session().transfer(f.first, { store, source: f.source });
    const key = parts(store)[0];
    let raw = Buffer.from(store.records.get(key));
    if (mode === "payload") raw[raw.length - 1] ^= 1;
    if (mode === "truncate") raw = raw.subarray(0, -1);
    if (mode === "oversize") raw = Buffer.alloc(4 + 1033);
    if (mode === "header") raw.writeUInt32BE(1025, 4);
    store.records.set(key, raw);
    await assert.rejects(f.session().verify(f.first, { store }), TransferError);
    assert.deepEqual(store.records.get(key), raw);
  }
});
test("parts are bound to plan, transfer id, object, index and part size", async () => {
  const f = fixture("abcdefgh12345678", "ijklmnop87654321"),
    store = memoryStore();
  await f.session().transfer(f.first, { store, source: f.source });
  const keys = parts(store),
    original = Buffer.from(store.records.get(keys[0]));
  store.records.set(keys[1], original);
  await assert.rejects(f.session().verify(f.first, { store }), /binding/);
  for (const options of [{ id: "2".repeat(32) }, { partBytes: 8 }]) {
    const target = memoryStore();
    const session = f.session(options);
    // Discover canonical target names, then inject a differently bound record.
    await session.transfer(f.first, { store: target, source: f.source });
    target.records.set(parts(target)[0], original);
    await assert.rejects(
      session.verify(f.first, { store: target }),
      TransferError,
    );
  }
  const second = [...f.data.keys()][1];
  await f.session().transfer(second, { store, source: f.source });
  const otherKey = parts(store).find((k) => k.includes(second));
  store.records.set(otherKey, original);
  await assert.rejects(f.session().verify(second, { store }), /binding/);
  const changed = fixture("abcdefgh12345678", "additional object");
  const target = memoryStore();
  await changed
    .session()
    .transfer(changed.first, { store: target, source: changed.source });
  target.records.set(parts(target)[0], original);
  await assert.rejects(
    changed.session().verify(changed.first, { store: target }),
    /binding/,
  );
});
test("wrong full-file hash never produces completion even when each part has a valid checksum", async () => {
  const f = fixture("abcdefgh"),
    store = memoryStore();
  const wrong = async function* ({ length }) {
    yield Buffer.alloc(length, 0xff);
  };
  await assert.rejects(
    f.session().transfer(f.first, { store, source: wrong }),
    /whole-object-sha1/,
  );
  assert.equal(parts(store).length, 2);
  assert.equal(completion(store).length, 0);
  const previous = new Map(store.records);
  await assert.rejects(
    f.session().transfer(f.first, { store, source: f.source }),
    /whole-object-sha1/,
  );
  for (const [k, v] of previous) assert.deepEqual(store.records.get(k), v);
  // Explicit new attempt; no deletion/repair of the failed archive's objects.
  await f
    .session({ id: "2".repeat(32) })
    .transfer(f.first, { store, source: f.source });
  assert.equal(completion(store).length, 1);
  for (const [k, v] of previous) assert.deepEqual(store.records.get(k), v);
});
test("missing part behind a completed receipt is an integrity failure, not silent re-download", async () => {
  const f = fixture("synthetic missing published part"),
    store = memoryStore();
  await f.session().transfer(f.first, { store, source: f.source });
  store.records.delete(parts(store)[0]);
  f.calls.length = 0;
  await assert.rejects(
    f.session().transfer(f.first, { store, source: f.source }),
    /published-part-missing/,
  );
  assert.equal(f.calls.length, 0);
});
test("forged completion and completion-without-parts do not bypass verification", async () => {
  const f = fixture("synthetic receipt"),
    store = memoryStore();
  await assert.rejects(
    f.session().verify(f.first, { store }),
    /receipt-missing/,
  );
  await f.session().transfer(f.first, { store, source: f.source });
  const key = completion(store)[0],
    raw = JSON.parse(store.records.get(key));
  raw.sha256 = "a".repeat(64);
  store.records.set(key, Buffer.from(stableJSON(raw)));
  await assert.rejects(
    f.session().verify(f.first, { store }),
    /receipt-mismatch/,
  );
  for (const k of parts(store)) store.records.delete(k);
  await assert.rejects(
    f.session().verify(f.first, { store }),
    /published-part-missing/,
  );
});
test("source truncation/overflow/nonbinary chunks do not commit a partial part", async () => {
  const sources = [
    async function* () {
      yield Buffer.from("a");
    },
    async function* () {
      yield Buffer.alloc(5);
    },
    async function* () {
      yield "not binary";
    },
    async () => Buffer.from("abcd"),
  ];
  for (const source of sources) {
    const f = fixture("abcd"),
      store = memoryStore();
    await assert.rejects(
      f.session().transfer(f.first, { store, source }),
      TransferError,
    );
    assert.equal(store.records.size, 0);
  }
});
test("source iterator is closed on overflow and aborted transfers can resume safely", async () => {
  const f = fixture("abcdefgh"),
    store = memoryStore();
  let closed = false;
  const overflow = async function* () {
    try {
      yield Buffer.alloc(8);
    } finally {
      closed = true;
    }
  };
  await assert.rejects(
    f.session().transfer(f.first, { store, source: overflow }),
  );
  assert.equal(closed, true);
  const c = new AbortController(),
    create = store.create.bind(store);
  store.create = async (key, bytes) => {
    const r = await create(key, bytes);
    c.abort();
    return r;
  };
  await assert.rejects(
    f
      .session()
      .transfer(f.first, { store, source: f.source, signal: c.signal }),
    { name: "AbortError" },
  );
  assert.equal(parts(store).length, 1);
  assert.equal(completion(store).length, 0);
  store.create = create;
  const r = await f.session().transfer(f.first, { store, source: f.source });
  assert.equal(r.resumedParts, 1);
});
test("already-aborted request does no I/O and objects outside plan are rejected before I/O", async () => {
  const f = fixture("data"),
    store = memoryStore(),
    c = new AbortController();
  c.abort();
  await assert.rejects(
    f
      .session()
      .transfer(f.first, { store, source: f.source, signal: c.signal }),
  );
  assert.equal(store.calls.length, 0);
  for (const key of ["../file", "a".repeat(40), null, []])
    await assert.rejects(
      f.session().transfer(key, { store, source: f.source }),
      /approved-plan/,
    );
  assert.equal(store.calls.length, 0);
});
test("empty objects are verified without calling the source", async () => {
  const f = fixture(""),
    store = memoryStore();
  const r = await f.session().transfer(f.first, {
    store,
    source: () => {
      throw new Error("unexpected source");
    },
  });
  assert.equal(r.receipt.partCount, 0);
  assert.equal(r.receipt.objectBytes, 0);
  assert.equal(parts(store).length, 0);
  assert.equal(completion(store).length, 1);
  assert.deepEqual(
    (await f.session().verify(f.first, { store })).receipt,
    r.receipt,
  );
});
test("coordinator snapshots approved file sizes so later caller mutations cannot change ranges", async () => {
  const f = fixture("abcdefgh"),
    store = memoryStore(),
    session = f.session();
  f.plan.files[0].bytes = 999;
  const r = await session.transfer(f.first, { store, source: f.source });
  assert.equal(r.receipt.objectBytes, 8);
  assert.equal(f.calls.length, 2);
});
test("a fresh disk adapter and separate Node process can verify and resume persisted parts", async (t) => {
  const root = await privateDir(t),
    f = fixture("synthetic persistent parts");
  const source = async (range) => {
    if (range.offset === 8) throw new Error("interrupted");
    return f.source(range);
  };
  await assert.rejects(
    f
      .session()
      .transfer(f.first, { store: await directoryStore(root), source }),
    /interrupted/,
  );
  const before = await fileList(root);
  assert.equal(before.length, 2);
  const r = await f
    .session()
    .transfer(f.first, { store: await directoryStore(root), source: f.source });
  assert.equal(r.resumedParts, 2);
  const script = `import {createTransfer,directoryStore} from './scripts/reference-transfer.mjs';
    const s=createTransfer(${JSON.stringify(f.plan)},{id:'${ID}',partBytes:4});
    const r=await s.verify('${f.first}',{store:await directoryStore(${JSON.stringify(root)})});
    console.log(JSON.stringify(r));`;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout).receipt, r.receipt);
  assert.ok((await fileList(root)).every((p) => !p.endsWith(".work")));
});
test("disk writes are atomic/no-overwrite, including concurrent creation", async (t) => {
  const root = await privateDir(t),
    f = fixture("synthetic parallel disk data");
  const store = await directoryStore(root);
  const results = await Promise.all(
    [1, 2].map(() =>
      f.session().transfer(f.first, { store, source: f.source }),
    ),
  );
  assert.deepEqual(results[0].receipt, results[1].receipt);
  const files = await fileList(root),
    file = files.find((p) => p.endsWith(".bin"));
  const before = await fs.readFile(path.join(root, file));
  assert.equal(
    await store.create(file.split(path.sep).join("/"), Buffer.from("wrong")),
    false,
  );
  assert.deepEqual(await fs.readFile(path.join(root, file)), before);
  assert.ok((await fileList(root)).every((p) => !p.endsWith(".work")));
});
test("disk adapter rejects public/outside roots, invalid keys and oversized writes", async (t) => {
  await assert.rejects(
    directoryStore(path.join(ROOT, "public/archive")),
    /ignored-cache/,
  );
  const root = await privateDir(t),
    store = await directoryStore(root);
  for (const key of [
    "../../credentials",
    "archive-parts/v1/nope",
    "/absolute",
    "a\\b",
  ])
    await assert.rejects(store.read(key, 10), /invalid-store-key/);
  const f = fixture("abcd"),
    memory = memoryStore();
  await f.session().transfer(f.first, { store: memory, source: f.source });
  const key = parts(memory)[0];
  await assert.rejects(
    store.create(key, Buffer.alloc(PART_BYTES + 1033)),
    /limit/,
  );
  assert.deepEqual(await fileList(root), []);
});
test("disk adapter rejects symlink directories, symlink files and FIFO without following/blocking", async (t) => {
  const root = await privateDir(t),
    external = await privateDir(t),
    f = fixture("abcdefgh");
  const store = await directoryStore(root),
    memory = memoryStore();
  await f.session().transfer(f.first, { store: memory, source: f.source });
  const key = parts(memory)[0],
    full = path.join(root, key);
  await fs.symlink(external, path.join(root, "archive-parts"), "dir");
  await assert.rejects(
    store.create(key, memory.records.get(key)),
    /unsafe-store-directory/,
  );
  assert.deepEqual(await fileList(external), []);
  await fs.unlink(path.join(root, "archive-parts"));
  await fs.mkdir(path.dirname(full), { recursive: true });
  const target = path.join(external, "external.bin");
  await fs.writeFile(target, memory.records.get(key));
  await fs.symlink(target, full);
  await assert.rejects(
    store.read(key, PART_BYTES + 1032),
    /invalid-store-file/,
  );
  await fs.unlink(full);
  if (process.platform === "linux") {
    assert.equal(spawnSync("mkfifo", [full]).status, 0);
    await assert.rejects(
      store.read(key, PART_BYTES + 1032),
      /invalid-store-file/,
    );
  }
});

test("interruption inside a range never publishes a half part", async () => {
  const f = fixture("abcdefghijkl"),
    store = memoryStore();
  const broken = async function* (range) {
    if (range.offset === 4) {
      yield Buffer.from("ef");
      throw new Error("mid-range disconnect");
    }
    yield* f.source(range);
  };
  await assert.rejects(
    f.session().transfer(f.first, { store, source: broken }),
    /mid-range/,
  );
  assert.equal(parts(store).length, 1);
  assert.equal(completion(store).length, 0);
  const r = await f.session().transfer(f.first, { store, source: f.source });
  assert.equal(r.resumedParts, 1);
});
test("default 4 MiB records transfer a multi-part binary without whole-object concatenation", async () => {
  const f = fixture(Buffer.alloc(9 * 1024 * 1024 + 7, 5)),
    store = memoryStore();
  const raw = f.data.get(f.first),
    source = async function* ({ offset, length }) {
      for (let i = offset; i < offset + length; i += 65536)
        yield raw.subarray(i, Math.min(i + 65536, offset + length));
    };
  const s = createTransfer(f.plan, { id: ID });
  const r = await s.transfer(f.first, { store, source });
  assert.equal(r.receipt.partCount, 3);
  assert.equal(r.receipt.sha256, hash("sha256", raw));
  for (const key of parts(store))
    assert.ok(store.records.get(key).length < 10 * 1024 * 1024);
});
function sourceFixture(text = "abcdefghij") {
  const f = fixture(text);
  for (const file of f.plan.files)
    file.sources = [
      `https://piston-data.mojang.com/v1/objects/${file.sha1}/fixture.bin`,
    ];
  const { planSHA256: _, ...body } = f.plan;
  f.plan.planSHA256 = hash("sha256", stableJSON(body));
  return f;
}
function rangeResponse(raw, offset, length, options = {}) {
  return new Response(raw.subarray(offset, offset + length), {
    status: 206,
    headers: {
      "content-range": `bytes ${offset}-${offset + length - 1}/${raw.length}`,
      "content-length": String(length),
      ...options.headers,
    },
    ...options,
  });
}
test("official source requests only approved exact ranges with identity encoding and no redirect/credentials", async () => {
  const f = sourceFixture(),
    calls = [],
    raw = f.data.get(f.first);
  const request = async (url, opts) => {
    calls.push([url, opts]);
    const [start, end] = opts.headers.Range.slice(6).split("-").map(Number);
    return rangeResponse(raw, start, end - start + 1);
  };
  const store = memoryStore(),
    source = officialSource(f.plan, { request });
  const r = await f.session().transfer(f.first, { store, source });
  assert.equal(r.receipt.partCount, 3);
  assert.deepEqual(
    calls.map(([, o]) => o.headers.Range),
    ["bytes=0-3", "bytes=4-7", "bytes=8-9"],
  );
  for (const [url, o] of calls) {
    assert.equal(url, f.plan.files[0].sources[0]);
    assert.equal(o.redirect, "error");
    assert.equal(o.headers["Accept-Encoding"], "identity");
    assert.equal(o.headers.Authorization, undefined);
    assert.equal(o.credentials, "omit");
    assert.ok(o.signal);
  }
});
test("server ignoring Range is cancelled before consuming the full object", async () => {
  const f = sourceFixture(),
    store = memoryStore();
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  const source = officialSource(f.plan, {
    request: async () => new Response(body, { status: 200 }),
  });
  await assert.rejects(
    f.session().transfer(f.first, { store, source }),
    /range-not-honored/,
  );
  assert.equal(cancelled, true);
  assert.equal(store.records.size, 0);
});
test("200 response is allowed only for an exact complete small file, never a nonzero range", async () => {
  const f = sourceFixture("abc"),
    store = memoryStore();
  const source = officialSource(f.plan, {
    request: async () => new Response(f.data.get(f.first)),
  });
  await f.session().transfer(f.first, { store, source });
  const bad = source({
    objectSHA1: f.first,
    offset: 1,
    length: 2,
    totalBytes: 3,
  });
  await assert.rejects(async () => {
    for await (const _ of bad) {
    }
  }, /range-not-honored/);
});
test("malformed range/length/encoding and HTTP errors are refused", async () => {
  const f = sourceFixture(),
    raw = f.data.get(f.first);
  for (const response of [
    () => new Response("abcd", { status: 206 }),
    () => rangeResponse(raw, 1, 4),
    () =>
      new Response("abcd", {
        status: 206,
        headers: { "content-range": "bytes 0-3/10", "content-length": "5" },
      }),
    () =>
      new Response("abcd", {
        status: 206,
        headers: {
          "content-range": "bytes 0-3/10",
          "content-encoding": "gzip",
        },
      }),
    () => new Response("denied", { status: 403 }),
    () =>
      new Response("moved", {
        status: 302,
        headers: { location: "https://example.com/" },
      }),
  ]) {
    const store = memoryStore(),
      source = officialSource(f.plan, { request: async () => response() });
    await assert.rejects(
      f.session().transfer(f.first, { store, source }),
      TransferError,
    );
    assert.equal(store.records.size, 0);
  }
});
test("official body overflow/truncation fail even with correct HTTP metadata", async () => {
  const f = sourceFixture();
  for (const content of ["abc", "abcde"]) {
    const store = memoryStore(),
      source = officialSource(f.plan, {
        request: async () =>
          new Response(content, {
            status: 206,
            headers: { "content-range": "bytes 0-3/10", "content-length": "4" },
          }),
      });
    await assert.rejects(
      f.session().transfer(f.first, { store, source }),
      TransferError,
    );
    assert.equal(store.records.size, 0);
  }
});
test("unapproved hosts, caller URLs, invalid ranges and timeout settings never initiate a request", async () => {
  const f = sourceFixture();
  let calls = 0;
  const request = async () => {
    calls++;
    throw new Error("unexpected request");
  };
  for (const timeoutMs of [0, -1, NaN, 120001])
    assert.throws(() => officialSource(f.plan, { request, timeoutMs }));
  const source = officialSource(f.plan, { request });
  for (const range of [
    { objectSHA1: "a".repeat(40), offset: 0, length: 4, totalBytes: 10 },
    { objectSHA1: f.first, offset: -1, length: 4, totalBytes: 10 },
    { objectSHA1: f.first, offset: 9, length: 4, totalBytes: 10 },
    { objectSHA1: f.first, offset: 0, length: 0, totalBytes: 10 },
  ])
    await assert.rejects(async () => {
      for await (const _ of source(range)) {
      }
    });
  f.plan.files[0].sources = ["https://example.com/fixture.bin"];
  const { planSHA256: _, ...body } = f.plan;
  f.plan.planSHA256 = hash("sha256", stableJSON(body));
  const bad = officialSource(f.plan, { request });
  await assert.rejects(async () => {
    for await (const _ of bad({
      objectSHA1: f.first,
      offset: 0,
      length: 4,
      totalBytes: 10,
    })) {
    }
  }, /untrusted/);
  assert.equal(calls, 0);
});
test("raw transport errors are not propagated as public protocol diagnostics", async () => {
  const f = sourceFixture(),
    source = officialSource(f.plan, {
      request: async () => {
        throw new Error("secret diagnostic should not escape");
      },
    });
  await assert.rejects(
    f.session().transfer(f.first, { store: memoryStore(), source }),
    (e) =>
      e.reason === "official-source-http-failed" &&
      !e.message.includes("secret"),
  );
});
test("cancellation reaches official fetch and causes no archive writes", async () => {
  const f = sourceFixture(),
    store = memoryStore(),
    c = new AbortController();
  const source = officialSource(f.plan, {
    request: async (_url, opts) => {
      c.abort();
      opts.signal.throwIfAborted();
    },
  });
  await assert.rejects(
    f.session().transfer(f.first, { store, source, signal: c.signal }),
    { name: "AbortError" },
  );
  assert.equal(store.records.size, 0);
});
