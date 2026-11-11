#!/usr/bin/env node
/** Small, offline-only, reproducible extraction from the existing pinned cache.
 * Run npm run reference:sync first if the cache is absent. No runtime downloads. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(
  fs.readFileSync(path.join(root, "docs/java-reference.lock.json")),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const load = (name) => {
  const bytes = fs.readFileSync(
    path.join(root, ".cache/minecraft-reference", lock.target, name + ".json"),
  );
  if (hash(bytes) !== lock.artifacts[name].sha256)
    throw Error("Pinned source hash mismatch: " + name);
  return JSON.parse(bytes);
};
const recipes = load("recipes"),
  tags = load("item-tags");
const dir = path.join(root, ".harness/fixtures/report-recipes-26.3");
fs.mkdirSync(dir, { recursive: true });
const manifest = {
  target: lock.target,
  commit: lock.sources.summary,
  repository: "misode/mcmeta",
  format:
    "Canonical JSON objects extracted from hash-verified aggregate source files. Fixture hashes are not upstream original byte hashes.",
  sources: {
    recipes: lock.artifacts.recipes,
    "item-tags": lock.artifacts["item-tags"],
  },
  files: [],
};
const save = (name, object, source, key) => {
  if (!object) throw Error("Missing reference: " + key);
  const bytes = Buffer.from(JSON.stringify(object, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, name + ".json"), bytes);
  manifest.files.push({
    path: name + ".json",
    source,
    key,
    sha256: hash(bytes),
  });
};
for (const name of [
  "golden_pickaxe",
  "golden_axe",
  "golden_shovel",
  "golden_sword",
  "golden_hoe",
  "ladder",
  "oak_fence",
  "lapis_lazuli",
]) {
  save(name, recipes[name], "recipes", name);
}
save(
  "gold_tool_materials",
  tags.gold_tool_materials,
  "item-tags",
  "gold_tool_materials",
);
fs.writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Extracted 8 recipe fixtures and 1 tag; NOT a complete catalog or Java runtime.",
);
