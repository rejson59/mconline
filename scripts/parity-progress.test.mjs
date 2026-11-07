import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateScope,
  overallProgress,
  renderBar,
  unionMembers,
  reverseBindings,
  runtimeRecipe,
  compareCrafting,
} from "./parity-progress.mjs";
const record = (id, state = "partial", weight = null) => ({
  id,
  state,
  weight,
  acceptance: "Full stated behavior",
  evidence: ["src/game/blocks.ts"],
  ...(state === "verified"
    ? { comparison: { target: "26.3", kind: "reference-data" } }
    : {}),
});
const scope = (records = [record("a")], complete = false) => ({
  schema: 1,
  target: "26.3",
  complete,
  records,
});
const items = new Set(["stone", "stone_bricks", "oak_planks", "stick"]);
const bindings = {
  stone: 1,
  stone_bricks: 2,
  planks: 3,
  oak_planks: 3,
  stick: 4,
};
const runtime = {
  out: { id: 2, count: 4 },
  inputs: [{ id: 1, count: 4 }],
  table: false,
  pattern: ["##", "##"],
  key: { "#": 1 },
};
const native = {
  type: "minecraft:crafting_shaped",
  pattern: ["SS", "SS"],
  key: { S: "minecraft:stone" },
  result: { id: "minecraft:stone_bricks", count: 4 },
};
test("open scope never invents global zero or a percent from row counts", () => {
  const p = overallProgress(
    scope([record("done", "verified"), record("todo")]),
  );
  assert.equal(p.percent, null);
  assert.equal(p.remainingPercent, null);
  assert.equal(p.totalWeight, null);
  assert.equal(p.blockers.length, 2);
  assert.match(renderBar(p), /\?{20}/);
});
test("closed scope with uncalibrated weights is still unknown", () =>
  assert.equal(
    overallProgress(scope([record("done", "verified")], true)).percent,
    null,
  ));
test("weights do not bypass an open scope", () =>
  assert.equal(
    overallProgress(scope([record("done", "verified", 10)], false)).percent,
    null,
  ));
test("future closed calibrated scope uses work weights, never equal domains", () => {
  const p = overallProgress(
    scope([record("tiny", "verified", 1), record("large", "partial", 9)], true),
  );
  assert.equal(p.percent, 10);
  assert.equal(p.remainingPercent, 90);
  assert.equal(p.completedWeight, 1);
  assert.equal(p.totalWeight, 10);
});
test("partial and unverified work cannot receive invented half credit", () =>
  assert.equal(
    overallProgress(
      scope([record("a", "partial", 5), record("b", "unverified", 5)], true),
    ).percent,
    0,
  ));
test("hundredths truncate conservatively and the remainder totals 100", () => {
  const p = overallProgress(
    scope([record("a", "verified", 1), record("b", "missing", 2)], true),
  );
  assert.equal(p.percent, 33.33);
  assert.equal(p.remainingPercent, 66.67);
  assert.match(renderBar(p), /33\.33%$/);
});
test("unfinished work cannot round itself to 100%", () =>
  assert.equal(
    overallProgress(
      scope([record("a", "verified", 999999), record("b", "partial", 1)], true),
    ).percent,
    99.99,
  ));
test("100% requires every weighted record verified", () =>
  assert.equal(
    overallProgress(
      scope([record("a", "verified", 3), record("b", "verified", 7)], true),
    ).percent,
    100,
  ));
test("unverified target or merely project regression cannot be verified parity", () => {
  const s = scope([record("a", "verified", 1)], true);
  s.records[0].comparison.target = "1.20.4";
  assert.throws(() => validateScope(s));
  s.records[0].comparison = { target: "26.3", kind: "project-regression" };
  assert.throws(() => validateScope(s));
});
for (const weight of [0, -1, NaN, Infinity, 0.5, "5", undefined])
  test("reject invalid/zero weight " + weight, () =>
    assert.throws(() =>
      validateScope(
        scope(
          [record("a", "partial", weight === undefined ? 1 : weight)].map(
            (r) => (weight === undefined ? { ...r, weight: undefined } : r),
          ),
        ),
      ),
    ),
  );
test("duplicate, unknown state and empty scope cannot shrink the denominator", () => {
  assert.throws(() => validateScope(scope([])));
  assert.throws(() => validateScope(scope([record("a"), record("a")])));
  assert.throws(() => validateScope(scope([record("a", "done")])));
});
test("unsafe numeric totals cannot fabricate precision", () =>
  assert.throws(() =>
    overallProgress(
      scope(
        [
          record("a", "verified", Number.MAX_SAFE_INTEGER),
          record("b", "partial", 1),
        ],
        true,
      ),
    ),
  ));
test("bar validates values and distinguishes unknown from zero", () => {
  assert.match(renderBar({ percent: 0 }), /░{20}.*0\.00/);
  assert.match(renderBar({ percent: 100 }), /█{20}.*100\.00/);
  for (const percent of [-1, 101, NaN, Infinity])
    assert.throws(() => renderBar({ percent }));
});
test("literal unions are read from TypeScript AST, not comments", () => {
  assert.deepEqual(
    unionMembers(
      "// type MobType = 'fake'\nexport type MobType = 'pig' | 'cow';",
      "MobType",
    ),
    ["pig", "cow"],
  );
  assert.throws(() => unionMembers("type MobType = string;", "MobType"));
});
test("only real explicit identities resolve; generic aliases do not become items", () => {
  const reverse = reverseBindings(bindings, items);
  assert.equal(reverse.get(3), "oak_planks");
  assert.equal(reverse.has(99), false);
  assert.throws(() => reverseBindings({ stone: 1, stick: 1 }, items));
});
test("actual shaped counts and output are retained", () =>
  assert.deepEqual(runtimeRecipe(runtime, reverseBindings(bindings, items)), {
    ...native,
    pattern: ["##", "##"],
    key: { "#": "minecraft:stone" },
  }));
test("runtime dot is an empty cell, not a guessed identity", () => {
  const r = {
    ...runtime,
    pattern: ["#.", "#."],
    inputs: [{ id: 1, count: 2 }],
  };
  assert.deepEqual(runtimeRecipe(r, reverseBindings(bindings, items)).pattern, [
    "# ",
    "# ",
  ]);
});
test("pattern/consumption disagreement is not credited", () =>
  assert.throws(
    () =>
      runtimeRecipe(
        { ...runtime, inputs: [{ id: 1, count: 3 }] },
        reverseBindings(bindings, items),
      ),
    /consumption/,
  ));
test("metadata and invalid counts are unverified, never silently dropped", () => {
  for (const stack of [
    { id: 2, count: 4, name: "changed" },
    { id: 2, count: 0 },
    { id: 2, count: 0.5 },
  ])
    assert.throws(() =>
      runtimeRecipe(
        { ...runtime, out: stack },
        reverseBindings(bindings, items),
      ),
    );
});
test("recipe data matches do not inflate from duplicate runtime recipes", () => {
  const r = compareCrafting(
    { stone_bricks: native },
    {},
    [runtime, runtime],
    bindings,
    items,
  );
  assert.equal(r.counts["data-match"], 1);
  assert.equal(r.uniqueMappedSignatures, 1);
  assert.equal(r.runtimeRecords, 2);
});
test("extra native alternatives are differences, not convenient tag narrowing", () => {
  const r = compareCrafting(
    { x: { ...native, key: { S: "#minecraft:materials" } } },
    { materials: { values: ["minecraft:stone", "minecraft:oak_planks"] } },
    [runtime],
    bindings,
    items,
  );
  assert.equal(r.counts["not-matched-in-mapped-subset"], 1);
});
test("missing tags and types outside crafting never become matched", () => {
  const r = compareCrafting(
    {
      tag: { ...native, key: { S: "#minecraft:absent" } },
      smelt: { type: "minecraft:smelting" },
    },
    {},
    [runtime],
    bindings,
    items,
  );
  assert.equal(r.counts["unverified-reference"], 1);
  assert.equal(r.counts["type-not-compared"], 1);
  assert.equal(r.dataMatchIds.length, 0);
});
test("unmapped runtime identity means unverified, not proven missing recipe", () => {
  const r = compareCrafting({ x: native }, {}, [runtime], {}, items);
  assert.equal(r.excludedRuntimeRecords["unmapped-identities"], 1);
  assert.equal(r.counts["not-matched-in-mapped-subset"], 1);
  assert.match(r.meaning, /NOT proof/);
});
test("ingredient multiplicity in shapeless recipes is preserved", () => {
  const r = runtimeRecipe(
    { out: { id: 2, count: 4 }, inputs: [{ id: 1, count: 3 }], table: false },
    reverseBindings(bindings, items),
  );
  assert.equal(r.ingredients.length, 3);
});
test("stored live scope keeps unknown weights and cannot publish a bogus global score", () => {
  const s = JSON.parse(fs.readFileSync("docs/parity-scope.json", "utf8"));
  validateScope(s);
  assert.equal(s.target, "26.3");
  assert.equal(s.complete, false);
  assert.equal(overallProgress(s).percent, null);
  for (const row of s.records)
    for (const p of row.evidence) assert.ok(fs.existsSync(p), p);
});

test("receipt rejects stale source, new unaudited modules and reference changes offline", async () => {
  const { createHash } = await import("node:crypto");
  const { verifyReceipt } = await import("./parity-progress.mjs");
  const digest = (v) => createHash("sha256").update(v).digest("hex");
  const s = scope(),
    lock = { target: "26.3", artifacts: { a: { sha256: "pinned" } } };
  const hashes = { "src/a.ts": digest("actual") };
  const r = {
    schema: 1,
    target: "26.3",
    overall: overallProgress(s),
    reference: { artifactHashes: { a: "pinned" } },
    sourceHashes: hashes,
    sourceFingerprint: digest(JSON.stringify(hashes)),
  };
  assert.equal(
    verifyReceipt(r, s, lock, () => Buffer.from("actual"), ["src/a.ts"]),
    true,
  );
  assert.throws(
    () => verifyReceipt(r, s, lock, () => Buffer.from("changed"), ["src/a.ts"]),
    /Stale/,
  );
  assert.throws(
    () =>
      verifyReceipt(r, s, lock, () => Buffer.from("actual"), ["src/new.ts"]),
    /Missing source/,
  );
  assert.throws(
    () =>
      verifyReceipt(
        { ...r, reference: { artifactHashes: { a: "other" } } },
        s,
        lock,
        () => Buffer.from("actual"),
        [],
      ),
    /reference/,
  );
  assert.throws(
    () =>
      verifyReceipt(
        { ...r, overall: { percent: 50 } },
        s,
        lock,
        () => Buffer.from("actual"),
        [],
      ),
    /progress/,
  );
  assert.throws(
    () =>
      verifyReceipt(
        { ...r, sourceFingerprint: "forged" },
        s,
        lock,
        () => Buffer.from("actual"),
        [],
      ),
    /fingerprint/,
  );
});
