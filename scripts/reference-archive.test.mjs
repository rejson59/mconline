import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { buildCorpus, stableJSON } from "./reference-corpus-core.mjs";
import { createTransfer } from "./reference-transfer-core.mjs";
import {
  openArchive,
  ARCHIVE_ENDPOINT,
  ARCHIVE_AUDIENCE,
  ArchiveClientError,
} from "./reference-archive-client.mjs";
import {
  inspectArchive,
  inventoryNotice,
} from "./inspect-reference-archive.mjs";
const ROOT = new URL("../", import.meta.url);
const compiled = await build({
  entryPoints: [
    new URL("supabase/functions/mconline-reference-archive/index.ts", ROOT)
      .pathname,
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  write: false,
});
// External imports cannot be resolved from a data URL, so bundle jose for Node tests.
const bundled = await build({
  entryPoints: [
    new URL("supabase/functions/mconline-reference-archive/index.ts", ROOT)
      .pathname,
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { referenceArchive, TRUST, allowedClaims } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].contents).toString("base64")
);
const keys = await generateKeyPair("RS256", { extractable: true });
const jwk = {
  ...(await exportJWK(keys.publicKey)),
  kid: "archive-test",
  alg: "RS256",
  use: "sig",
};
const observed = JSON.parse(
  fs.readFileSync(new URL("docs/reference-oidc-trust.json", ROOT)),
);
const claims = {
  repository: "rejson59/mconline",
  repository_id: "1387893577",
  actor_id: "185239338",
  ref: "refs/heads/main",
  event_name: "workflow_dispatch",
  workflow_ref: "rejson59/mconline/.github/workflows/ci.yml@refs/heads/main",
  sub: observed.expectedSubject,
  runner_environment: "github-hosted",
  run_id: "12345",
  run_attempt: "2",
};
async function token(overrides = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    ...claims,
    iat: now,
    nbf: now - 5,
    exp: now + 300,
    ...overrides,
  })
    .setIssuer(options.issuer ?? TRUST.issuer)
    .setAudience(options.audience ?? ARCHIVE_AUDIENCE)
    .setProtectedHeader({ alg: "RS256", kid: "archive-test" })
    .sign(options.key ?? keys.privateKey);
}
const sha1 = (b) => createHash("sha1").update(b).digest("hex");
const json = (b) => Buffer.from(JSON.stringify(b));
function corpus() {
  const payloads = new Map();
  function desc(text, name, library = false) {
    const raw = Buffer.from(text),
      h = sha1(raw);
    payloads.set(h, raw);
    const p = `org/example/${name}/1/${name}.jar`;
    return {
      sha1: h,
      size: raw.length,
      url: library
        ? `https://libraries.minecraft.net/${p}`
        : `https://piston-data.mojang.com/v1/objects/${h}/${name}.jar`,
      ...(library ? { path: p } : {}),
    };
  }
  const client = desc("synthetic client bytes", "client"),
    server = desc("synthetic server bytes", "server");
  const library = desc("synthetic library", "library", true),
    asset = desc("synthetic asset", "asset");
  const assetRaw = json({
    objects: { "sounds/test.ogg": { hash: asset.sha1, size: asset.size } },
  });
  const ih = sha1(assetRaw),
    index = {
      id: "fixture",
      sha1: ih,
      size: assetRaw.length,
      url: `https://piston-meta.mojang.com/v1/packages/${ih}/fixture.json`,
    };
  const manifestRaw = json({
    id: "26.3",
    type: "release",
    javaVersion: { majorVersion: 25, component: "synthetic-runtime" },
    downloads: { client, server },
    assetIndex: index,
    libraries: [
      { name: "org.example:library:1", downloads: { artifact: library } },
    ],
  });
  const mh = sha1(manifestRaw),
    pin = {
      version: "26.3",
      manifestSHA1: mh,
      manifestURL: `https://piston-meta.mojang.com/v1/packages/${mh}/26.3.json`,
      clientSHA1: client.sha1,
      clientBytes: client.size,
    };
  const plan = buildCorpus(manifestRaw, assetRaw, pin),
    id = plan.planSHA256.slice(0, 32);
  payloads.set(mh, manifestRaw);
  payloads.set(ih, assetRaw);
  return {
    pin,
    manifestRaw,
    assetRaw,
    index,
    plan,
    id,
    payloads,
    client,
    server,
  };
}
function fixture(options = {}) {
  const f = corpus(),
    calls = [],
    records = new Map();
  const request = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, ...init });
    assert.equal(init.redirect, "error");
    if (url === TRUST.issuer + "/.well-known/jwks")
      return Response.json({ keys: [jwk] });
    if (url === f.pin.manifestURL || url === f.index.url) {
      assert.equal(init.headers?.Authorization, undefined);
      assert.equal(init.headers?.apikey, undefined);
      assert.equal(init.credentials, "omit");
      return new Response(
        url === f.pin.manifestURL
          ? (options.manifestRaw ?? f.manifestRaw)
          : (options.assetRaw ?? f.assetRaw),
      );
    }
    assert.ok(url.startsWith("https://world.invalid/storage/v1/"));
    assert.equal(init.headers.Authorization, "Bearer server-only-key");
    assert.equal(init.headers.apikey, "server-only-key");
    if (url.endsWith("/bucket/mconline-reference-private"))
      return Response.json({
        id: "mconline-reference-private",
        public: options.public ?? false,
        file_size_limit: options.fileLimit ?? 10485760,
      });
    const key = url.split("/object/mconline-reference-private/")[1];
    assert.ok(key);
    if (init.method === "POST") {
      assert.equal(init.headers["x-upsert"], "false");
      assert.equal(init.headers["Content-Type"], "application/octet-stream");
      if (options.writeFailure)
        return new Response("upstream diagnostic must not escape", {
          status: 500,
        });
      if (records.has(key))
        return Response.json(
          { statusCode: "409" },
          { status: options.conflict400 ? 400 : 409 },
        );
      if (!options.dropWrite) records.set(key, Buffer.from(init.body));
      return Response.json({ Key: key });
    }
    assert.equal(init.method, "GET");
    if (!records.has(key))
      return Response.json(
        {
          statusCode: options.missing400 ? "404" : "404",
          error: "Object not found",
        },
        { status: options.missing400 ? 400 : 404 },
      );
    return new Response(records.get(key));
  };
  const handler = referenceArchive("https://world.invalid", "server-only-key", {
    request,
    pin: f.pin,
    budgetBytes: options.budget ?? 10000000,
    partBytes: 4,
  });
  const run = (
    jwt,
    {
      op = "plan",
      object = f.client.sha1,
      index,
      plan = f.plan.planSHA256,
      body,
      headers = {},
      url = ARCHIVE_ENDPOINT,
      method = "POST",
    } = {},
  ) =>
    handler(
      new Request(url, {
        method,
        headers: {
          ...(jwt ? { Authorization: "Bearer " + jwt } : {}),
          "x-reference-op": op,
          "x-reference-plan": plan,
          "x-reference-object": object,
          ...(index === undefined
            ? {}
            : { "x-reference-index": String(index) }),
          ...headers,
        },
        ...(body === undefined ? {} : { body }),
      }),
    );
  return {
    ...f,
    calls,
    records,
    handler,
    run,
    request,
    storage: () => calls.filter((c) => c.url.includes("/storage/")),
  };
}
async function localRecords(f, object = f.client.sha1) {
  const records = new Map();
  const store = {
    read: async (k) => records.get(k) ?? null,
    create: async (k, v) => {
      if (records.has(k)) return false;
      records.set(k, Buffer.from(v));
      return true;
    },
  };
  await createTransfer(f.plan, { id: f.id, partBytes: 4 }).transfer(object, {
    store,
    source: async function* ({ offset, length }) {
      yield f.payloads.get(object).subarray(offset, offset + length);
    },
  });
  return records;
}
async function client(f, jwt = undefined) {
  jwt ??= await token();
  return openArchive({
    pin: f.pin,
    tokenProvider: async (audience) => {
      assert.equal(audience, ARCHIVE_AUDIENCE);
      return jwt;
    },
    request: async (url, init) => {
      assert.equal(url, ARCHIVE_ENDPOINT);
      assert.equal(init.credentials, "omit");
      return f.handler(new Request(url, init));
    },
  });
}

test("server bundle uses pure planner/protocol, never filesystem/CLI or browser helpers", () => {
  const code = compiled.outputFiles[0].text;
  for (const unwanted of [
    "node:fs",
    "process.argv",
    "directoryStore",
    "RejsonAccount",
    "readProbe",
  ])
    assert.ok(!code.includes(unwanted));
  assert.equal(TRUST.audience, ARCHIVE_AUDIENCE);
  assert.equal(TRUST.subject, observed.expectedSubject);
  assert.equal(allowedClaims(claims), true);
});
test("signed owner receives server-derived complete declared plan, not a caller-selected plan", async () => {
  const f = fixture(),
    r = await f.run(await token()),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(b.plan, f.plan);
  assert.equal(b.transferID, f.id);
  assert.equal(b.partBytes, 4);
  assert.equal(b.writesEnabled, true);
  assert.equal(b.independentBackupVerified, false);
  assert.equal(b.fullCorpusReady, false);
  assert.ok(b.maximumStoredBytes > f.plan.summary.totalBytes);
  assert.equal(f.storage().length, 0);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.ok(!r.headers.has("access-control-allow-origin"));
});
test("missing/opaque tokens and browser/method/query input fail before any source or Storage I/O", async () => {
  const f = fixture();
  for (const jwt of [undefined, "opaque-account-session", "x.y.z"])
    assert.equal((await f.run(jwt)).status, 401);
  assert.equal(
    (
      await f.run(undefined, {
        headers: { origin: "https://rejson59.github.io" },
      })
    ).status,
    403,
  );
  assert.equal((await f.run(undefined, { method: "GET" })).status, 405);
  assert.equal(
    (await f.run(undefined, { url: ARCHIVE_ENDPOINT + "?key=other" })).status,
    400,
  );
  assert.equal((await f.run(undefined, { op: "delete" })).status, 400);
  assert.equal(f.calls.length, 0);
});
test("wrong signed contexts, mutable subjects and rerun identity changes denied before official/Storage I/O", async () => {
  const f = fixture();
  for (const override of [
    { repository_id: "999" },
    { repository: "other/repo" },
    { actor_id: "999" },
    { ref: "refs/heads/develop" },
    { event_name: "push" },
    { workflow_ref: "other/workflow" },
    { runner_environment: "self-hosted" },
    { sub: "repo:rejson59/mconline:ref:refs/heads/main" },
    { sub: observed.expectedSubject.replace("@185239338", "@999") },
    { run_id: "../wrong" },
    { run_attempt: "0" },
  ])
    assert.equal((await f.run(await token(override))).status, 403);
  assert.equal(
    f.calls.filter((c) => !c.url.includes("/.well-known/jwks")).length,
    0,
  );
});
test("signature, audience, issuer, required claims and temporal guards are mandatory", async () => {
  const f = fixture(),
    other = await generateKeyPair("RS256"),
    now = Math.floor(Date.now() / 1000);
  for (const jwt of [
    await token({}, { key: other.privateKey }),
    await token({}, { audience: "mconline-reference-probe-read-v1" }),
    await token({}, { issuer: "https://evil.invalid" }),
    await token({ exp: now - 120 }),
    await token({ nbf: now + 120 }),
    await token({ iat: now - 1200 }),
    await token({ repository_id: undefined }),
  ])
    assert.equal((await f.run(jwt)).status, 401);
  assert.equal(
    f.calls.filter((c) => !c.url.includes("/.well-known/jwks")).length,
    0,
  );
});
test("metadata bytes are independently verified; failures are not cached as an approved plan", async () => {
  for (const options of [
    { manifestRaw: Buffer.from("{}") },
    { assetRaw: Buffer.from("{}") },
  ]) {
    const f = fixture(options),
      jwt = await token();
    assert.equal((await f.run(jwt)).status, 503);
    assert.equal((await f.run(jwt)).status, 503);
    assert.equal(f.storage().length, 0);
    assert.equal(f.calls.filter((c) => c.url === f.pin.manifestURL).length, 2);
  }
});
test("successful plan load is cached, but per-request signature/context is still checked", async () => {
  const f = fixture(),
    jwt = await token();
  await Promise.all([f.run(jwt), f.run(jwt), f.run(jwt)]);
  assert.equal(f.calls.filter((c) => c.url === f.pin.manifestURL).length, 1);
  assert.equal((await f.run(await token({ actor_id: "999" }))).status, 403);
});
test("caller plan/body/options cannot influence the server's approved plan", async () => {
  const f = fixture(),
    jwt = await token();
  for (const body of [
    JSON.stringify({
      plan: f.plan,
      bucket: "other",
      url: "https://evil.invalid/",
    }),
    "x",
  ])
    assert.equal((await f.run(jwt, { body })).status, 413);
  assert.equal(f.storage().length, 0);
  assert.equal(f.calls.filter((c) => c.url === f.pin.manifestURL).length, 0);
});
test("zero budget locks writes before official/Storage I/O; under-budget archive also refuses writing", async () => {
  const f = fixture({ budget: 0 }),
    jwt = await token();
  for (const op of ["write-part", "finalize"])
    assert.equal((await f.run(jwt, { op, index: 0 })).status, 423);
  assert.equal(
    f.calls.filter((c) => !c.url.includes("/.well-known/jwks")).length,
    0,
  );
  const g = fixture({ budget: 1 });
  const plan = await (await g.run(jwt)).json();
  assert.equal(plan.writesEnabled, false);
  assert.equal((await g.run(jwt, { op: "write-part", index: 0 })).status, 423);
  assert.equal(g.storage().length, 0);
});
test("unknown object, wrong plan and invalid indexes never reach Storage", async () => {
  const f = fixture(),
    jwt = await token();
  for (const [options, status] of [
    [{ op: "read-part", object: "a".repeat(40), index: 0 }, 403],
    [{ op: "read-part", plan: "b".repeat(64), index: 0 }, 409],
    [{ op: "read-part", index: -1 }, 400],
    [{ op: "read-part", index: "00" }, 400],
    [{ op: "read-part", index: 9999 }, 400],
  ])
    assert.equal((await f.run(jwt, options)).status, status);
  assert.equal(f.storage().length, 0);
});
test("public bucket and too-small per-object limit stop writes", async () => {
  for (const options of [{ public: true }, { fileLimit: 100 }]) {
    const f = fixture(options),
      jwt = await token(),
      records = await localRecords(f),
      raw = [...records.values()][0];
    assert.equal(
      (await f.run(jwt, { op: "write-part", index: 0, body: raw })).status,
      503,
    );
    assert.equal(f.records.size, 0);
    assert.ok(f.storage().every((c) => c.method === "GET"));
  }
});
test("signed valid part is immutable, byte-verified and idempotent with Storage 400/409 conflicts", async () => {
  for (const conflict400 of [false, true]) {
    const f = fixture({ conflict400 }),
      jwt = await token(),
      records = await localRecords(f),
      raw = [...records.values()][0];
    const first = await f.run(jwt, { op: "write-part", index: 0, body: raw });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).created, true);
    const again = await f.run(jwt, { op: "write-part", index: 0, body: raw });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).created, false);
    assert.equal(f.records.size, 1);
    assert.deepEqual([...f.records.values()][0], raw);
  }
});
test("forged part binding/checksum and oversize request never create objects", async () => {
  const f = fixture(),
    jwt = await token(),
    raw = Buffer.from([...(await localRecords(f)).values()][0]);
  raw[raw.length - 1] ^= 1;
  assert.equal(
    (await f.run(jwt, { op: "write-part", index: 0, body: raw })).status,
    409,
  );
  assert.equal(
    (
      await f.run(jwt, {
        op: "write-part",
        index: 1,
        body: [...(await localRecords(f)).values()][0],
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.run(jwt, {
        op: "write-part",
        index: 0,
        headers: { "content-length": String(4 * 1024 * 1024 + 1033) },
      })
    ).status,
    413,
  );
  assert.equal(f.records.size, 0);
});
test("Storage ACK without persisted bytes is not a confirmed write; upstream diagnostics stay private", async () => {
  for (const options of [{ dropWrite: true }, { writeFailure: true }]) {
    const f = fixture(options),
      jwt = await token(),
      raw = [...(await localRecords(f)).values()][0];
    const r = await f.run(jwt, { op: "write-part", index: 0, body: raw });
    assert.ok([409, 503].includes(r.status));
    assert.ok(!(await r.text()).includes("diagnostic"));
  }
});
test("finalize independently reads/hashes every part and rejects incomplete archive or caller receipt", async () => {
  const f = fixture(),
    jwt = await token();
  assert.equal((await f.run(jwt, { op: "finalize" })).status, 409);
  assert.equal(
    (
      await f.run(jwt, {
        op: "finalize",
        body: JSON.stringify({ verified: true }),
      })
    ).status,
    413,
  );
  const records = await localRecords(f);
  for (const [key, bytes] of records)
    if (key.endsWith(".bin")) f.records.set(key, bytes);
  const r = await f.run(jwt, { op: "finalize" });
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.created, true);
  assert.equal(result.receipt.objectSHA1, f.client.sha1);
  assert.equal(
    (await (await f.run(jwt, { op: "finalize" })).json()).created,
    false,
  );
  assert.equal(f.records.size, records.size);
});
test("corrupt stored parts cannot be read as valid or finalized, and are never overwritten", async () => {
  const f = fixture(),
    jwt = await token(),
    records = await localRecords(f);
  const [key, value] = [...records][0],
    raw = Buffer.from(value);
  raw[raw.length - 1] ^= 1;
  f.records.set(key, raw);
  assert.equal((await f.run(jwt, { op: "read-part", index: 0 })).status, 409);
  assert.equal((await f.run(jwt, { op: "finalize" })).status, 409);
  const valid = [...records.values()][0];
  assert.equal(
    (await f.run(jwt, { op: "write-part", index: 0, body: valid })).status,
    409,
  );
  assert.deepEqual(f.records.get(key), raw);
});
test("missing object responses 400/404 mean missing, not success; no delete/list/update methods", async () => {
  for (const missing400 of [false, true]) {
    const f = fixture({ missing400 }),
      jwt = await token();
    assert.equal((await f.run(jwt, { op: "read-part", index: 0 })).status, 404);
    assert.ok(f.storage().every((c) => c.method === "GET"));
  }
});
test("real client adapter and signed handler resume across interruption then independently finalize/verify", async () => {
  const f = fixture(),
    archive = await client(f);
  let breakOnce = true;
  const source = async function* ({ offset, length }) {
    if (offset === 8 && breakOnce) {
      breakOnce = false;
      throw new Error("disconnect");
    }
    yield f.payloads.get(f.client.sha1).subarray(offset, offset + length);
  };
  await assert.rejects(
    archive.session.transfer(f.client.sha1, { store: archive.store, source }),
    /disconnect/,
  );
  assert.equal(
    [...f.records.keys()].filter((k) => k.endsWith(".bin")).length,
    2,
  );
  assert.ok(![...f.records.keys()].some((k) => k.endsWith("complete.json")));
  const second = await client(f),
    r = await second.session.transfer(f.client.sha1, {
      store: second.store,
      source,
    });
  assert.equal(r.resumedParts, 2);
  assert.equal(r.receipt.objectSHA1, f.client.sha1);
  const v = await second.session.verify(f.client.sha1, { store: second.store });
  assert.deepEqual(v.receipt, r.receipt);
  assert.equal(v.independentBackupVerified, false);
  assert.equal(v.fullCorpusReady, false);
  assert.ok(f.storage().every((c) => ["GET", "POST"].includes(c.method)));
});
test("client blocks gated writes, forged keys and malformed credentials before sending them", async () => {
  const f = fixture({ budget: 0 }),
    archive = await client(f);
  assert.equal(archive.writesEnabled, false);
  const records = await localRecords(f),
    [key, raw] = [...records][0],
    before = f.calls.length;
  await assert.rejects(archive.store.create(key, raw), (e) => e.status === 423);
  for (const forged of [
    "../../other",
    key.replace(f.plan.planSHA256, "a".repeat(64)),
  ])
    await assert.rejects(
      archive.store.read(forged, 10),
      (e) => e.status === 403,
    );
  assert.equal(f.calls.length, before);
  await assert.rejects(
    openArchive({
      tokenProvider: async () => "opaque-token",
      request: () => {
        throw new Error("must not call");
      },
    }),
    (e) => e.status === 401,
  );
});
test("client ignores mutable returned-plan changes when authorizing subsequent object keys", async () => {
  const f = fixture(),
    archive = await client(f),
    records = await localRecords(f),
    key = [...records.keys()][0];
  archive.plan.files.length = 0;
  assert.equal(await archive.store.read(key, 4 * 1024 * 1024 + 1032), null);
});
test("client refuses wrong manifest provenance, forged completion and transport diagnostics", async () => {
  const f = fixture();
  await assert.rejects(
    openArchive({
      pin: { ...f.pin, manifestSHA1: "0".repeat(40) },
      tokenProvider: () => token(),
      request: (url, init) => f.handler(new Request(url, init)),
    }),
    ArchiveClientError,
  );
  await assert.rejects(
    openArchive({
      tokenProvider: () => token(),
      request: () => {
        throw new Error("private token text");
      },
    }),
    (e) => e.status === 503 && !e.message.includes("token text"),
  );
});

test("production entry is explicitly locked, and constructor defaults to zero write budget", async () => {
  const source = fs.readFileSync(
    new URL("supabase/functions/mconline-reference-archive/index.ts", ROOT),
    "utf8",
  );
  assert.match(source, /budgetBytes: 0/);
  assert.ok(
    !source.includes('env.get("MCONLINE_REFERENCE_ARCHIVE_BUDGET_BYTES")'),
  );
  const f = fixture();
  const handler = referenceArchive("https://world.invalid", "server-only-key", {
    request: f.request,
    pin: f.pin,
  });
  const r = await handler(
    new Request(ARCHIVE_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: "Bearer " + (await token()),
        "x-reference-op": "write-part",
      },
    }),
  );
  assert.equal(r.status, 423);
  assert.equal(f.storage().length, 0);
});
test("actual oversized stream and authorization header are bounded before metadata/Storage", async () => {
  const f = fixture();
  assert.equal((await f.run("a".repeat(12001))).status, 413);
  const r = await f.run(await token(), {
    op: "write-part",
    index: 0,
    body: Buffer.alloc(4 * 1024 * 1024 + 1033),
  });
  assert.equal(r.status, 413);
  assert.equal(f.storage().length, 0);
  assert.equal(f.calls.filter((c) => c.url === f.pin.manifestURL).length, 0);
});
test("client rejects a forged finalize response instead of accepting a completion ACK", async () => {
  const f = fixture();
  const archive = await openArchive({
    pin: f.pin,
    tokenProvider: () => token(),
    request: async (url, init) => {
      const r = await f.handler(new Request(url, init));
      if (init.headers["x-reference-op"] !== "finalize" || r.status !== 200)
        return r;
      const b = await r.json();
      b.receipt.sha256 = "0".repeat(64);
      return Response.json(b);
    },
  });
  await assert.rejects(
    archive.session.transfer(f.client.sha1, {
      store: archive.store,
      source: async function* ({ offset, length }) {
        yield f.payloads.get(f.client.sha1).subarray(offset, offset + length);
      },
    }),
    (e) => e instanceof ArchiveClientError && e.status === 409,
  );
});

test("inventory runner requests fresh audience, reads only the approved plan and reports honest limits", async () => {
  const f = fixture({ budget: 0 }),
    jwt = await token(),
    calls = [];
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_ACTOR_ID: "185239338",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://job.actions.githubusercontent.com/id?existing=1",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-job-request-token",
  };
  const request = async (url, init) => {
    calls.push({ url: String(url), ...init });
    if (String(url).startsWith("https://job.actions.githubusercontent.com/")) {
      assert.equal(new URL(url).searchParams.get("audience"), ARCHIVE_AUDIENCE);
      assert.equal(
        init.headers.Authorization,
        "Bearer synthetic-job-request-token",
      );
      return Response.json({ value: jwt });
    }
    assert.equal(url, ARCHIVE_ENDPOINT);
    assert.equal(init.headers["x-reference-op"], "plan");
    return f.handler(new Request(url, init));
  };
  const report = await inspectArchive(request, env, f.pin);
  assert.equal(report.planDigestVerified, true);
  assert.equal(report.uniqueObjects, f.plan.summary.uniqueObjects);
  assert.equal(report.storageWrites, false);
  assert.equal(report.originalsTransferred, false);
  assert.equal(report.fullCorpusReady, false);
  assert.equal(report.independentBackupVerified, false);
  assert.equal(
    report.officialMetadataBytesIndependentlyVerifiedByRunner,
    false,
  );
  assert.equal(calls.length, 2);
  assert.equal(f.storage().length, 0);
  const notice = inventoryNotice({ ...report, text: "%\r\n" });
  assert.ok(notice.includes("%25"));
  assert.ok(!notice.includes("\r"));
  assert.ok(!notice.includes("\n"));
  assert.ok(!notice.includes(jwt));
  assert.ok(!notice.includes("synthetic-job-request-token"));
});
test("inventory runner rejects wrong job context and identity URLs before network", async () => {
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_ACTOR_ID: "185239338",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://job.actions.githubusercontent.com/id",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-job-request-token",
  };
  for (const patch of [
    { GITHUB_REF: "refs/heads/other" },
    { GITHUB_ACTOR_ID: "999" },
    { GITHUB_EVENT_NAME: "push" },
    {
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "http://job.actions.githubusercontent.com/id",
    },
    { ACTIONS_ID_TOKEN_REQUEST_URL: "https://evil.invalid/id" },
    {
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://user:secret@job.actions.githubusercontent.com/id",
    },
  ])
    await assert.rejects(
      inspectArchive(
        () => {
          throw new Error("unexpected network");
        },
        { ...env, ...patch },
      ),
    );
});
test("inventory workflow has only job-scoped OIDC, explicit owner main opt-in, no secrets or artifacts", () => {
  const yaml = fs.readFileSync(
    new URL(".github/workflows/ci.yml", ROOT),
    "utf8",
  );
  const part = yaml
    .split("  reference-archive-plan:")[1]
    .split("  reference-private-read:")[0];
  assert.ok(part.includes("github.event_name == 'workflow_dispatch'"));
  assert.ok(part.includes("github.ref == 'refs/heads/main'"));
  assert.ok(part.includes("github.actor_id == '185239338'"));
  assert.ok(part.includes("inputs.reference_archive_plan"));
  assert.ok(part.includes("id-token: write"));
  assert.ok(!part.includes("secrets."));
  assert.ok(!part.includes("upload-artifact"));
  assert.ok(yaml.includes("reference_archive_plan:"));
});
