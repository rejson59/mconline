import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  inspectJar,
  inspectServerBundle,
  inventoryOfficialArchives,
  EMBEDDED_LIMITS,
} from "./reference-embedded.mjs";
const hash = (raw, alg = "sha1") => createHash(alg).update(raw).digest("hex");
const expected = (raw) => ({ size: raw.length, sha1: hash(raw) });
// Independent, deliberately simple synthetic ZIP writer; never original game bytes.
function crc32(raw) {
  let n = 0xffffffff;
  for (const b of raw) {
    n ^= b;
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
function zip(files, comment = "") {
  const locals = [],
    central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name),
      raw = Buffer.from(file.data ?? "");
    const method = file.method ?? 8,
      flags = 0x800 | (file.descriptor ? 8 : 0);
    const encoded = method === 0 ? raw : deflateRawSync(raw);
    const data = file.trailingCompressed
        ? Buffer.concat([encoded, Buffer.from("junk")])
        : encoded,
      crc = crc32(raw);
    const extra = file.extra ?? Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (!file.descriptor) {
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(raw.length, 22);
    }
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    const descriptor = Buffer.alloc(
      file.descriptor ? (file.signature === false ? 12 : 16) : 0,
    );
    if (descriptor.length) {
      const at = descriptor.length - 12;
      if (at) descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(crc, at);
      descriptor.writeUInt32LE(data.length, at + 4);
      descriptor.writeUInt32LE(raw.length, at + 8);
    }
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50);
    head.writeUInt16LE(0x314, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(flags, 8);
    head.writeUInt16LE(method, 10);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt16LE(extra.length, 30);
    head.writeUInt32LE(offset, 42);
    central.push(head, name, extra);
    locals.push(local, name, extra, data, descriptor);
    offset +=
      local.length +
      name.length +
      extra.length +
      data.length +
      descriptor.length;
  }
  const index = Buffer.concat(central),
    tail = Buffer.alloc(22),
    note = Buffer.from(comment);
  tail.writeUInt32LE(0x06054b50);
  tail.writeUInt16LE(files.length, 8);
  tail.writeUInt16LE(files.length, 10);
  tail.writeUInt32LE(index.length, 12);
  tail.writeUInt32LE(offset, 16);
  tail.writeUInt16LE(note.length, 20);
  return Buffer.concat([...locals, index, tail, note]);
}
const entry = (name = "assets/example/a.json", data = "synthetic") => ({
  name,
  data,
});
function central(raw) {
  return raw.readUInt32LE(raw.length - 6);
}
function bad(edit, files = [entry()]) {
  const raw = zip(files);
  edit(raw, central(raw));
  assert.throws(() => inspectJar(raw, expected(raw)));
}
const lib = zip([
  entry("org/example/Test.class", "fake class, never executed"),
]);
const version = zip([entry("data/example/loot_tables/test.json", "{}")]);
function bundle({
  libBytes = lib,
  libHash = hash(libBytes, "sha256"),
  extra = [],
  libraries = `${libHash}\torg.example:lib:1\torg/example/lib.jar\n`,
  versions = `${hash(version, "sha256")}\t26.3\tserver.jar\n`,
} = {}) {
  return zip([
    entry("META-INF/libraries.list", libraries),
    entry("META-INF/versions.list", versions),
    entry("META-INF/libraries/org/example/lib.jar", libBytes),
    entry("META-INF/versions/server.jar", version),
    ...extra,
  ]);
}

test("stored, deflated, directories, UTF-8 and comments: every byte hashed, deterministic inventory", () => {
  const raw = zip(
    [
      { name: "assets/", method: 0 },
      { ...entry("assets/test/żółć.json", "{}"), method: 0 },
      entry("data/test/a.json"),
      entry("net/Test.class"),
      entry("META-INF/MANIFEST.MF"),
      entry("other.txt"),
    ],
    "synthetic ZIP comment",
  );
  const result = inspectJar(raw, expected(raw));
  assert.equal(result.entries.length, 6);
  assert.equal(result.categories.assets, 1);
  assert.equal(result.categories.directory, 1);
  assert.equal(result.categories.data, 1);
  assert.equal(result.categories.class, 1);
  assert.equal(result.categories.metadata, 1);
  assert.equal(result.categories.other, 1);
  assert.equal(
    result.entries.find((e) => e.name.endsWith("żółć.json")).sha256,
    hash(Buffer.from("{}"), "sha256"),
  );
  assert.deepEqual(result, inspectJar(raw, expected(raw)));
  for (const k of [
    "fullCorpusReady",
    "independentBackupVerified",
    "gameParityVerified",
    "originalsExecuted",
    "storageWrites",
  ])
    assert.equal(result[k], false);
});
test("empty ZIP and empty deflated file are valid", () => {
  for (const raw of [zip([]), zip([entry("empty", "")])])
    assert.ok(inspectJar(raw, expected(raw)));
});
test("signed and unsigned data descriptors", () => {
  for (const signature of [true, false]) {
    const raw = zip([{ ...entry(), descriptor: true, signature }]);
    assert.equal(inspectJar(raw, expected(raw)).entries.length, 1);
  }
});
test("whole source size and SHA-1 checked before ZIP inspection", () => {
  const raw = zip([entry()]);
  for (const desc of [
    { ...expected(raw), size: 0 },
    { size: raw.length, sha1: "0".repeat(40) },
    null,
  ])
    assert.throws(() => inspectJar(raw, desc), /source size\/SHA-1/);
  assert.throws(() => inspectJar(new Uint8Array(raw), expected(raw)), /source/);
});
test("truncated ZIPs and trailing junk fail", () => {
  const original = zip([entry()]);
  for (const raw of [
    Buffer.alloc(0),
    original.subarray(0, 20),
    original.subarray(0, -1),
    Buffer.concat([original, Buffer.from("junk")]),
  ])
    assert.throws(() => inspectJar(raw, expected(raw)));
});
test("entry payload CRC is verified even with a matching caller-provided outer SHA-1", () => {
  bad(
    (raw) => {
      raw[30 + Buffer.byteLength(entry().name)] ^= 1;
    },
    [{ ...entry(), method: 0 }],
  );
});
test("local and central names, sizes, methods and CRC must match", () => {
  for (const at of [6, 8, 14, 18, 22, 30])
    bad((raw) => {
      raw[at] ^= 1;
    });
});
test("encrypted, unsupported method/version, symlinks and multiple disks fail", () => {
  bad((raw, c) => raw.writeUInt16LE(0x801, c + 8));
  bad((raw, c) => raw.writeUInt16LE(99, c + 10));
  bad((raw, c) => raw.writeUInt16LE(45, c + 6));
  bad((raw, c) => raw.writeUInt32LE(0xa1ff0000, c + 38));
  bad((raw, c) => raw.writeUInt16LE(1, c + 34));
  bad((raw) => raw.writeUInt16LE(1, raw.length - 18));
});
test("ZIP64 sentinels rejected explicitly", () => {
  bad((raw, c) => raw.writeUInt32LE(0xffffffff, c + 20));
  bad((raw) => raw.writeUInt16LE(0xffff, raw.length - 12));
});
test("duplicate and unsafe names fail without extraction", () => {
  const duplicate = zip([entry("same"), entry("same")]);
  assert.throws(() => inspectJar(duplicate, expected(duplicate)), /duplicate/);
  for (const name of [
    "../a",
    "/a",
    "a/../b",
    "a//b",
    "a\\b",
    "C:/a",
    "a\u0000b",
    "a%2fb",
    "a/./b",
    "a\nb",
  ]) {
    const raw = zip([entry(name)]);
    assert.throws(() => inspectJar(raw, expected(raw)), /unsafe path/);
  }
});
test("ambiguous/invalid UTF-8 filenames rejected", () => {
  bad((raw, c) => {
    raw[30] = 0xff;
    raw[c + 46] = 0xff;
  });
  bad(
    (raw, c) => {
      raw.writeUInt16LE(0, 6);
      raw.writeUInt16LE(0, c + 8);
    },
    [entry("żółć")],
  );
});
test("overlapping offsets, hidden/unindexed data and bad central counts rejected", () => {
  bad((raw, c) => raw.writeUInt32LE(1, c + 42));
  bad((raw) => {
    raw.writeUInt16LE(0, raw.length - 14);
    raw.writeUInt16LE(0, raw.length - 12);
  });
  bad((raw, c) => raw.writeUInt32LE(c - 1, raw.length - 6));
});
test("declared expansion is bounded before decompression", () => {
  bad((raw, c) => raw.writeUInt32LE(EMBEDDED_LIMITS.entryBytes + 1, c + 24));
  bad((raw, c) => raw.writeUInt32LE(1, c + 24));
});
test("corrupt descriptors fail", () => {
  bad(
    (raw) => {
      const at =
        30 +
        Buffer.byteLength(entry().name) +
        deflateRawSync(Buffer.from(entry().data)).length;
      raw[at + 4] ^= 1;
    },
    [{ ...entry(), descriptor: true }],
  );
});
test("directory entries cannot hide file bytes", () => {
  bad(() => {}, [{ ...entry("directory/", "hidden"), method: 0 }]);
});
test("server bundle lists and all nested JAR entries verified", () => {
  const raw = bundle(),
    result = inspectServerBundle(raw, expected(raw));
  assert.equal(result.nested.length, 2);
  assert.equal(result.nested[0].id, "org.example:lib:1");
  assert.equal(result.nested[0].entries[0].name, "org/example/Test.class");
  assert.equal(result.nested[1].entries[0].category, "data");
  assert.equal(result.fullCorpusReady, false);
});
test("a plain JAR is not a server bundle", () => {
  const raw = zip([entry()]);
  assert.throws(() => inspectServerBundle(raw, expected(raw)), /bundle list/);
});
test("missing, extra and changed nested archives fail", () => {
  for (const raw of [
    bundle({ libraries: "" }),
    bundle({ libHash: "0".repeat(64) }),
    bundle({ extra: [entry("META-INF/libraries/extra.jar", lib)] }),
    bundle({ libraries: `${hash(lib, "sha256")}\tx\tabsent.jar\n` }),
    bundle({ versions: "" }),
  ])
    assert.throws(() => inspectServerBundle(raw, expected(raw)));
});
test("matching nested SHA-256 does not excuse an invalid nested ZIP", () => {
  const raw = bundle({ libBytes: Buffer.from("not a JAR") });
  assert.throws(() => inspectServerBundle(raw, expected(raw)), /ZIP end/);
});
test("unsafe paths, duplicate IDs and malformed bundle rows rejected", () => {
  const row = `${hash(lib, "sha256")}\tx\torg/example/lib.jar\n`;
  for (const libraries of [
    "invalid",
    row + row,
    row.replace("org/example/lib.jar", "../evil.jar"),
    row.replace("\tx\t", "\tbad id\t"),
    row.replace(/\t/g, " "),
    row + "\n",
  ]) {
    const raw = bundle({ libraries });
    assert.throws(() => inspectServerBundle(raw, expected(raw)));
  }
});
function officialFixture() {
  const clientRaw = zip([entry()]),
    serverRaw = bundle();
  const download = (raw, name) => ({
    ...expected(raw),
    url: `https://piston-data.mojang.com/v1/objects/${hash(raw)}/${name}.jar`,
  });
  const assetRaw = Buffer.from(
    JSON.stringify({
      objects: {
        "test/example": { hash: hash(clientRaw), size: clientRaw.length },
      },
    }),
  );
  const libPath = "org/example/lib/1/lib-1.jar";
  const manifestRaw = Buffer.from(
    JSON.stringify({
      id: "26.3",
      type: "release",
      javaVersion: { majorVersion: 25, component: "synthetic" },
      downloads: {
        client: download(clientRaw, "client"),
        server: download(serverRaw, "server"),
      },
      assetIndex: {
        ...expected(assetRaw),
        id: "synthetic",
        url: `https://piston-meta.mojang.com/v1/packages/${hash(assetRaw)}/synthetic.json`,
      },
      libraries: [
        {
          name: "org.example:lib:1",
          downloads: {
            artifact: {
              ...expected(clientRaw),
              path: libPath,
              url: `https://libraries.minecraft.net/${libPath}`,
            },
          },
        },
      ],
    }),
  );
  return {
    input: { clientRaw, serverRaw, manifestRaw, assetRaw },
    pin: {
      version: "26.3",
      manifestSHA1: hash(manifestRaw),
      manifestURL: `https://piston-meta.mojang.com/v1/packages/${hash(manifestRaw)}/26.3.json`,
      clientSHA1: hash(clientRaw),
      clientBytes: clientRaw.length,
    },
  };
}
test("official entry point rebuilds provenance from raw metadata, with test-only synthetic pin", () => {
  const { input, pin } = officialFixture();
  const result = inventoryOfficialArchives(input, pin);
  assert.equal(result.client.entries.length, 1);
  assert.equal(result.server.nested.length, 2);
  assert.equal(result.javaRuntimeInventoryVerified, false);
  assert.equal(result.fullCorpusReady, false);
  assert.throws(
    () => inventoryOfficialArchives(input),
    /Metadata size\/checksum/,
  );
});
test("modified raw metadata, assets, client or server fail provenance/integrity checks", () => {
  const { input, pin } = officialFixture();
  for (const field of ["manifestRaw", "assetRaw", "clientRaw", "serverRaw"]) {
    const changed = Buffer.from(input[field]);
    changed[0] ^= 1;
    assert.throws(() =>
      inventoryOfficialArchives({ ...input, [field]: changed }, pin),
    );
  }
});

test("aggregate declared expansion is bounded across entries before inflating any of them", () => {
  const raw = zip(Array.from({ length: 9 }, (_, i) => entry(`file-${i}`, "")));
  const c = central(raw);
  let p = c;
  for (let i = 0; i < 9; i++) {
    const at = raw.readUInt32LE(p + 42);
    raw.writeUInt32LE(EMBEDDED_LIMITS.entryBytes, at + 22);
    raw.writeUInt32LE(EMBEDDED_LIMITS.entryBytes, p + 24);
    p += 46 + raw.readUInt16LE(p + 28);
  }
  assert.throws(() => inspectJar(raw, expected(raw)), /expanded byte limit/);
});
test("trailing bytes in a DEFLATE stream are rejected", () => {
  const raw = zip([{ ...entry(), trailingCompressed: true }]);
  assert.throws(
    () => inspectJar(raw, expected(raw)),
    /trailing compressed data/,
  );
});
test("unknown well-formed extra fields allowed; ZIP64, alternate names and truncated extras fail", () => {
  for (const id of [0xcafe, 1, 0x7075]) {
    const extra = Buffer.alloc(4);
    extra.writeUInt16LE(id);
    const raw = zip([{ ...entry(), extra }]);
    if (id === 0xcafe) assert.ok(inspectJar(raw, expected(raw)));
    else assert.throws(() => inspectJar(raw, expected(raw)), /unsupported/);
  }
  for (const extra of [Buffer.alloc(3), Buffer.from([0xfe, 0xca, 2, 0])]) {
    const raw = zip([{ ...entry(), extra }]);
    assert.throws(
      () => inspectJar(raw, expected(raw)),
      /truncated extra field/,
    );
  }
});
test("entry-count budget is shared by all nested JARs, not reset per archive", () => {
  const many = zip(
    Array.from({ length: 50000 }, (_, i) => ({
      name: `e${i}`,
      data: "",
      method: 0,
    })),
  );
  const sha256 = hash(many, "sha256");
  const raw = zip([
    entry("META-INF/libraries.list", `${sha256}\tx\tx.jar\n`),
    entry("META-INF/versions.list", `${sha256}\t26.3\tv.jar\n`),
    entry("META-INF/libraries/x.jar", many),
    entry("META-INF/versions/v.jar", many),
  ]);
  assert.throws(
    () => inspectServerBundle(raw, expected(raw)),
    /entry count limit/,
  );
});

test("UTF-8 filename BOM is preserved as a character, not silently stripped", () => {
  const name = "\ufeffresource.txt",
    raw = zip([entry(name)]);
  assert.equal(inspectJar(raw, expected(raw)).entries[0].name, name);
});
test("shared mutable source buffers rejected", () => {
  const raw = zip([entry()]),
    shared = Buffer.from(new SharedArrayBuffer(raw.length));
  raw.copy(shared);
  assert.throws(() => inspectJar(shared, expected(raw)), /source/);
});
test("oversized bundle lists rejected from headers before inflation", () => {
  const raw = zip([entry("META-INF/libraries.list", "")]),
    c = central(raw);
  raw.writeUInt32LE(EMBEDDED_LIMITS.listBytes + 1, 22);
  raw.writeUInt32LE(EMBEDDED_LIMITS.listBytes + 1, c + 24);
  assert.throws(
    () => inspectServerBundle(raw, expected(raw)),
    /oversized bundle list/,
  );
});
