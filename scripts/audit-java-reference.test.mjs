import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  latestRelease,
  ingredient,
  normalizeRecipe,
  compareRecipe,
  indexSummary,
  verifyArtifact,
} from "./audit-java-reference.mjs";

const old = {
  type: "minecraft:crafting_shaped",
  pattern: ["XXX", " # ", " # "],
  key: {
    X: { item: "minecraft:gold_ingot" },
    "#": { item: "minecraft:stick" },
  },
  result: { item: "minecraft:golden_pickaxe" },
};
const modern = {
  ...old,
  key: { X: "#minecraft:gold_tool_materials", "#": "minecraft:stick" },
  result: { id: "minecraft:golden_pickaxe", count: 1 },
};
const tags = { gold_tool_materials: { values: ["minecraft:gold_ingot"] } };

test("latest target chooses release date, never a snapshot or lexical version order", () => {
  const versions = [
    {
      id: "26.4-snapshot-7",
      stable: false,
      type: "snapshot",
      release_time: "2026-11-03",
    },
    { id: "26.3", stable: true, type: "release", release_time: "2026-09-15" },
    { id: "26.2", stable: true, type: "release", release_time: "2026-06-16" },
  ];
  assert.equal(latestRelease(versions).id, "26.3");
  assert.throws(() => latestRelease([]), /No stable/);
});
test("old item objects and modern item/tag strings compare semantically", () => {
  assert.equal(compareRecipe(old, modern, {}, tags).status, "equivalent");
});
test("expanding a tag does not hide additional permitted materials", () => {
  assert.equal(
    compareRecipe(
      old,
      modern,
      {},
      {
        gold_tool_materials: {
          values: ["minecraft:gold_ingot", "minecraft:copper_ingot"],
        },
      },
    ).status,
    "different",
  );
});
test("unknown tags are unverified rather than equivalent", () => {
  assert.equal(compareRecipe(old, modern).status, "unverified");
  assert.throws(() => ingredient("#minecraft:missing", {}), /Missing item tag/);
});
test("nested tags expand and alternatives are sorted without discarding ingredient multiplicity", () => {
  const nested = {
    a: { values: ["#minecraft:b", "minecraft:iron_ingot"] },
    b: { values: ["minecraft:gold_ingot"] },
  };
  assert.deepEqual(ingredient("#minecraft:a", nested), [
    "minecraft:gold_ingot",
    "minecraft:iron_ingot",
  ]);
  const r = {
    type: "minecraft:crafting_shapeless",
    ingredients: ["minecraft:stick", "minecraft:stick"],
    result: { id: "minecraft:torch" },
  };
  assert.equal(normalizeRecipe(r, {}).ingredients.length, 2);
  assert.equal(
    compareRecipe(r, { ...r, ingredients: ["minecraft:stick"] }).status,
    "different",
  );
});
test("cycles and unsupported tag entry formats fail closed", () => {
  assert.throws(
    () => ingredient("#a", { a: { values: ["#b"] }, b: { values: ["#a"] } }),
    /Cyclic/,
  );
  assert.throws(
    () =>
      ingredient("#a", {
        a: { values: [{ id: "minecraft:stick", required: false }] },
      }),
    /Unsupported tag/,
  );
});
test("shapeless order and shaped mirroring/offset/renamed symbols are normalized", () => {
  const r = {
    type: "minecraft:crafting_shapeless",
    ingredients: ["minecraft:stick", "minecraft:coal"],
    result: { id: "minecraft:torch" },
  };
  assert.equal(
    compareRecipe(r, { ...r, ingredients: [...r.ingredients].reverse() })
      .status,
    "equivalent",
  );
  const shape = { ...old, pattern: ["X#"], key: old.key };
  const mirrored = { ...old, pattern: ["   ", " #X", "   "], key: old.key };
  assert.equal(compareRecipe(shape, mirrored).status, "equivalent");
});
test("output count/components and unknown mechanical fields must match", () => {
  assert.equal(
    compareRecipe(old, { ...old, result: { ...old.result, count: 2 } }).status,
    "different",
  );
  assert.equal(
    compareRecipe(old, {
      ...old,
      result: { ...old.result, components: { custom_data: { a: 1 } } },
    }).status,
    "different",
  );
  assert.equal(
    compareRecipe(old, { ...old, future_rule: true }).status,
    "different",
  );
});
test("missing recipes, unsupported mechanisms and malformed grids are not successes", () => {
  assert.equal(compareRecipe(old, undefined).status, "missing");
  assert.equal(
    compareRecipe(old, { type: "minecraft:smithing_transform" }).status,
    "unverified",
  );
  assert.equal(
    compareRecipe(old, { ...old, pattern: ["XX", "X"] }).status,
    "unverified",
  );
  assert.equal(
    compareRecipe(old, { ...old, pattern: ["   "] }).status,
    "unverified",
  );
});
test("incomplete trees cannot claim full file indexing", () => {
  const raw = Buffer.from('{"ok":true}');
  const spec = {
    bytes: raw.length,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
  assert.deepEqual(verifyArtifact(raw, spec), { ok: true });
  assert.throws(
    () => verifyArtifact(Buffer.from('{"no":true}'), spec),
    /integrity mismatch/,
  );
  assert.throws(
    () => verifyArtifact(raw, { ...spec, bytes: spec.bytes + 1 }),
    /integrity mismatch/,
  );
  assert.throws(
    () => indexSummary({ truncated: true, tree: [] }),
    /Incomplete/,
  );
  assert.throws(() => indexSummary({ tree: [] }), /Incomplete/);
  assert.equal(
    indexSummary({
      truncated: false,
      tree: [
        { type: "blob", path: "data/minecraft/recipe/a.json", size: 4 },
        { type: "tree", path: "data" },
      ],
    }).files,
    1,
  );
});
test("lock uses immutable commits/checksums and separates migration target from runtime", () => {
  const lock = JSON.parse(
    fs.readFileSync(
      new URL("../docs/java-reference.lock.json", import.meta.url),
    ),
  );
  assert.equal(lock.target, "26.3");
  assert.equal(lock.runtimeReference, "1.20.4");
  assert.equal(lock.status, "migration-target-not-runtime-parity");
  for (const sha of Object.values(lock.sources))
    assert.match(sha, /^[a-f0-9]{40}$/);
  for (const file of Object.values(lock.artifacts)) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.bytes > 0);
    assert.ok(
      Object.values(lock.sources).some((sha) => file.api.includes(sha)),
    );
  }
});
test("committed report includes every legacy sample without pretending boat is implemented", () => {
  const report = JSON.parse(
    fs.readFileSync(
      new URL("../docs/benchmarks/java-26.3-audit.json", import.meta.url),
    ),
  );
  const files = fs.readdirSync(
    new URL(
      "../.harness/fixtures/java-refinements-1.20.4/data/minecraft/recipes/",
      import.meta.url,
    ),
  );
  assert.equal(
    report.legacySample.length,
    files.filter((n) => n.endsWith(".json")).length,
  );
  assert.equal(
    report.legacySample.find((r) => r.name === "oak_boat").referenceOnly,
    true,
  );
  assert.equal(report.target, "26.3");
  assert.equal(report.assetIndex.files, 28111);
  assert.equal(report.recipeCorpus.recipes, 2042);
  assert.equal(
    Object.values(report.recipeCorpus.types).reduce((a, b) => a + b, 0),
    report.recipeCorpus.recipes,
  );
});
