#!/usr/bin/env node
/** Pinned small survival corpus + translated runtime rules. Never copies a JAR. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const lock = JSON.parse(fs.readFileSync("docs/survival-reference.lock.json"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const data = {};
for (const [name, source] of Object.entries(lock.artifacts)) {
  const cache = path.join(".cache/survival-reference", name + ".json");
  let bytes;
  if (fs.existsSync(cache)) bytes = fs.readFileSync(cache);
  else {
    const legacy = path.join(
      ".cache/minecraft-reference",
      lock.target,
      name + ".json",
    );
    if (fs.existsSync(legacy)) bytes = fs.readFileSync(legacy);
    else {
      const api = JSON.parse(
        execFileSync("gh", ["api", source.api], { maxBuffer: 4 * 1024 * 1024 }),
      );
      bytes = Buffer.from(api.content, "base64");
      if (source.gzip) bytes = gunzipSync(bytes);
    }
  }
  if (hash(bytes) !== source.sha256)
    throw Error("Pinned hash mismatch " + name);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, bytes);
  data[name] = JSON.parse(bytes);
}
await build({
  entryPoints: ["scripts/survival-bindings.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".cache/survival-reference/bindings.mjs",
});
const { nativeItems, nativeBlocks } = await import(
  pathToFileURL(path.resolve(".cache/survival-reference/bindings.mjs")).href +
    "?" +
    Date.now()
);
const chosen = [
  ...["wooden", "stone", "iron", "golden", "diamond"].flatMap((m) =>
    ["pickaxe", "axe", "shovel", "sword", "hoe"].map((k) => m + "_" + k),
  ),
  "crafting_table",
  "chest",
  "furnace",
  "brewing_stand",
  "campfire",
  "torch",
  "stick",
  "paper",
  "book",
  "bookshelf",
  "oak_door",
  "oak_trapdoor",
  "oak_fence",
  "ladder",
  "bread",
  "glass_pane",
  "glass_bottle",
  "quartz_block",
  "quartz_pillar",
  "nether_bricks",
  "end_stone_bricks",
  "stone_button",
];
const usedBlockTags = {},
  usedItemTags = {},
  missing = {};
function expand(value, tags, used, seen = new Set()) {
  if (Array.isArray(value))
    return [...new Set(value.flatMap((v) => expand(v, tags, used, seen)))];
  if (!value.startsWith("#")) return [value.replace("minecraft:", "")];
  const key = value.slice(1).replace("minecraft:", "");
  if (seen.has(key) || !tags[key])
    throw Error("Missing/cyclic native tag " + key);
  used[key] = tags[key];
  return expand(tags[key].values, tags, used, new Set([...seen, key]));
}
const nativeRecipes = Object.fromEntries(
  chosen.map((n) => [n, data.recipes[n]]),
);
const recipes = [];
for (const [name, r] of Object.entries(nativeRecipes)) {
  if (!r) throw Error("Missing recipe " + name);
  const choices = {};
  const ingredient = (value) => {
    const members = expand(value, data["item-tags"], usedItemTags);
    const ids = [
      ...new Set(
        members.map((n) => nativeItems[n]).filter((id) => id !== undefined),
      ),
    ];
    const absent = members.filter((n) => nativeItems[n] === undefined);
    if (absent.length) missing[name + ":" + JSON.stringify(value)] = absent;
    if (
      !ids.length ||
      (!Array.isArray(value) && !value.startsWith("#") && absent.length)
    )
      throw Error("Unsupported ingredient " + value);
    const canonical = ids[0];
    if (ids.length > 1) choices[canonical] = ids;
    return canonical;
  };
  const key = r.key
    ? Object.fromEntries(
        Object.entries(r.key).map(([k, v]) => [k, ingredient(v)]),
      )
    : undefined;
  const cells = r.pattern
    ? [...r.pattern.join("")].filter((c) => c !== " ").map((c) => key[c])
    : r.ingredients.map(ingredient);
  const counts = new Map();
  for (const id of cells) counts.set(id, (counts.get(id) ?? 0) + 1);
  const out = nativeItems[r.result.id.replace("minecraft:", "")];
  if (out === undefined) throw Error("Unknown output " + name);
  recipes.push({
    out: { id: out, count: r.result.count ?? 1 },
    inputs: [...counts].map(([id, count]) => ({ id, count })),
    table: r.pattern
      ? r.pattern.length > 2 || r.pattern.some((row) => row.length > 2)
      : cells.length > 4,
    ...(r.pattern ? { pattern: r.pattern, key } : {}),
    ...(Object.keys(choices).length ? { ingredientChoices: choices } : {}),
  });
}
const tools = {},
  nativeTools = {};
for (const name of [
  ...chosen.filter((n) => /_(pickaxe|axe|shovel|sword|hoe)$/.test(n)),
  "shears",
]) {
  const c = data["item-components"][name];
  if (!c?.["minecraft:tool"]) throw Error("Missing native tool " + name);
  nativeTools[name] = c;
  const t = c["minecraft:tool"];
  tools[nativeItems[name]] = {
    maxDamage: c["minecraft:max_damage"],
    defaultSpeed: t.default_mining_speed ?? 1,
    damagePerBlock: t.damage_per_block ?? 1,
    rules: t.rules.map((rule) => {
      const members = expand(rule.blocks, data["block-tags"], usedBlockTags);
      return {
        blocks: Object.entries(nativeBlocks)
          .filter(([, n]) => members.includes(n))
          .map(([id]) => +id),
        ...(rule.speed !== undefined ? { speed: rule.speed } : {}),
        ...(rule.correct_for_drops !== undefined
          ? { correctForDrops: rule.correct_for_drops }
          : {}),
      };
    }),
  };
}
const pickNames = expand(
  "#minecraft:mineable/pickaxe",
  data["block-tags"],
  usedBlockTags,
);
const pickBlocks = Object.entries(nativeBlocks)
  .filter(([, n]) => pickNames.includes(n))
  .map(([id]) => +id);
const dir = ".harness/fixtures/survival-26.3";
fs.mkdirSync(dir, { recursive: true });
const fixtures = {
  "recipes.json": nativeRecipes,
  "item-tags.json": usedItemTags,
  "block-tags.json": usedBlockTags,
  "tool-components.json": nativeTools,
  "bindings.json": { items: nativeItems, blocks: nativeBlocks },
  "unrepresented-tag-members.json": missing,
};
const files = [];
for (const [name, value] of Object.entries(fixtures)) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, name), bytes);
  files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
}
fs.writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify(
    {
      target: lock.target,
      commit: lock.commit,
      sources: lock.artifacts,
      format:
        "Canonical object subsets; file hashes below are not original upstream byte hashes.",
      files,
    },
    null,
    2,
  ) + "\n",
);
const header =
  "// Generated by scripts/sync-survival-reference.mjs. Pinned Java 26.3 " +
  lock.commit +
  "\n// Mojang/Microsoft reference data, NOT project MIT. Supported representations only.\n";
fs.writeFileSync(
  "src/game/art/survivalRecipes.generated.ts",
  header +
    "import type { Recipe } from '../inventory';\nexport const SURVIVAL_RECIPES: Recipe[] = " +
    JSON.stringify(recipes) +
    ";\n",
);
fs.writeFileSync(
  "src/game/art/survivalMining.generated.ts",
  header +
    "export interface NativeMiningTool { maxDamage: number; defaultSpeed: number; damagePerBlock: number; rules: { blocks: number[]; speed?: number; correctForDrops?: boolean }[] }\nexport const NATIVE_MINING_TOOLS: Record<number, NativeMiningTool> = " +
    JSON.stringify(tools) +
    ";\nexport const NATIVE_PICK_BLOCKS: number[] = " +
    JSON.stringify(pickBlocks) +
    ";\n",
);
console.log(
  `${recipes.length} recipes, ${Object.keys(tools).length} tools, ${Object.keys(nativeBlocks).length} block-state bindings; missing native tag members explicitly recorded.`,
);
