/** Offline, bounded JAR inventory. No I/O, extraction, execution or network. */
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { buildCorpus, stableJSON } from "./reference-corpus-core.mjs";
import { PIN } from "./reference-official-pin.mjs";

const MiB = 1024 * 1024;
export const EMBEDDED_LIMITS = Object.freeze({
  archiveBytes: 256 * MiB,
  entryBytes: 128 * MiB,
  expandedBytes: 1024 * MiB,
  entries: 100000,
  listBytes: MiB,
});
const digest = (algorithm, raw) =>
  createHash(algorithm).update(raw).digest("hex");
const fail = (why) => {
  throw new Error(`Embedded archive: ${why}`);
};
const text = (raw) =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n >>> 0;
});
function crc32(raw) {
  let n = 0xffffffff;
  for (const byte of raw) n = (n >>> 8) ^ crcTable[(n ^ byte) & 255];
  return (n ^ 0xffffffff) >>> 0;
}
function logicalPath(name, directory = false) {
  const parts = (directory ? name.slice(0, -1) : name).split("/");
  if (
    !name ||
    name.length > 1024 ||
    /[\\\x00-\x1f\x7f:%?#]/.test(name) ||
    parts.some((p) => !p || p === "." || p === "..")
  )
    fail("unsafe path");
  return name;
}
function category(name) {
  if (name.endsWith("/")) return "directory";
  if (name.startsWith("assets/")) return "assets";
  if (name.startsWith("data/")) return "data";
  if (name.endsWith(".class")) return "class";
  if (name.startsWith("META-INF/")) return "metadata";
  return "other";
}
function verifySource(raw, expected) {
  if (
    !Buffer.isBuffer(raw) ||
    !(raw.buffer instanceof ArrayBuffer) ||
    raw.length > EMBEDDED_LIMITS.archiveBytes ||
    !expected ||
    !Number.isSafeInteger(expected.size) ||
    raw.length !== expected.size ||
    !/^[a-f0-9]{40}$/.test(expected.sha1 ?? "") ||
    digest("sha1", raw) !== expected.sha1
  )
    fail("source size/SHA-1 mismatch");
}
function extras(raw) {
  for (let p = 0; p < raw.length; ) {
    if (p + 4 > raw.length) fail("truncated extra field");
    const id = raw.readUInt16LE(p),
      size = raw.readUInt16LE(p + 2);
    p += 4;
    if (p + size > raw.length) fail("truncated extra field");
    // No alternate names or 64-bit interpretation hidden in extra fields.
    if (id === 1 || id === 0x7075)
      fail("ZIP64/alternate Unicode path unsupported");
    p += size;
  }
}
/** Classic, single-disk ZIP only. Unsupported formats fail, never become an empty inventory. */
function readArchive(raw, budget, visit = () => {}) {
  if (raw.length > EMBEDDED_LIMITS.archiveBytes) fail("archive limit");
  let end = -1;
  for (let p = raw.length - 22; p >= Math.max(0, raw.length - 65557); p--) {
    if (
      raw.readUInt32LE(p) === 0x06054b50 &&
      p + 22 + raw.readUInt16LE(p + 20) === raw.length
    ) {
      end = p;
      break;
    }
  }
  if (end < 0) fail("missing ZIP end");
  const count = raw.readUInt16LE(end + 10);
  const centralBytes = raw.readUInt32LE(end + 12),
    start = raw.readUInt32LE(end + 16);
  if (
    raw.readUInt16LE(end + 4) ||
    raw.readUInt16LE(end + 6) ||
    raw.readUInt16LE(end + 8) !== count ||
    count === 0xffff ||
    centralBytes === 0xffffffff ||
    start === 0xffffffff ||
    start + centralBytes !== end
  )
    fail("multidisk/ZIP64/central bounds");
  if (budget.entries + count > EMBEDDED_LIMITS.entries)
    fail("entry count limit");
  budget.entries += count;
  const entries = [],
    names = new Set();
  let p = start;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || raw.readUInt32LE(p) !== 0x02014b50)
      fail("central header");
    const flags = raw.readUInt16LE(p + 8),
      method = raw.readUInt16LE(p + 10);
    const crc = raw.readUInt32LE(p + 16),
      compressed = raw.readUInt32LE(p + 20);
    const size = raw.readUInt32LE(p + 24),
      n = raw.readUInt16LE(p + 28);
    const x = raw.readUInt16LE(p + 30),
      comment = raw.readUInt16LE(p + 32);
    const offset = raw.readUInt32LE(p + 42),
      next = p + 46 + n + x + comment;
    const mode = raw.readUInt32LE(p + 38) >>> 16,
      type = mode & 0xf000;
    if (
      next > end ||
      raw.readUInt16LE(p + 34) ||
      raw.readUInt16LE(p + 6) > 20 ||
      flags & ~0x080e ||
      ![0, 8].includes(method) ||
      (method === 0 && flags & 6) ||
      ![0, 0x4000, 0x8000].includes(type) ||
      compressed === 0xffffffff ||
      size === 0xffffffff ||
      offset === 0xffffffff
    )
      fail("unsupported ZIP entry");
    const nameRaw = raw.subarray(p + 46, p + 46 + n);
    if (!(flags & 0x0800) && nameRaw.some((byte) => byte > 127))
      fail("ambiguous filename encoding");
    const name = text(nameRaw),
      directory = name.endsWith("/");
    logicalPath(name, directory);
    if (names.has(name)) fail("duplicate path");
    names.add(name);
    if (
      ["META-INF/libraries.list", "META-INF/versions.list"].includes(name) &&
      size > EMBEDDED_LIMITS.listBytes
    )
      fail("oversized bundle list");
    if (
      (type === 0x4000 && !directory) ||
      (type === 0x8000 && directory) ||
      (directory && (size || compressed || crc))
    )
      fail("invalid directory entry");
    extras(raw.subarray(p + 46 + n, p + 46 + n + x));
    if (
      size > EMBEDDED_LIMITS.entryBytes ||
      budget.bytes + size > EMBEDDED_LIMITS.expandedBytes
    )
      fail("expanded byte limit");
    budget.bytes += size;
    if (
      offset + 30 > start ||
      raw.readUInt32LE(offset) !== 0x04034b50 ||
      raw.readUInt16LE(offset + 4) > 20 ||
      raw.readUInt16LE(offset + 6) !== flags ||
      raw.readUInt16LE(offset + 8) !== method
    )
      fail("local header");
    const ln = raw.readUInt16LE(offset + 26),
      lx = raw.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + ln + lx,
      dataEnd = dataStart + compressed;
    if (
      dataEnd > start ||
      !raw.subarray(offset + 30, offset + 30 + ln).equals(nameRaw)
    )
      fail("local name/bounds mismatch");
    extras(raw.subarray(offset + 30 + ln, dataStart));
    const localCRC = raw.readUInt32LE(offset + 14),
      localC = raw.readUInt32LE(offset + 18);
    const localSize = raw.readUInt32LE(offset + 22);
    let localEnd = dataEnd;
    if (flags & 8) {
      if (
        (localCRC && localCRC !== crc) ||
        (localC && localC !== compressed) ||
        (localSize && localSize !== size)
      )
        fail("local descriptor mismatch");
      // Descriptor signature is optional; CRC may itself equal the signature.
      const validDescriptor = (at) =>
        at + 12 <= start &&
        raw.readUInt32LE(at) === crc &&
        raw.readUInt32LE(at + 4) === compressed &&
        raw.readUInt32LE(at + 8) === size;
      if (validDescriptor(dataEnd)) localEnd += 12;
      else if (
        dataEnd + 4 <= start &&
        raw.readUInt32LE(dataEnd) === 0x08074b50 &&
        validDescriptor(dataEnd + 4)
      )
        localEnd += 16;
      else fail("data descriptor mismatch");
    } else if (localCRC !== crc || localC !== compressed || localSize !== size)
      fail("local size/CRC mismatch");
    entries.push({
      name,
      method,
      crc,
      size,
      compressed,
      offset,
      dataStart,
      dataEnd,
      localEnd,
    });
    p = next;
  }
  if (p !== end) fail("central count/size mismatch");
  // Reject overlap, hidden local entries, prefix/suffix payloads and gaps.
  let cursor = 0;
  for (const e of [...entries].sort((a, b) => a.offset - b.offset)) {
    if (e.offset !== cursor) fail("overlapping or unindexed local data");
    cursor = e.localEnd;
  }
  if (cursor !== start) fail("unindexed local data");
  const records = [];
  for (const e of entries) {
    const compressed = raw.subarray(e.dataStart, e.dataEnd);
    let data;
    if (e.method === 0) data = compressed;
    else {
      const result = inflateRawSync(compressed, {
        maxOutputLength: Math.max(1, e.size),
        info: true,
      });
      if (result.engine.bytesWritten !== compressed.length)
        fail("trailing compressed data");
      data = result.buffer;
    }
    if (data.length !== e.size || crc32(data) !== e.crc)
      fail("entry size/CRC mismatch");
    const record = {
      name: e.name,
      category: category(e.name),
      bytes: data.length,
      sha256: digest("sha256", data),
    };
    records.push(record);
    visit(record, data);
  }
  return records.sort((a, b) => compare(a.name, b.name));
}
function finish(raw, entries, nested = []) {
  const categories = {};
  for (const e of entries)
    categories[e.category] = (categories[e.category] ?? 0) + 1;
  const body = {
    schema: 1,
    scope: "verified-embedded-jar-inventory",
    source: {
      bytes: raw.length,
      sha1: digest("sha1", raw),
      sha256: digest("sha256", raw),
    },
    entries,
    categories,
    nested,
    fullCorpusReady: false,
    independentBackupVerified: false,
    gameParityVerified: false,
    originalsExecuted: false,
    storageWrites: false,
  };
  return { ...body, inventorySHA256: digest("sha256", stableJSON(body)) };
}
/** A descriptor is an integrity expectation, NOT proof of official provenance. */
export function inspectJar(raw, expected) {
  verifySource(raw, expected);
  return finish(raw, readArchive(raw, { entries: 0, bytes: 0 }));
}
function bundleList(raw, prefix) {
  if (!raw || raw.length > EMBEDDED_LIMITS.listBytes)
    fail("missing/oversized bundle list");
  const lines = text(raw).split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const names = new Set(),
    ids = new Set();
  return lines.map((line) => {
    const fields = line.split("\t");
    if (
      fields.length !== 3 ||
      !/^[a-f0-9]{64}$/.test(fields[0]) ||
      !/^[a-zA-Z0-9_.:+\-]+$/.test(fields[1])
    )
      fail("invalid bundle list row");
    const [sha256, id, relative] = fields;
    logicalPath(relative);
    if (!relative.endsWith(".jar") || names.has(relative) || ids.has(id))
      fail("duplicate/invalid bundle reference");
    names.add(relative);
    ids.add(id);
    return { name: `${prefix}${relative}`, id, sha256 };
  });
}
/** Validates both bundle lists, every referenced nested JAR and all nested entry bytes. */
export function inspectServerBundle(raw, expected) {
  verifySource(raw, expected);
  const budget = { entries: 0, bytes: 0 },
    lists = new Map(),
    nested = [];
  const prefixes = ["META-INF/libraries/", "META-INF/versions/"];
  const entries = readArchive(raw, budget, (record, bytes) => {
    if (
      ["META-INF/libraries.list", "META-INF/versions.list"].includes(
        record.name,
      )
    ) {
      if (bytes.length > EMBEDDED_LIMITS.listBytes)
        fail("oversized bundle list");
      lists.set(record.name, bytes);
    }
    if (
      prefixes.some((prefix) => record.name.startsWith(prefix)) &&
      !record.name.endsWith("/")
    ) {
      if (!record.name.endsWith(".jar")) fail("unsupported bundled file");
      nested.push({
        name: record.name,
        sha256: record.sha256,
        entries: readArchive(bytes, budget),
      });
    }
  });
  const declared = [
    ...bundleList(lists.get("META-INF/libraries.list"), prefixes[0]),
    ...bundleList(lists.get("META-INF/versions.list"), prefixes[1]),
  ];
  if (!declared.some((e) => e.name.startsWith(prefixes[1])))
    fail("missing embedded server version");
  const byName = new Map(nested.map((e) => [e.name, e]));
  if (declared.length !== nested.length) fail("unlisted/missing bundled JAR");
  for (const ref of declared) {
    const jar = byName.get(ref.name);
    if (!jar || jar.sha256 !== ref.sha256)
      fail("bundled JAR checksum/reference mismatch");
    jar.id = ref.id;
  }
  nested.sort((a, b) => compare(a.name, b.name));
  return finish(raw, entries, nested);
}
/** Production provenance starts from pinned RAW metadata, never a caller-supplied plan digest. */
export function inventoryOfficialArchives(
  { manifestRaw, assetRaw, clientRaw, serverRaw },
  pin = PIN,
) {
  const plan = buildCorpus(manifestRaw, assetRaw, pin);
  const descriptor = (role) => {
    const file = plan.files.find((f) =>
      f.references.some(
        (r) => r.role === "version-download" && r.name === role,
      ),
    );
    if (!file) fail("missing official archive descriptor");
    return { sha1: file.sha1, size: file.bytes };
  };
  return {
    schema: 1,
    scope: "pinned-official-client-and-server-embedded-inventory",
    planSHA256: plan.planSHA256,
    client: inspectJar(clientRaw, descriptor("client")),
    server: inspectServerBundle(serverRaw, descriptor("server")),
    javaRuntimeInventoryVerified: false,
    fullCorpusReady: false,
    independentBackupVerified: false,
    gameParityVerified: false,
  };
}
