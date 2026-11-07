#!/usr/bin/env node
/** Offline corpus inventory/integrity tools. No network, execution, upload or deletion. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PIN } from "./reference-official-pin.mjs";
import { buildCorpus, validatePlan } from "./reference-corpus-core.mjs";
export * from "./reference-corpus-core.mjs";
const MAX_PLAN = 32 * 1024 * 1024;
const ROOT = fileURLToPath(new URL("../", import.meta.url));
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
