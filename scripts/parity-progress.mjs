#!/usr/bin/env node
/** Read-only progress audit. No runtime, accounts, network or archive writes. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import ts from "typescript";
import { normalizeRecipe, verifyArtifact } from "./audit-java-reference.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const STATES = new Set(["partial", "unverified", "missing", "verified"]);
export function validateScope(scope) {
  if (
    scope.schema !== 1 ||
    typeof scope.target !== "string" ||
    typeof scope.complete !== "boolean" ||
    !Array.isArray(scope.records) ||
    !scope.records.length
  )
    throw Error("Invalid scope");
  const ids = new Set();
  for (const row of scope.records) {
    if (!row.id || ids.has(row.id)) throw Error("Duplicate/missing scope ID");
    ids.add(row.id);
    if (
      !STATES.has(row.state) ||
      !row.acceptance ||
      !Array.isArray(row.evidence) ||
      !row.evidence.length
    )
      throw Error("Invalid capability " + row.id);
    if (
      row.weight !== null &&
      (!Number.isSafeInteger(row.weight) || row.weight <= 0)
    )
      throw Error("Invalid weight " + row.id);
    if (
      row.state === "verified" &&
      (!row.comparison ||
        row.comparison.target !== scope.target ||
        !["reference-data", "original-client"].includes(row.comparison.kind))
    )
      throw Error("Missing matching verification " + row.id);
  }
  return scope;
}
/** No equal-domain averages, invented fractional credit or silent zero for unknowns. */
export function overallProgress(scope) {
  validateScope(scope);
  const blockers = [];
  if (!scope.complete)
    blockers.push("Full requirement inventory is not closed");
  if (scope.records.some((r) => r.weight === null))
    blockers.push("Work weights have not been calibrated");
  if (blockers.length)
    return {
      percent: null,
      remainingPercent: null,
      completedWeight: null,
      totalWeight: null,
      blockers,
    };
  const total = scope.records.reduce((n, r) => n + r.weight, 0);
  if (!Number.isSafeInteger(total)) throw Error("Unsafe total weight");
  const done = scope.records
    .filter((r) => r.state === "verified")
    .reduce((n, r) => n + r.weight, 0);
  // Truncate, not round up unfinished work to 100%. Integer arithmetic is safe.
  if (!Number.isSafeInteger(done * 10000))
    throw Error("Unsafe completed weight");
  const basisPoints = Math.floor((done * 10000) / total);
  return {
    percent: basisPoints / 100,
    remainingPercent: (10000 - basisPoints) / 100,
    completedWeight: done,
    totalWeight: total,
    blockers,
  };
}
export function renderBar(progress) {
  if (progress.percent === null)
    return "[????????????????????] — nieustalony procent całości";
  if (
    !Number.isFinite(progress.percent) ||
    progress.percent < 0 ||
    progress.percent > 100
  )
    throw Error("Invalid percentage");
  const filled = Math.floor(progress.percent / 5);
  return (
    "[" +
    "█".repeat(filled) +
    "░".repeat(20 - filled) +
    "] " +
    progress.percent.toFixed(2) +
    "%"
  );
}
/** Extract literal type members, not comments/regex guesses or line counts. */
export function unionMembers(source, name) {
  const file = ts.createSourceFile(
    "inventory.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const decl = file.statements.find(
    (s) => ts.isTypeAliasDeclaration(s) && s.name.text === name,
  );
  if (!decl || !ts.isUnionTypeNode(decl.type))
    throw Error("Missing literal union " + name);
  return decl.type.types.map((t) => {
    if (!ts.isLiteralTypeNode(t) || !ts.isStringLiteral(t.literal))
      throw Error("Non-literal union " + name);
    return t.literal.text;
  });
}
/** Only pre-existing explicit native bindings, filtered by actual item IDs.
 * Unknown/ambiguous numeric identities are NOT guessed from Polish labels. */
export function reverseBindings(bindings, referenceItems) {
  const reverse = new Map();
  for (const [name, id] of Object.entries(bindings)) {
    if (!referenceItems.has(name)) continue;
    if (!Number.isInteger(id) || id < 0) throw Error("Invalid runtime binding");
    if (reverse.has(id) && reverse.get(id) !== name)
      throw Error("Ambiguous binding " + id);
    reverse.set(id, name);
  }
  return reverse;
}
export function runtimeRecipe(recipe, reverse) {
  const name = (id) => {
    if (!reverse.has(id)) throw Error("Unmapped runtime ID " + id);
    return "minecraft:" + reverse.get(id);
  };
  for (const stack of [recipe.out, ...recipe.inputs]) {
    if (Object.keys(stack).some((k) => !["id", "count"].includes(k)))
      throw Error("Uncompared stack metadata");
    if (!Number.isSafeInteger(stack.count) || stack.count <= 0)
      throw Error("Invalid stack count");
  }
  const out = { id: name(recipe.out.id), count: recipe.out.count };
  if (!Number.isInteger(out.count) || out.count <= 0)
    throw Error("Invalid result count");
  if (recipe.pattern) {
    const used = new Map();
    for (const c of recipe.pattern.join(""))
      if (c !== " " && c !== ".") {
        const id = recipe.key?.[c];
        name(id);
        used.set(id, (used.get(id) ?? 0) + 1);
      }
    const declared = new Map();
    for (const i of recipe.inputs)
      declared.set(i.id, (declared.get(i.id) ?? 0) + i.count);
    if (
      stable([...used].sort((a, b) => a[0] - b[0])) !==
      stable([...declared].sort((a, b) => a[0] - b[0]))
    )
      throw Error("Pattern/consumption mismatch");
    return {
      type: "minecraft:crafting_shaped",
      pattern: recipe.pattern.map((row) => row.replaceAll(".", " ")),
      key: Object.fromEntries(
        [
          ...new Set(
            recipe.pattern.join("").replaceAll(" ", "").replaceAll(".", ""),
          ),
        ].map((c) => [c, name(recipe.key[c])]),
      ),
      result: out,
    };
  }
  const ingredients = [];
  for (const i of recipe.inputs) {
    if (!Number.isInteger(i.count) || i.count <= 0 || i.count > 9)
      throw Error("Invalid ingredient count");
    for (let k = 0; k < i.count; k++) ingredients.push(name(i.id));
  }
  return { type: "minecraft:crafting_shapeless", ingredients, result: out };
}
export function compareCrafting(
  recipes,
  tags,
  runtime,
  bindings,
  referenceItems,
) {
  const reverse = reverseBindings(bindings, referenceItems),
    signatures = new Set(),
    excluded = {};
  for (const r of runtime)
    try {
      signatures.add(stable(normalizeRecipe(runtimeRecipe(r, reverse), {})));
    } catch (e) {
      const reason = e.message.startsWith("Unmapped runtime ID")
        ? "unmapped-identities"
        : e.message;
      excluded[reason] = (excluded[reason] ?? 0) + 1;
    }
  const counts = {},
    matches = [],
    exceptions = [];
  for (const [id, r] of Object.entries(recipes)) {
    let status;
    if (
      !["minecraft:crafting_shaped", "minecraft:crafting_shapeless"].includes(
        r.type,
      )
    )
      status = "type-not-compared";
    else
      try {
        status = signatures.has(stable(normalizeRecipe(r, tags)))
          ? "data-match"
          : "not-matched-in-mapped-subset";
      } catch (e) {
        status = "unverified-reference";
        exceptions.push({ id, reason: e.message });
      }
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === "data-match") matches.push(id);
  }
  return {
    counts,
    dataMatchIds: matches.sort(),
    referenceExceptions: exceptions,
    runtimeRecords: runtime.length,
    uniqueMappedSignatures: signatures.size,
    excludedRuntimeRecords: excluded,
    meaning:
      "Data-shape equality in explicitly mapped crafting subset only. Not original-client execution, crafting behavior, whole-crafting completion or global progress. Not-matched is NOT proof of a missing runtime recipe.",
  };
}
function sourceFiles(dir = path.join(ROOT, "src")) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const p = path.join(dir, entry.name);
      return entry.isDirectory()
        ? sourceFiles(p)
        : /\.tsx?$/.test(entry.name)
          ? [path.relative(ROOT, p)]
          : [];
    })
    .sort();
}
function evidenceBytes(p) {
  if (
    path.isAbsolute(p) ||
    p.split(/[\\/]/).includes("..") ||
    (!["src/", "docs/", ".harness/", "scripts/"].some((prefix) =>
      p.startsWith(prefix),
    ) &&
      p !== "package-lock.json")
  )
    throw Error("Unsafe evidence path " + p);
  const absolute = fs.realpathSync(path.join(ROOT, p));
  if (!absolute.startsWith(ROOT) || !fs.statSync(absolute).isFile())
    throw Error("Unsafe evidence path " + p);
  return fs.readFileSync(absolute);
}
/** Fast CI drift check needs no original cache or network. Full regeneration
 * still requires every pinned reference hash and refuses a truncated tree.
 */
export function verifyReceipt(
  report,
  scope,
  lock,
  read = evidenceBytes,
  requiredSources = sourceFiles(),
) {
  validateScope(scope);
  if (
    report.schema !== 1 ||
    report.target !== lock.target ||
    scope.target !== lock.target
  )
    throw Error("Receipt target mismatch");
  if (stable(report.overall) !== stable(overallProgress(scope)))
    throw Error("Receipt progress mismatch");
  if (
    stable(report.reference.artifactHashes) !==
    stable(
      Object.fromEntries(
        Object.entries(lock.artifacts).map(([name, spec]) => [
          name,
          spec.sha256,
        ]),
      ),
    )
  )
    throw Error("Receipt reference mismatch");
  for (const p of requiredSources)
    if (!Object.hasOwn(report.sourceHashes, p))
      throw Error("Missing source in receipt " + p);
  for (const [p, hash] of Object.entries(report.sourceHashes))
    if (sha(read(p)) !== hash) throw Error("Stale evidence " + p);
  if (sha(stable(report.sourceHashes)) !== report.sourceFingerprint)
    throw Error("Receipt fingerprint mismatch");
  return true;
}
function loadReference(lock) {
  return Object.fromEntries(
    Object.entries(lock.artifacts).map(([name, spec]) => {
      const p = path.join(
        ROOT,
        ".cache/minecraft-reference",
        lock.target,
        name + ".json",
      );
      if (!fs.existsSync(p))
        throw Error(
          "Missing pinned cache; run npm run reference:sync (no archive transfer)",
        );
      return [name, verifyArtifact(fs.readFileSync(p), spec, name)];
    }),
  );
}
function pathNames(tree, prefix) {
  return new Set(
    tree
      .filter(
        (x) =>
          x.type === "blob" &&
          x.path.startsWith(prefix) &&
          x.path.endsWith(".json"),
      )
      .map((x) => x.path.slice(prefix.length, -5)),
  );
}
export async function auditProgress({ check = false } = {}) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(ROOT, "docs/java-reference.lock.json"), "utf8"),
  );
  const scope = validateScope(
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/parity-scope.json"), "utf8"),
    ),
  );
  if (scope.target !== lock.target) throw Error("Scope target mismatch");
  const reference = loadReference(lock);
  if (reference["asset-index"].truncated !== false)
    throw Error("Truncated reference tree");
  if (reference.version.id !== lock.target)
    throw Error("Reference version mismatch");
  const cache = path.join(ROOT, ".cache/parity-progress");
  fs.mkdirSync(cache, { recursive: true });
  const result = await build({
    entryPoints: [path.join(ROOT, "scripts/parity-inventory.ts")],
    bundle: true,
    absWorkingDir: ROOT,
    platform: "node",
    format: "esm",
    write: false,
    metafile: true,
  });
  const bundle = result.outputFiles[0].contents,
    file = path.join(cache, "inventory.mjs");
  fs.writeFileSync(file, bundle);
  const { inventory } = await import(
    pathToFileURL(file).href + "?" + sha(bundle)
  );
  const sourcePaths = new Set([
    ...sourceFiles(),
    ...Object.keys(result.metafile.inputs).filter((p) => p.startsWith("src/")),
    "package-lock.json",
    "scripts/parity-inventory.ts",
    "scripts/parity-progress.test.mjs",
    "scripts/audit-java-reference.mjs",
    "src/game/mobs.ts",
    "src/game/world.ts",
    "docs/parity-scope.json",
    "scripts/parity-progress.mjs",
    "docs/java-reference.lock.json",
  ]);
  for (const row of scope.records)
    for (const evidence of row.evidence) sourcePaths.add(evidence);
  const hashes = {};
  for (const p of [...sourcePaths].sort()) {
    hashes[p] = sha(evidenceBytes(p));
  }
  const tree = reference["asset-index"].tree;
  const itemNames = pathNames(tree, "assets/minecraft/items/");
  const mobs = unionMembers(
    fs.readFileSync(path.join(ROOT, "src/game/mobs.ts"), "utf8"),
    "MobType",
  );
  const biomes = unionMembers(
    fs.readFileSync(path.join(ROOT, "src/game/world.ts"), "utf8"),
    "Biome",
  );
  const { craftingRecipes, explicitRecipeBindings, ...registries } = inventory;
  const report = {
    schema: 1,
    target: lock.target,
    runtimeVersion: inventory.version,
    sourceFingerprint: sha(stable(hashes)),
    sourceHashes: hashes,
    overall: overallProgress(scope),
    reference: {
      sources: lock.sources,
      artifactHashes: Object.fromEntries(
        Object.entries(lock.artifacts).map(([name, spec]) => [
          name,
          spec.sha256,
        ]),
      ),
      blockstateDefinitions: pathNames(tree, "assets/minecraft/blockstates/")
        .size,
      itemDefinitions: itemNames.size,
      recipes: Object.keys(reference.recipes).length,
      recipeTypes: [
        ...new Set(Object.values(reference.recipes).map((r) => r.type)),
      ].sort(),
      meaning:
        "Pinned file/data inventory, not a complete behavior denominator.",
    },
    runtime: {
      ...registries,
      mobTypes: mobs,
      biomeLabels: biomes,
      meaning:
        "Actual registry/type counts. Block states are NOT unique Java blocks; project achievements/commands are NOT equivalent to Java advancement/command coverage. Presence does not earn parity credit.",
    },
    crafting: compareCrafting(
      reference.recipes,
      reference["item-tags"],
      craftingRecipes,
      explicitRecipeBindings,
      itemNames,
    ),
    capabilities: {
      listed: scope.records.length,
      counts: scope.records.reduce((o, r) => {
        o[r.state] = (o[r.state] ?? 0) + 1;
        return o;
      }, {}),
      completeInventory: scope.complete,
      meaning:
        "Open requirement/evidence register, not a fixed number of steps or an equally weighted percentage.",
    },
    boundaries: [
      "No Minecraft client executed",
      "No transfer/archive/backend/account/save changes",
      "No original JSON corpus or bundle copied to report",
      "Recipe data matches and registry counts never substitute for global completion",
      "Unknown global progress is null, not zero; weights remain uncalibrated",
    ],
  };
  const text = JSON.stringify(report, null, 2) + "\n",
    dest = path.join(ROOT, "docs/benchmarks/parity-progress.json");
  if (check) {
    if (!fs.existsSync(dest) || fs.readFileSync(dest, "utf8") !== text)
      throw Error("Stale parity report; run npm run progress:audit");
  } else fs.writeFileSync(dest, text);
  console.log(renderBar(report.overall));
  console.log(
    JSON.stringify(
      {
        runtime: {
          blockStates: inventory.registeredBlockStates,
          creativeBlocks: inventory.creativeBlockEntries,
          items: inventory.registeredItems,
          craftingRecords: craftingRecipes.length,
          mobs: mobs.length,
          biomes: biomes.length,
        },
        crafting: report.crafting.counts,
        capabilities: report.capabilities,
      },
      null,
      2,
    ),
  );
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.length > 1 ||
      args.some((arg) => !["--check", "--check-runtime"].includes(arg))
    )
      throw Error("Usage: parity-progress.mjs [--check|--check-runtime]");
    if (args.includes("--check-runtime")) {
      const load = (p) =>
        JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
      const report = load("docs/benchmarks/parity-progress.json");
      verifyReceipt(
        report,
        load("docs/parity-scope.json"),
        load("docs/java-reference.lock.json"),
      );
      console.log(
        "PASS progress receipt/source/reference drift check (offline)",
      );
      console.log(renderBar(report.overall));
    } else await auditProgress({ check: args.includes("--check") });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
