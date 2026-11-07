import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  auditCorpus,
  buildCorpus,
  objectKey,
  sourceURL,
  stableJSON,
  savePlan,
} from "./reference-corpus.mjs";
import { PIN } from "./probe-reference-network.mjs";
const sha = (b) => createHash("sha1").update(b).digest("hex");
const json = (b) => Buffer.from(JSON.stringify(b));
const ROOT = fileURLToPath(new URL("../", import.meta.url));
function fixture(edit = () => {}) {
  const payloads = new Map();
  function download(text, name, library = false) {
    const raw = Buffer.from(text),
      sha1 = sha(raw);
    payloads.set(sha1, raw);
    const p = `org/example/${name}/1/${name}-1.jar`;
    return {
      sha1,
      size: raw.length,
      url: library
        ? `https://libraries.minecraft.net/${p}`
        : `https://piston-data.mojang.com/v1/objects/${sha1}/${name}.jar`,
      ...(library ? { path: p } : {}),
    };
  }
  const client = download("synthetic client, not Minecraft", "client");
  const server = download("synthetic server", "server");
  const mapping = download("synthetic mapping", "client_mappings");
  const artifact = download("synthetic library", "library", true);
  const windows = download("synthetic windows native", "windows", true);
  const linux = download("synthetic linux native", "linux", true);
  const asset = download("synthetic sound", "sound");
  const empty = download("", "empty");
  const assets = {
    objects: {
      "sounds/test.ogg": { hash: asset.sha1, size: asset.size },
      "sounds/alias.ogg": { hash: asset.sha1, size: asset.size },
      "empty.txt": { hash: empty.sha1, size: empty.size },
    },
  };
  const manifest = {
    id: "26.3",
    type: "release",
    downloads: { client, server, client_mappings: mapping },
    javaVersion: { majorVersion: 25, component: "synthetic-runtime" },
    libraries: [
      {
        name: "org.example:library:1",
        rules: [{ action: "disallow", os: { name: "linux" } }],
        natives: { windows: "natives-windows-${arch}", linux: "natives-linux" },
        extract: { exclude: ["META-INF/"] },
        downloads: {
          artifact,
          classifiers: {
            "natives-windows-64": windows,
            "natives-linux": linux,
          },
        },
      },
    ],
    logging: {
      client: { file: download("synthetic log config", "log-config") },
    },
  };
  edit(manifest, assets, payloads);
  const assetRaw = json(assets);
  const indexHash = sha(assetRaw);
  manifest.assetIndex = {
    id: "test-index",
    sha1: indexHash,
    size: assetRaw.length,
    url: `https://piston-meta.mojang.com/v1/packages/${indexHash}/test-index.json`,
  };
  const manifestRaw = json(manifest);
  const manifestSHA1 = sha(manifestRaw);
  const pin = {
    version: "26.3",
    manifestSHA1,
    manifestURL: `https://piston-meta.mojang.com/v1/packages/${manifestSHA1}/26.3.json`,
    clientSHA1: client.sha1,
    clientBytes: client.size,
  };
  payloads.set(indexHash, assetRaw);
  payloads.set(manifestSHA1, manifestRaw);
  return {
    manifestRaw,
    assetRaw,
    pin,
    payloads,
    plan: () => buildCorpus(manifestRaw, assetRaw, pin),
  };
}
async function temp(t) {
  const dir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "mconline-corpus-"),
  );
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  return dir;
}
async function materialize(root, f) {
  for (const [sha1, data] of f.payloads) {
    const filename = path.join(root, objectKey(sha1));
    await fs.promises.mkdir(path.dirname(filename), { recursive: true });
    await fs.promises.writeFile(filename, data);
  }
}
function resign(plan) {
  const { planSHA256: _, ...body } = plan;
  return {
    ...body,
    planSHA256: createHash("sha256").update(stableJSON(body)).digest("hex"),
  };
}

test("inventory includes server, mappings, logging, metadata, all assets and native/library variants", () => {
  const p = fixture().plan();
  for (const role of [
    "version-manifest",
    "asset-index",
    "version-download",
    "asset",
    "library",
    "logging-config",
  ])
    assert.ok(p.files.some((f) => f.references.some((r) => r.role === role)));
  const refs = p.files.flatMap((f) => f.references.map((r) => r.name));
  for (const name of [
    "client",
    "server",
    "client_mappings",
    "org.example:library:1/artifact",
    "org.example:library:1/natives-windows-64",
    "org.example:library:1/natives-linux",
  ])
    assert.ok(refs.includes(name));
  assert.deepEqual(p.requirements.java, {
    major: 25,
    component: "synthetic-runtime",
  });
  assert.equal(p.requirements.libraries[0].rules[0].action, "disallow");
  assert.equal(
    p.requirements.libraries[0].natives.windows,
    "natives-windows-${arch}",
  );
  assert.deepEqual(p.requirements.libraries[0].extract.exclude, ["META-INF/"]);
});
test("content addressing deduplicates aliases without dropping logical references, including empty files", () => {
  const p = fixture().plan();
  const sound = p.files.find((f) =>
    f.references.some((r) => r.name === "sounds/test.ogg"),
  );
  assert.equal(sound.references.length, 2);
  assert.equal(p.summary.assetEntries, 3);
  assert.equal(p.summary.logicalReferences, p.summary.uniqueObjects + 1);
  assert.equal(
    p.summary.totalBytes,
    p.files.reduce((n, f) => n + f.bytes, 0),
  );
  assert.ok(p.files.some((f) => f.bytes === 0));
  assert.equal(new Set(p.files.map((f) => f.key)).size, p.files.length);
});
test("plan is deterministic for identical verified metadata and retains raw-source provenance", () => {
  const f = fixture(),
    a = f.plan(),
    b = f.plan();
  assert.deepEqual(a, b);
  assert.match(a.planSHA256, /^[a-f0-9]{64}$/);
  const p = JSON.parse(f.manifestRaw),
    assets = JSON.parse(f.assetRaw);
  // Identical verified raw metadata always yields identical bytes; raw source hashes ARE provenance.
  assert.notEqual(
    sha(
      json({
        ...assets,
        objects: Object.fromEntries(Object.entries(assets.objects).reverse()),
      }),
    ),
    sha(f.assetRaw),
  );
  assert.equal(p.libraries[0].rules[0].action, "disallow");
});
test("inventory explicitly blocks full-completeness, backup and parity claims", () => {
  const p = fixture().plan();
  assert.equal(p.fullCorpusReady, false);
  for (const gap of [
    "java-runtime-platform-manifests-and-files",
    "embedded-client-resource-inventory",
    "embedded-server-bundle-inventory",
    "private-persistent-transfer",
    "independent-backup-and-restore",
    "execution-and-behavior-comparison",
  ])
    assert.ok(p.pending.includes(gap));
});
test("pinned official manifest is required; fixture/modified bytes never pass production pin", () => {
  const f = fixture();
  assert.throws(() => buildCorpus(f.manifestRaw, f.assetRaw), /checksum/);
  assert.throws(
    () =>
      buildCorpus(
        Buffer.concat([f.manifestRaw, Buffer.from(" ")]),
        f.assetRaw,
        f.pin,
      ),
    /checksum/,
  );
  assert.throws(
    () =>
      buildCorpus(
        f.manifestRaw,
        Buffer.concat([f.assetRaw, Buffer.from(" ")]),
        f.pin,
      ),
    /checksum/,
  );
  assert.throws(
    () => buildCorpus(Buffer.alloc(512 * 1024 + 1), f.assetRaw, f.pin),
    /checksum/,
  );
  assert.throws(
    () => buildCorpus(f.manifestRaw, Buffer.alloc(2 * 1024 * 1024 + 1), f.pin),
    /checksum/,
  );
});
test("reject snapshots, missing server/Java and unexpected client", () => {
  for (const edit of [
    (m) => {
      m.type = "snapshot";
    },
    (m) => {
      m.id = "26.4-snapshot-7";
    },
    (m) => {
      delete m.downloads.server;
    },
    (m) => {
      delete m.javaVersion;
    },
    (m) => {
      m.javaVersion.majorVersion = 0;
    },
    (m) => {
      m.downloads.client.url = "https://example.com/client.jar";
    },
  ])
    assert.throws(() => fixture(edit).plan());
});
test("source allowlist rejects SSRF, redirects-as-URLs, credentials, ports and encoded/path traversal", () => {
  const h = "a".repeat(40);
  for (const url of [
    `http://libraries.minecraft.net/x.jar`,
    `https://libraries.minecraft.net.evil.test/x.jar`,
    `https://user:secret@libraries.minecraft.net/x.jar`,
    `https://libraries.minecraft.net:443/x.jar`,
    `https://libraries.minecraft.net/a/../x.jar`,
    `https://libraries.minecraft.net/%2e%2e/x.jar`,
    `https://libraries.minecraft.net/x.jar?token=secret`,
    `https://libraries.minecraft.net/x.jar#x`,
    `https://127.0.0.1/x.jar`,
    `file:///etc/passwd`,
    `https://libraries.minecraft.net//x.jar`,
  ])
    assert.throws(() => sourceURL(url, "library", h));
  assert.throws(() =>
    sourceURL(
      `https://piston-data.mojang.com/v1/objects/${"b".repeat(40)}/client.jar`,
      "download",
      h,
    ),
  );
  assert.throws(() =>
    sourceURL(
      `https://piston-meta.mojang.com/v1/packages/${h}/26.3.json`,
      "download",
      h,
    ),
  );
  assert.throws(() =>
    sourceURL(`https://resources.download.minecraft.net/ab/${h}`, "asset", h),
  );
});
test("reject unsafe asset names and malformed/ambiguous descriptors", () => {
  for (const name of [
    "../secret",
    "/absolute",
    "a/../../b",
    "a\\b",
    "a//b",
    "a/./b",
    "a\u0000b",
    "C:/secret",
    "%2e%2e/secret",
  ]) {
    assert.throws(() =>
      fixture((_m, a) => {
        a.objects[name] = a.objects["sounds/test.ogg"];
      }).plan(),
    );
  }
  for (const edit of [
    (_m, a) => {
      a.objects["sounds/test.ogg"].size = -1;
    },
    (_m, a) => {
      a.objects["sounds/test.ogg"].size = 1.5;
    },
    (_m, a) => {
      a.objects["sounds/test.ogg"].size = 2 ** 31;
    },
    (_m, a) => {
      a.objects["sounds/test.ogg"].hash = "../bad";
    },
    (_m, a) => {
      a.objects["sounds/alias.ogg"].size++;
    },
    (_m, a) => {
      a.objects = [];
    },
    (_m, a) => {
      a.objects = {};
    },
  ])
    assert.throws(() => fixture(edit).plan());
});
test("unsupported libraries fail closed instead of silently producing a partial plan", () => {
  for (const edit of [
    (m) => {
      delete m.libraries;
    },
    (m) => {
      m.libraries = [];
    },
    (m) => {
      m.libraries[0].downloads = {};
    },
    (m) => {
      m.libraries[0].downloads.future = {};
    },
    (m) => {
      m.libraries[0].downloads.artifact.path = "different.jar";
    },
    (m) => {
      m.libraries[0].downloads.classifiers = [];
    },
    (m) => {
      m.libraries[0].rules = [{ action: "unknown" }];
    },
    (m) => {
      m.libraries[0].natives = { linux: null };
    },
    (m) => {
      m.libraries[0].downloads.artifact.url = "https://example.com/bad.jar";
    },
  ])
    assert.throws(() => fixture(edit).plan());
});
test("fully matching local objects pass SHA-1 and gain SHA-256 receipts, but not full-corpus status", async (t) => {
  const root = await temp(t),
    f = fixture();
  await materialize(root, f);
  const report = await auditCorpus(f.plan(), root);
  assert.equal(report.declaredObjectsVerified, true);
  assert.equal(report.counts.verified, f.payloads.size);
  assert.equal(report.counts.missing, 0);
  assert.equal(report.fullCorpusReady, false);
  assert.equal(report.independentBackupVerified, false);
  assert.equal(report.gameParityVerified, false);
  for (const r of report.results) {
    assert.equal(
      r.sha256,
      createHash("sha256").update(f.payloads.get(r.sha1)).digest("hex"),
    );
  }
});
test("missing files are reported as missing, not substituted or created", async (t) => {
  const root = path.join(await temp(t), "does-not-exist"),
    f = fixture();
  const report = await auditCorpus(f.plan(), root);
  assert.equal(report.counts.missing, f.payloads.size);
  assert.equal(report.declaredObjectsVerified, false);
  assert.equal(fs.existsSync(root), false);
});
test("wrong size and same-size corruption are detected and left untouched", async (t) => {
  const root = await temp(t),
    f = fixture(),
    p = f.plan();
  await materialize(root, f);
  const nonempty = p.files.filter((o) => o.bytes > 0);
  for (const [i, raw] of [
    Buffer.from("wrong size"),
    Buffer.alloc(nonempty[1].bytes, 0xff),
  ].entries())
    await fs.promises.writeFile(path.join(root, nonempty[i].key), raw);
  const before = await fs.promises.readFile(path.join(root, nonempty[1].key));
  const report = await auditCorpus(p, root);
  assert.equal(report.counts["different-or-unreadable"], 2);
  assert.equal(report.declaredObjectsVerified, false);
  assert.deepEqual(
    await fs.promises.readFile(path.join(root, nonempty[1].key)),
    before,
  );
});
test("reject symlink objects and symlink directories, never following them into another store", async (t) => {
  const root = await temp(t),
    external = await temp(t),
    f = fixture(),
    p = f.plan();
  await materialize(external, f);
  await fs.promises.symlink(
    path.join(external, "objects"),
    path.join(root, "objects"),
    "dir",
  );
  let report = await auditCorpus(p, root);
  assert.equal(report.counts["different-or-unreadable"], p.files.length);
  await fs.promises.unlink(path.join(root, "objects"));
  await materialize(root, f);
  const target = path.join(root, p.files[0].key);
  await fs.promises.unlink(target);
  await fs.promises.symlink(path.join(external, p.files[0].key), target);
  report = await auditCorpus(p, root);
  assert.equal(report.counts["different-or-unreadable"], 1);
  if (process.platform === "linux") {
    await fs.promises.unlink(target);
    assert.equal(spawnSync("mkfifo", [target]).status, 0);
    report = await auditCorpus(p, root);
    assert.equal(report.counts["different-or-unreadable"], 1);
  }
});
test("altered/forged plan paths, duplicates and totals fail before filesystem reads", async (t) => {
  const root = await temp(t),
    p = fixture().plan();
  const corrupt = structuredClone(p);
  corrupt.files[0].bytes++;
  await assert.rejects(auditCorpus(corrupt, root), /altered/);
  for (const edit of [
    (p) => {
      p.files[0].key = "../../credentials";
    },
    (p) => {
      p.files.push(p.files[0]);
    },
    (p) => {
      p.files[0].sha1 = "../unsafe";
    },
    (p) => {
      p.summary.totalBytes++;
    },
    (p) => {
      p.fullCorpusReady = true;
    },
    (p) => {
      p.pending = [];
    },
  ]) {
    const forged = structuredClone(p);
    edit(forged);
    await assert.rejects(auditCorpus(resign(forged), root));
  }
});
test("CLI is offline, validates options and exposes no transfer/execute command", () => {
  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/reference-corpus.mjs", ...args], {
      cwd: ROOT,
      encoding: "utf8",
    });
  assert.equal(run("--help").status, 0);
  assert.match(run("--help").stdout, /No downloads\/uploads\/execution/);
  for (const args of [
    ["download"],
    ["execute"],
    ["plan", "--unknown", "value"],
    ["plan", "--manifest"],
    ["audit", "--plan", "a", "--plan", "b"],
  ]) {
    const r = run(...args);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "");
    assert.ok(!r.stderr.includes("ENOENT"));
  }
});
test("CLI audit returns nonzero for incomplete corpus and never reports backup/parity success", async (t) => {
  const dir = await temp(t),
    plan = path.join(dir, "plan.json");
  fs.writeFileSync(plan, JSON.stringify(fixture().plan()));
  const r = spawnSync(
    process.execPath,
    [
      "scripts/reference-corpus.mjs",
      "audit",
      "--plan",
      plan,
      "--root",
      path.join(dir, "empty-store"),
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 2);
  const report = JSON.parse(r.stdout);
  assert.equal(report.declaredObjectsVerified, false);
  assert.equal(report.fullCorpusReady, false);
  assert.equal(report.independentBackupVerified, false);
});
test("target stays pinned to the repo migration lock; official bytes are not fixture bytes", () => {
  const lock = JSON.parse(
    fs.readFileSync(path.join(ROOT, "docs/java-reference.lock.json")),
  );
  assert.equal(PIN.version, lock.target);
  assert.equal(lock.status, "migration-target-not-runtime-parity");
  assert.equal(PIN.clientBytes, 41483720);
});

test("generated plans are immutable, cache-only and reject symlink destinations", async (t) => {
  const cache = path.join(ROOT, ".cache");
  fs.mkdirSync(cache, { recursive: true });
  const dir = fs.mkdtempSync(path.join(cache, "corpus-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const p = fixture().plan(),
    filename = path.join(dir, "plan.json");
  savePlan(p, filename);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), p);
  assert.equal(savePlan(p, filename), filename);
  const changed = fixture((m) => {
    m.javaVersion.majorVersion = 26;
  }).plan();
  assert.throws(() => savePlan(changed, filename), /never overwrite/);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), p);
  assert.throws(() => savePlan(p, "public/reference-plan.json"), /ignored/);
  assert.throws(
    () => savePlan(p, ".cache/../public/reference-plan.json"),
    /ignored/,
  );
  const outside = await temp(t);
  const link = path.join(dir, "linked-directory");
  fs.symlinkSync(outside, link, "dir");
  assert.throws(() => savePlan(p, path.join(link, "plan.json")), /Unsafe/);
  assert.equal(fs.readdirSync(outside).length, 0);
  fs.symlinkSync(filename, path.join(dir, "linked-plan.json"));
  assert.throws(() => savePlan(p, path.join(dir, "linked-plan.json")));
});
test("audit rejects a root whose ancestor is a symlink", async (t) => {
  const root = await temp(t),
    external = await temp(t),
    f = fixture();
  await materialize(path.join(external, "store"), f);
  fs.symlinkSync(external, path.join(root, "redirect"), "dir");
  const report = await auditCorpus(
    f.plan(),
    path.join(root, "redirect", "store"),
  );
  assert.equal(report.counts["different-or-unreadable"], f.payloads.size);
});
test("object keys reject non-string hashes and all traversal attempts", () => {
  for (const value of [
    null,
    {},
    ["a".repeat(40)],
    "../secret",
    "A".repeat(40),
    "a".repeat(39),
  ])
    assert.throws(() => objectKey(value));
});

test("streaming verification handles objects larger than the 64 KiB buffer", async (t) => {
  const f = fixture((_m, assets, payloads) => {
    const raw = Buffer.alloc(200000, 7),
      hash = sha(raw);
    assets.objects["synthetic-large.bin"] = { hash, size: raw.length };
    payloads.set(hash, raw);
  });
  const root = await temp(t);
  await materialize(root, f);
  const report = await auditCorpus(f.plan(), root);
  assert.equal(report.declaredObjectsVerified, true);
  assert.ok(
    report.results.some((r) => r.bytes === 200000 && r.status === "verified"),
  );
});
test("planning enforces the reviewed total-byte budget before any transfer", () => {
  const f = fixture((m) => {
    m.libraries = Array.from({ length: 9 }, (_, i) => {
      const h = sha(Buffer.from("budget-object-" + i)),
        p = `org/example/budget/${i}/budget-${i}.jar`;
      return {
        name: `org.example:budget:${i}`,
        downloads: {
          artifact: {
            sha1: h,
            size: 1024 ** 3,
            path: p,
            url: `https://libraries.minecraft.net/${p}`,
          },
        },
      };
    });
  });
  assert.throws(f.plan, /budget/);
});
test("CLI returns success for verified declared objects without claiming whole-game readiness", async (t) => {
  const dir = await temp(t),
    f = fixture(),
    plan = path.join(dir, "plan.json"),
    root = path.join(dir, "store");
  await materialize(root, f);
  fs.writeFileSync(plan, JSON.stringify(f.plan()));
  const r = spawnSync(
    process.execPath,
    ["scripts/reference-corpus.mjs", "audit", "--plan", plan, "--root", root],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 0);
  const report = JSON.parse(r.stdout);
  assert.equal(report.declaredObjectsVerified, true);
  assert.equal(report.fullCorpusReady, false);
  assert.equal(report.gameParityVerified, false);
});
