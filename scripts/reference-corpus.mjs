#!/usr/bin/env node
/** Offline corpus inventory/integrity tools. No network, execution, upload or deletion. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PIN, validateManifest } from "./probe-reference-network.mjs";

const SHA1 = /^[a-f0-9]{40}$/;
const isSHA1 = (value) => typeof value === "string" && SHA1.test(value);
const MAX_FILE = 1024 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024 * 1024;
const MAX_PLAN = 32 * 1024 * 1024;
const ROOT = fileURLToPath(new URL("../", import.meta.url));
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

/** Read-only audit; filenames from the source are NEVER used as filesystem paths. */
export async function auditCorpus(plan, root) {
  validatePlan(plan);
  const base = path.resolve(root);
  const results = [];
  let rootStatus = "ready";
  try {
    if ((await fs.promises.realpath(base)) !== base)
      rootStatus = "different-or-unreadable";
  } catch (e) {
    rootStatus = e.code === "ENOENT" ? "missing" : "different-or-unreadable";
  }
  for (const file of plan.files) {
    if (rootStatus !== "ready") {
      results.push({ sha1: file.sha1, status: rootStatus });
      continue;
    }
    let handle;
    try {
      let parent = base;
      for (const part of ["", ...file.key.split("/").slice(0, -1)]) {
        parent = path.join(parent, part);
        const stat = await fs.promises.lstat(parent);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error("unsafe-directory");
      }
      const filename = path.join(base, file.key);
      const initial = await fs.promises.lstat(filename);
      if (
        !initial.isFile() ||
        initial.isSymbolicLink() ||
        initial.size !== file.bytes
      )
        throw new Error("wrong-type-or-size");
      handle = await fs.promises.open(
        filename,
        fs.constants.O_RDONLY |
          fs.constants.O_NOFOLLOW |
          fs.constants.O_NONBLOCK,
      );
      const before = await handle.stat();
      if (
        !before.isFile() ||
        before.size !== file.bytes ||
        before.ino !== initial.ino ||
        before.dev !== initial.dev
      )
        throw new Error("wrong-type-or-size");
      const sha1 = createHash("sha1"),
        sha256 = createHash("sha256");
      const buffer = Buffer.alloc(64 * 1024);
      let bytes = 0;
      while (true) {
        const { bytesRead } = await handle.read(
          buffer,
          0,
          Math.min(buffer.length, file.bytes - bytes + 1),
          bytes,
        );
        if (!bytesRead) break;
        bytes += bytesRead;
        if (bytes > file.bytes) throw new Error("changed-during-read");
        sha1.update(buffer.subarray(0, bytesRead));
        sha256.update(buffer.subarray(0, bytesRead));
      }
      const after = await handle.stat();
      if (
        bytes !== file.bytes ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs ||
        sha1.digest("hex") !== file.sha1
      )
        throw new Error("integrity-mismatch");
      results.push({
        sha1: file.sha1,
        status: "verified",
        bytes,
        sha256: sha256.digest("hex"),
      });
    } catch (e) {
      results.push({
        sha1: file.sha1,
        status: e.code === "ENOENT" ? "missing" : "different-or-unreadable",
      });
    } finally {
      await handle?.close();
    }
  }
  const counts = { verified: 0, missing: 0, "different-or-unreadable": 0 };
  for (const r of results) counts[r.status]++;
  return {
    schema: 1,
    scope: "local-declared-object-integrity-only",
    target: plan.target,
    planSHA256: plan.planSHA256,
    counts,
    results,
    declaredObjectsVerified: counts.verified === plan.files.length,
    fullCorpusReady: false,
    pending: plan.pending,
    independentBackupVerified: false,
    gameParityVerified: false,
  };
}

function readLimited(filename, max) {
  const initial = fs.lstatSync(filename);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.size > max)
    throw new Error("Invalid/oversized metadata file");
  const fd = fs.openSync(
    filename,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
  );
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > max)
      throw new Error("Invalid/oversized metadata file");
    const data = Buffer.alloc(stat.size + 1);
    let count = 0,
      n;
    while ((n = fs.readSync(fd, data, count, data.length - count, null)))
      count += n;
    if (count !== stat.size) throw new Error("Metadata changed during read");
    return data.subarray(0, count);
  } finally {
    fs.closeSync(fd);
  }
}
/** Generated metadata only, exclusively in ignored cache, immutable/no-follow output. */
export function savePlan(plan, filename) {
  validatePlan(plan);
  const out = path.resolve(
    ROOT,
    filename ?? `.cache/reference-corpus/${PIN.version}-plan.json`,
  );
  const cache = path.join(ROOT, ".cache");
  if (!out.startsWith(cache + path.sep))
    throw new Error("Plan output must remain in ignored .cache");
  const data = JSON.stringify(plan, null, 2) + "\n";
  if (Buffer.byteLength(data) > MAX_PLAN)
    throw new Error("Plan exceeds metadata budget");
  let parent = path.resolve(ROOT);
  if (fs.realpathSync(parent) !== parent)
    throw new Error("Noncanonical repository path");
  for (const part of path.relative(ROOT, path.dirname(out)).split(path.sep)) {
    parent = path.join(parent, part);
    try {
      fs.mkdirSync(parent, { mode: 0o700 });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const st = fs.lstatSync(parent);
    if (!st.isDirectory() || st.isSymbolicLink())
      throw new Error("Unsafe output directory");
  }
  try {
    fs.writeFileSync(out, data, {
      flag:
        fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_NOFOLLOW,
      mode: 0o600,
    });
  } catch (e) {
    if (
      e.code !== "EEXIST" ||
      readLimited(out, MAX_PLAN).toString("utf8") !== data
    )
      throw new Error("Plan exists or cannot be written; never overwrite");
  }
  return out;
}
export async function main(args) {
  const [command, ...rest] = args;
  if (command === "--help") {
    console.log(
      "Offline only. No downloads/uploads/execution.\nplan --manifest FILE --asset-index FILE [--out .cache/FILE]\naudit --plan FILE [--root DIRECTORY]",
    );
    return 0;
  }
  const allowed =
    command === "plan"
      ? ["--manifest", "--asset-index", "--out"]
      : command === "audit"
        ? ["--plan", "--root"]
        : [];
  if (!allowed.length || rest.length % 2)
    throw new Error("Invalid command/options");
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (
      !allowed.includes(rest[i]) ||
      options[rest[i]] ||
      !rest[i + 1] ||
      rest[i + 1].startsWith("--")
    )
      throw new Error("Unknown/duplicate/missing option");
    options[rest[i]] = rest[i + 1];
  }
  if (command === "plan") {
    const plan = buildCorpus(
      readLimited(options["--manifest"], 512 * 1024),
      readLimited(options["--asset-index"], 2 * 1024 * 1024),
    );
    savePlan(plan, options["--out"]);
    console.log(
      JSON.stringify({
        planSHA256: plan.planSHA256,
        ...plan.summary,
        fullCorpusReady: false,
        pending: plan.pending,
      }),
    );
    return 0;
  }
  const plan = JSON.parse(readLimited(options["--plan"], MAX_PLAN));
  const report = await auditCorpus(
    plan,
    options["--root"] ?? path.join(ROOT, ".cache/reference-private"),
  );
  console.log(JSON.stringify(report));
  return report.declaredObjectsVerified ? 0 : 2;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch {
    console.error(
      "Corpus operation failed: invalid, unsupported or conflicting input. No download, upload, execution or deletion performed.",
    );
    process.exitCode = 1;
  }
}
