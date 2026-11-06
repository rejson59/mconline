#!/usr/bin/env node
/** Read-only reference audit. Never imports reference data into the game or saves. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const stableJSON = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export function latestRelease(versions) {
  const releases = versions.filter(
    (v) => v.type === "release" && v.stable === true,
  );
  if (!releases.length) throw new Error("No stable release in reference list");
  return releases.sort(
    (a, b) => Date.parse(b.release_time) - Date.parse(a.release_time),
  )[0];
}

/** Expand item tags for semantic comparison; missing/cyclic tags fail closed. */
export function ingredient(value, tags, seen = new Set()) {
  if (Array.isArray(value))
    return [...new Set(value.flatMap((v) => ingredient(v, tags, seen)))].sort();
  let token;
  if (typeof value === "string") token = value;
  else if (value && typeof value.item === "string") token = value.item;
  else if (value && typeof value.tag === "string") token = "#" + value.tag;
  else throw new Error("Unsupported ingredient: " + JSON.stringify(value));
  if (!token.startsWith("#"))
    return [token.includes(":") ? token : "minecraft:" + token];
  const key = token.slice(1).replace(/^minecraft:/, "");
  if (seen.has(key)) throw new Error("Cyclic item tag: " + key);
  if (!Array.isArray(tags[key]?.values))
    throw new Error("Missing item tag: " + key);
  const next = new Set(seen).add(key);
  return [
    ...new Set(
      tags[key].values.flatMap((v) => {
        if (typeof v !== "string")
          throw new Error("Unsupported tag entry: " + JSON.stringify(v));
        return ingredient(v, tags, next);
      }),
    ),
  ].sort();
}

export function normalizeRecipe(recipe, tags) {
  if (
    !["minecraft:crafting_shaped", "minecraft:crafting_shapeless"].includes(
      recipe.type,
    )
  ) {
    throw new Error("Unaudited recipe type: " + recipe.type);
  }
  const result = { ...recipe.result };
  result.id = result.id ?? result.item;
  delete result.item;
  result.count = result.count ?? 1;
  if (!result.id) throw new Error("Missing recipe result ID");
  const extras = Object.fromEntries(
    Object.entries(recipe).filter(
      ([k]) =>
        ![
          "type",
          "result",
          "category",
          "group",
          "pattern",
          "key",
          "ingredients",
        ].includes(k),
    ),
  );
  if (recipe.type.endsWith("shapeless")) {
    if (!Array.isArray(recipe.ingredients))
      throw new Error("Missing shapeless ingredients");
    return {
      type: recipe.type,
      result,
      extras,
      ingredients: recipe.ingredients
        .map((v) => ingredient(v, tags))
        .sort((a, b) => stableJSON(a).localeCompare(stableJSON(b))),
    };
  }
  if (
    !Array.isArray(recipe.pattern) ||
    !recipe.pattern.length ||
    !recipe.pattern.every((r) => typeof r === "string")
  ) {
    throw new Error("Missing shaped pattern");
  }
  let rows = [...recipe.pattern];
  if (!rows[0].length || rows.some((r) => r.length !== rows[0].length))
    throw new Error("Non-rectangular pattern");
  while (rows.length && !rows[0].trim()) rows.shift();
  while (rows.length && !rows.at(-1).trim()) rows.pop();
  if (!rows.length) throw new Error("Empty shaped pattern");
  const left = Math.min(
    ...rows.map((r) => r.search(/\S/)).filter((n) => n >= 0),
  );
  const right = Math.max(...rows.map((r) => r.trimEnd().length));
  const grid = rows.map((r) =>
    [...r.slice(left, right)].map((c) =>
      c === " " ? null : ingredient(recipe.key?.[c], tags),
    ),
  );
  const mirror = grid.map((row) => [...row].reverse());
  return {
    type: recipe.type,
    result,
    extras,
    grid: stableJSON(grid) < stableJSON(mirror) ? grid : mirror,
  };
}

export function compareRecipe(before, after, oldTags = {}, newTags = {}) {
  if (!after) return { status: "missing" };
  try {
    return {
      status:
        stableJSON(normalizeRecipe(before, oldTags)) ===
        stableJSON(normalizeRecipe(after, newTags))
          ? "equivalent"
          : "different",
    };
  } catch (error) {
    return { status: "unverified", reason: error.message };
  }
}

export function indexSummary(index) {
  if (index.truncated !== false || !Array.isArray(index.tree))
    throw new Error("Incomplete asset tree: refusing coverage claim");
  const files = index.tree.filter((e) => e.type === "blob");
  const buckets = {};
  for (const f of files) {
    const category = f.path.startsWith("assets/minecraft/")
      ? f.path.split("/").slice(0, 3).join("/")
      : f.path.startsWith("data/minecraft/")
        ? f.path.split("/").slice(0, 3).join("/")
        : "other";
    buckets[category] = (buckets[category] ?? 0) + 1;
  }
  return {
    files: files.length,
    indexedBytes: files.reduce((n, f) => n + (f.size ?? 0), 0),
    categories: buckets,
    meaning:
      "Path/size index only; NOT a semantic review or download of every file, and NOT compiled game code.",
  };
}

export function verifyArtifact(raw, spec, name = "artifact") {
  if (raw.length !== spec.bytes || sha256(raw) !== spec.sha256)
    throw new Error("Reference integrity mismatch: " + name);
  return JSON.parse(raw);
}

function loadArtifact(lock, name, offline) {
  const spec = lock.artifacts[name];
  const cache = path.join(
    ROOT,
    ".cache/minecraft-reference",
    lock.target,
    name + ".json",
  );
  let raw;
  if (fs.existsSync(cache)) raw = fs.readFileSync(cache);
  else {
    if (offline)
      throw new Error(
        "Missing offline cache: " +
          cache +
          ". Run npm run reference:sync first.",
      );
    const response = execFileSync("gh", ["api", spec.api], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (spec.format === "tree")
      raw = Buffer.from(stableJSON(JSON.parse(response)) + "\n");
    else {
      const entry = JSON.parse(response);
      if (entry.encoding !== "base64" || !entry.content)
        throw new Error("Unsupported GitHub content response: " + name);
      raw = Buffer.from(entry.content, "base64");
    }
  }
  const parsed = verifyArtifact(raw, spec, name);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, raw);
  return parsed;
}

export function audit({ offline = false } = {}) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(ROOT, "docs/java-reference.lock.json"), "utf8"),
  );
  const data = Object.fromEntries(
    Object.keys(lock.artifacts).map((name) => [
      name,
      loadArtifact(lock, name, offline),
    ]),
  );
  const latest = latestRelease(data.versions);
  if (
    latest.id !== lock.target ||
    data.version.id !== lock.target ||
    data.version.stable !== true ||
    data.version.type !== "release"
  ) {
    throw new Error(
      "Target is not the stable release in the pinned release list",
    );
  }
  const types = {};
  for (const r of Object.values(data.recipes))
    types[r.type] = (types[r.type] ?? 0) + 1;
  const fixtures = path.join(
    ROOT,
    ".harness/fixtures/java-refinements-1.20.4/data/minecraft/recipes",
  );
  const comparisons = fs
    .readdirSync(fixtures)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((file) => {
      const name = file.slice(0, -5);
      return {
        name,
        referenceOnly: name === "oak_boat",
        ...compareRecipe(
          JSON.parse(fs.readFileSync(path.join(fixtures, file), "utf8")),
          data.recipes[name],
          {},
          data["item-tags"],
        ),
      };
    });
  const report = {
    schema: 1,
    target: lock.target,
    checkedOn: lock.checkedOn,
    runtimeReference: lock.runtimeReference,
    status: lock.status,
    latestStableInPinnedList: latest.id,
    sources: lock.sources,
    assetIndex: indexSummary(data["asset-index"]),
    recipeCorpus: {
      recipes: Object.keys(data.recipes).length,
      itemTags: Object.keys(data["item-tags"]).length,
      types,
      meaning:
        "All recipe records parsed and counted; NOT all implemented, matched to runtime, or behaviorally tested.",
    },
    legacySample: comparisons,
    boundaries: [
      "No Minecraft JAR installed or executed.",
      "No generated reference data added to the browser bundle.",
      "Old recipe equivalence is not proof of runtime compatibility.",
      "Missing legacy tags are UNVERIFIED, never assumed equivalent.",
      "No saves, servers, backend migrations, IDs or runtime version labels changed.",
    ],
  };
  const dest = path.join(ROOT, "docs/benchmarks/java-26.3-audit.json");
  fs.writeFileSync(dest, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `Target Java ${lock.target}: ${report.assetIndex.files} file paths indexed; ${report.recipeCorpus.recipes} recipes parsed.`,
  );
  console.log(
    "Legacy sample:",
    comparisons.reduce((out, row) => {
      out[row.status] = (out[row.status] ?? 0) + 1;
      return out;
    }, {}),
  );
  console.log(
    "Report:",
    path.relative(ROOT, dest),
    "— migration not completed.",
  );
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== "--offline"))
      throw new Error(
        "Usage: node scripts/audit-java-reference.mjs [--offline]",
      );
    audit({ offline: process.argv.includes("--offline") });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
