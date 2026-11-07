/** Pure verified corpus planner shared with Edge backend; no filesystem or CLI. */
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { PIN, validateManifest } from "./reference-official-pin.mjs";
const SHA1 = /^[a-f0-9]{40}$/;
const isSHA1 = (value) => typeof value === "string" && SHA1.test(value);
const MAX_FILE = 1024 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024 * 1024;
export const stableJSON = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hash = (algorithm, data) =>
  createHash(algorithm).update(data).digest("hex");
const objectMap = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const sizeOK = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_FILE;
export const objectKey = (sha1) => {
  if (!isSHA1(sha1)) throw new Error("Invalid SHA-1");
  return `objects/sha1/${sha1.slice(0, 2)}/${sha1}`;
};
function logicalPath(name) {
  if (
    typeof name !== "string" ||
    !name.length ||
    name.length > 1024 ||
    /[\\\x00-\x1f\x7f:?#%]/.test(name) ||
    name.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Invalid logical path");
  return name;
}
/** Separate source classes; a trusted host alone does not authorize arbitrary URLs. */
export function sourceURL(raw, kind, sha1) {
  if (typeof raw !== "string" || !isSHA1(sha1))
    throw new Error("Missing/invalid source descriptor");
  const u = new URL(raw);
  if (
    u.href !== raw ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash ||
    /[%\\]/.test(raw)
  )
    throw new Error("Noncanonical source URL");
  const p = u.pathname;
  let valid = false;
  if (kind === "metadata") {
    valid =
      u.hostname === "piston-meta.mojang.com" &&
      p.startsWith(`/v1/packages/${sha1}/`) &&
      /^\/v1\/packages\/[a-f0-9]{40}\/[a-zA-Z0-9._-]+\.json$/.test(p);
  } else if (kind === "download") {
    valid =
      u.hostname === "piston-data.mojang.com" &&
      p.startsWith(`/v1/objects/${sha1}/`) &&
      /^\/v1\/objects\/[a-f0-9]{40}\/[a-zA-Z0-9._-]+$/.test(p);
  } else if (kind === "library") {
    valid =
      u.hostname === "libraries.minecraft.net" &&
      /^\/[a-zA-Z0-9_./+\-]+$/.test(p);
    logicalPath(p.slice(1));
  } else if (kind === "asset") {
    valid =
      u.hostname === "resources.download.minecraft.net" &&
      p === `/${sha1.slice(0, 2)}/${sha1}`;
  }
  if (!isSHA1(sha1) || !valid) throw new Error("Untrusted source URL");
  return u.href;
}
function verifiedJSON(raw, expected, max) {
  if (
    !Buffer.isBuffer(raw) ||
    raw.length > max ||
    (expected.size !== undefined && raw.length !== expected.size) ||
    !isSHA1(expected.sha1) ||
    hash("sha1", raw) !== expected.sha1
  )
    throw new Error("Metadata size/checksum mismatch");
  const parsed = JSON.parse(raw.toString("utf8"));
  if (!objectMap(parsed)) throw new Error("Invalid metadata document");
  return parsed;
}

/** Superset of ALL declared library variants, not just libraries for the planner's OS. */
export function buildCorpus(manifestRaw, assetRaw, pin = PIN) {
  const manifest = verifiedJSON(
    manifestRaw,
    { sha1: pin.manifestSHA1 },
    512 * 1024,
  );
  const { index } = validateManifest(manifest, pin);
  if (!manifest.downloads?.server) throw new Error("Missing server download");
  if (
    !Number.isSafeInteger(manifest.javaVersion?.majorVersion) ||
    manifest.javaVersion.majorVersion < 1 ||
    !/^[a-zA-Z0-9._-]+$/.test(manifest.javaVersion?.component ?? "")
  )
    throw new Error("Missing Java runtime requirement");
  const assets = verifiedJSON(assetRaw, index, 2 * 1024 * 1024);
  if (
    !objectMap(assets.objects) ||
    !Object.keys(assets.objects).length ||
    Object.keys(assets.objects).length > 100000
  )
    throw new Error("Invalid asset object map");
  const objects = new Map();
  let references = 0;
  function add(desc, kind, role, name) {
    if (!objectMap(desc) || !isSHA1(desc.sha1) || !sizeOK(desc.size))
      throw new Error("Invalid download descriptor");
    const url = sourceURL(desc.url, kind, desc.sha1);
    const key = objectKey(desc.sha1);
    let entry = objects.get(desc.sha1);
    if (entry && entry.bytes !== desc.size)
      throw new Error("Conflicting content size");
    if (!entry) {
      entry = {
        sha1: desc.sha1,
        bytes: desc.size,
        key,
        sources: [],
        references: [],
      };
      objects.set(desc.sha1, entry);
    }
    if (!entry.sources.includes(url)) entry.sources.push(url);
    entry.references.push({ role, name });
    references++;
  }
  add(
    { sha1: pin.manifestSHA1, size: manifestRaw.length, url: pin.manifestURL },
    "metadata",
    "version-manifest",
    manifest.id,
  );
  add(index, "metadata", "asset-index", String(index.id));
  for (const [name, desc] of Object.entries(manifest.downloads)) {
    if (!/^[a-z][a-z_]*$/.test(name)) throw new Error("Invalid download name");
    add(desc, "download", "version-download", name);
  }
  for (const [name, desc] of Object.entries(assets.objects)) {
    logicalPath(name);
    if (!objectMap(desc)) throw new Error("Invalid asset descriptor");
    add(
      {
        sha1: desc.hash,
        size: desc.size,
        url: `https://resources.download.minecraft.net/${String(desc.hash).slice(0, 2)}/${desc.hash}`,
      },
      "asset",
      "asset",
      name,
    );
  }
  if (
    !Array.isArray(manifest.libraries) ||
    !manifest.libraries.length ||
    manifest.libraries.length > 10000
  )
    throw new Error("Missing/invalid libraries");
  const libraries = [];
  for (const lib of manifest.libraries) {
    if (
      !objectMap(lib) ||
      typeof lib.name !== "string" ||
      !/^[a-zA-Z0-9_.+\-]+:[a-zA-Z0-9_.+\-]+:[a-zA-Z0-9_.+\-]+(?::[a-zA-Z0-9_.+\-]+)?$/.test(
        lib.name,
      ) ||
      !objectMap(lib.downloads)
    )
      throw new Error("Unsupported library declaration");
    if (
      Object.keys(lib.downloads).some(
        (k) => !["artifact", "classifiers"].includes(k),
      )
    )
      throw new Error("Unsupported library download type");
    if (
      lib.rules !== undefined &&
      (!Array.isArray(lib.rules) ||
        lib.rules.some(
          (r) => !objectMap(r) || !["allow", "disallow"].includes(r.action),
        ))
    )
      throw new Error("Invalid library rules");
    if (
      lib.natives !== undefined &&
      (!objectMap(lib.natives) ||
        Object.values(lib.natives).some((v) => typeof v !== "string"))
    )
      throw new Error("Invalid native selector");
    if (
      lib.downloads.classifiers !== undefined &&
      !objectMap(lib.downloads.classifiers)
    )
      throw new Error("Invalid library classifiers");
    const downloads = [
      ...(lib.downloads.artifact ? [["artifact", lib.downloads.artifact]] : []),
      ...Object.entries(lib.downloads.classifiers ?? {}),
    ];
    if (!downloads.length) throw new Error("Library has no declared downloads");
    for (const [classifier, desc] of downloads) {
      if (!/^[a-zA-Z0-9_.+\-]+$/.test(classifier))
        throw new Error("Invalid classifier");
      if (
        !objectMap(desc) ||
        logicalPath(desc.path) !== new URL(desc.url).pathname.slice(1)
      )
        throw new Error("Library path/URL mismatch");
      add(desc, "library", "library", `${lib.name}/${classifier}`);
    }
    libraries.push({
      name: lib.name,
      rules: lib.rules ?? [],
      natives: lib.natives ?? {},
      extract: lib.extract ?? null,
    });
  }
  if (manifest.logging !== undefined) {
    if (!objectMap(manifest.logging))
      throw new Error("Invalid logging declaration");
    for (const [name, config] of Object.entries(manifest.logging)) {
      logicalPath(name);
      if (!objectMap(config) || !objectMap(config.file))
        throw new Error("Invalid logging file");
      add(config.file, "download", "logging-config", name);
    }
  }
  const files = [...objects.values()].sort((a, b) => compare(a.sha1, b.sha1));
  for (const file of files) {
    file.sources.sort();
    file.references.sort((a, b) => compare(stableJSON(a), stableJSON(b)));
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL)
    throw new Error("Corpus exceeds reviewed 8 GiB planning budget");
  const plan = {
    schema: 1,
    target: pin.version,
    scope: "all-declared-version-downloads",
    provenance: {
      manifestURL: pin.manifestURL,
      manifestSHA1: pin.manifestSHA1,
      assetIndexURL: index.url,
      assetIndexSHA1: index.sha1,
    },
    requirements: {
      java: {
        major: manifest.javaVersion.majorVersion,
        component: manifest.javaVersion.component,
      },
      librarySelection:
        "all-declared-variants-including-rule-disabled-and-natives",
      libraries: libraries.sort((a, b) =>
        compare(stableJSON(a), stableJSON(b)),
      ),
    },
    files,
    summary: {
      uniqueObjects: files.length,
      logicalReferences: references,
      assetEntries: Object.keys(assets.objects).length,
      totalBytes,
    },
    pending: [
      "java-runtime-platform-manifests-and-files",
      "embedded-client-resource-inventory",
      "embedded-server-bundle-inventory",
      "private-persistent-transfer",
      "independent-backup-and-restore",
      "execution-and-behavior-comparison",
    ],
    fullCorpusReady: false,
  };
  return { ...plan, planSHA256: hash("sha256", stableJSON(plan)) };
}

export function validatePlan(plan) {
  if (!objectMap(plan)) throw new Error("Invalid plan");
  const { planSHA256, ...body } = plan;
  if (
    planSHA256 !== hash("sha256", stableJSON(body)) ||
    plan.schema !== 1 ||
    !Array.isArray(plan.files) ||
    !plan.files.length ||
    plan.files.length > 200000 ||
    !Array.isArray(plan.pending) ||
    !plan.pending.length ||
    plan.fullCorpusReady !== false
  )
    throw new Error("Invalid or altered plan");
  const seen = new Set();
  for (const f of plan.files) {
    if (
      !objectMap(f) ||
      !isSHA1(f.sha1) ||
      !sizeOK(f.bytes) ||
      f.key !== objectKey(f.sha1) ||
      seen.has(f.sha1)
    )
      throw new Error("Invalid plan object");
    seen.add(f.sha1);
  }
  const total = plan.files.reduce((sum, f) => sum + f.bytes, 0);
  if (
    total > MAX_TOTAL ||
    total !== plan.summary?.totalBytes ||
    plan.summary.uniqueObjects !== plan.files.length
  )
    throw new Error("Invalid plan totals");
}
