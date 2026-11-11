import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { B, BLOCKS } from "../src/game/blocks";
import {
  I,
  blockDrops,
  durabilityMax,
  miningDamage,
  mineSeconds,
  toolMiningSpeed,
} from "../src/game/items";
import {
  Inventory,
  RECIPES,
  recipeCells,
  type Recipe,
} from "../src/game/inventory";
import { planIngredients } from "../src/game/recipeIngredients";
import { emptyFurnace, tickFurnace } from "../src/game/furnace";
const dir = ".harness/fixtures/survival-26.3/";
const load = (n: string) =>
  JSON.parse(fs.readFileSync(dir + n + ".json", "utf8"));
const manifest = load("manifest"),
  components = load("tool-components"),
  tags = load("block-tags"),
  itemTags = load("item-tags"),
  bindings = load("bindings"),
  nativeRecipes = load("recipes");
let checks = 0,
  failed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    checks++;
    console.log("PASS", name);
  } catch (error) {
    failed++;
    console.error("FAIL", name, error);
  }
};
for (const f of manifest.files)
  test("fixture SHA " + f.path, () =>
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(dir + f.path))
        .digest("hex"),
      f.sha256,
    ),
  );
function expand(value: string | string[], tags: any): string[] {
  if (Array.isArray(value))
    return [...new Set(value.flatMap((v) => expand(v, tags)))];
  if (!value.startsWith("#")) return [value.replace("minecraft:", "")];
  return tags[value.slice(1).replace("minecraft:", "")].values.flatMap(
    (v: string) => expand(v, tags),
  );
}
test("all runtime block states have an explicit reference binding", () => {
  assert.equal(
    Object.keys(bindings.blocks).length,
    BLOCKS.filter(Boolean).length,
  );
  for (const def of BLOCKS.filter(Boolean)) assert.ok(bindings.blocks[def.id]);
});
let matrix = 0;
for (const [name, c] of Object.entries(components) as [string, any][])
  test("native component rules over every represented state: " + name, () => {
    const id = bindings.items[name],
      tool = c["minecraft:tool"];
    assert.equal(durabilityMax(id), c["minecraft:max_damage"]);
    for (const [block, native] of Object.entries(bindings.blocks) as [
      string,
      string,
    ][]) {
      let speed = tool.default_mining_speed ?? 1;
      for (const r of tool.rules)
        if (r.speed !== undefined && expand(r.blocks, tags).includes(native)) {
          speed = r.speed;
          break;
        }
      assert.equal(
        toolMiningSpeed(+block, id),
        speed,
        `${name} / ${native} / state ${block}`,
      );
      matrix++;
    }
  });
for (const [name, r] of Object.entries(nativeRecipes) as [string, any][])
  test(
    "native recipe grid, reflection, translation and actual consumption: " +
      name,
    () => {
      const getIds = (v: string | string[]) =>
        expand(v, itemTags)
          .map((n) => bindings.items[n])
          .filter((n) => n !== undefined);
      for (const alternate of [false, true])
        for (const mirrored of [false, true]) {
          const inv = new Inventory();
          let width = 0,
            height = 0;
          if (r.pattern) {
            height = r.pattern.length;
            width = r.pattern[0].length;
            const ox = 3 - width,
              oy = 3 - height;
            r.pattern.forEach((row: string, y: number) =>
              [...row].forEach((c, x) => {
                if (c !== " ") {
                  const ids = getIds(r.key[c]);
                  inv.grid[(oy + y) * 3 + ox + (mirrored ? width - 1 - x : x)] =
                    { id: ids[alternate ? ids.length - 1 : 0], count: 2 };
                }
              }),
            );
          } else
            r.ingredients.forEach((v: string | string[], i: number) => {
              const ids = getIds(v);
              inv.grid[i] = {
                id: ids[alternate ? ids.length - 1 : 0],
                count: 2,
              };
            });
          const expected = {
            id: bindings.items[r.result.id.replace("minecraft:", "")],
            count: r.result.count ?? 1,
          };
          assert.deepEqual(inv.gridMatch(true)?.out, expected);
          assert.deepEqual(inv.craftGrid(true), expected);
          assert.ok(inv.grid.filter(Boolean).every((s) => s!.count === 1));
          const recipe = RECIPES.find((x) => x.out.id === expected.id)!;
          const hand = recipeCells(recipe, false);
          if (hand) {
            const small = new Inventory();
            hand.forEach((id, i) => {
              if (id) small.grid[i] = { id, count: 1 };
            });
            assert.deepEqual(small.craftGrid(false), expected);
          }
        }
    },
  );
test("mixed stone types work in every stone-tool pattern and a furnace", () => {
  for (const out of [
    I.STONE_PICK,
    I.STONE_AXE,
    I.STONE_SHOVEL,
    I.STONE_SWORD,
    I.STONE_HOE,
    B.FURNACE,
    B.BREWING,
  ]) {
    const recipe = RECIPES.find((r) => r.out.id === out)!,
      inv = new Inventory();
    let i = 0;
    for (const id of recipeCells(recipe, true)!)
      if (id)
        inv.add(id === B.COBBLE ? (i++ % 2 ? B.BLACKSTONE : B.COBBLE) : id, 1);
    assert.ok(inv.canPlaceRecipe(recipe, true));
    assert.ok(inv.placeRecipe(recipe, true));
    assert.equal(inv.craftGrid(true)?.id, out);
  }
});
test("recipe book and aggregate craft consume mixed logs/charcoal rather than canonical oak/coal", () => {
  for (const aggregate of [false, true]) {
    const inv = new Inventory(),
      r = RECIPES.find((r) => r.out.id === B.CAMPFIRE)!;
    inv.add(B.BIRCH_LOG, 1);
    inv.add(B.ACACIA_LOG, 2);
    inv.add(I.CHARCOAL, 1);
    inv.add(I.STICK, 3);
    const before = JSON.stringify(inv);
    assert.ok(inv.canCraft(r));
    assert.ok(inv.canPlaceRecipe(r, true));
    assert.equal(JSON.stringify(inv), before);
    if (aggregate) {
      assert.ok(inv.canCraftToInventory(r));
      assert.ok(inv.craft(r));
      assert.equal(inv.countOf(B.CAMPFIRE), 1);
    } else {
      assert.ok(inv.placeRecipe(r, true));
      assert.deepEqual(inv.craftGrid(true), { id: B.CAMPFIRE, count: 1 });
    }
    assert.equal(
      inv.countOf(B.BIRCH_LOG) +
        inv.countOf(B.ACACIA_LOG) +
        inv.countOf(I.CHARCOAL) +
        inv.countOf(I.STICK),
      0,
    );
  }
});
test("missing ingredients, full output and occupied cursor fail without mutating anything", () => {
  const recipe = RECIPES.find((r) => r.out.id === I.STONE_PICK)!;
  const inv = new Inventory();
  inv.add(B.BLACKSTONE, 2);
  inv.add(I.STICK, 2);
  let before = JSON.stringify(inv);
  assert.equal(inv.canPlaceRecipe(recipe, true), false);
  assert.equal(inv.placeRecipe(recipe, true), false);
  assert.equal(inv.craft(recipe), false);
  assert.equal(JSON.stringify(inv), before);
  inv.add(B.BLACKSTONE, 1);
  inv.cursor = { id: B.DIRT, count: 1 };
  before = JSON.stringify(inv);
  assert.equal(inv.canPlaceRecipe(recipe, true), false);
  assert.equal(inv.placeRecipe(recipe, true), false);
  assert.equal(JSON.stringify(inv), before);
  const full = new Inventory();
  full.slots = Array.from({ length: 36 }, () => ({ id: B.DIRT, count: 64 }));
  full.slots[0] = { id: B.BLACKSTONE, count: 64 };
  full.slots[1] = { id: I.STICK, count: 64 };
  before = JSON.stringify(full);
  assert.equal(full.craft(recipe), false);
  assert.equal(JSON.stringify(full), before);
});
test("tag allocator solves overlapping choices and never reuses one ingredient twice", () => {
  const r: Recipe = {
    out: { id: B.DIRT, count: 1 },
    inputs: [
      { id: B.COBBLE, count: 1 },
      { id: B.BLACKSTONE, count: 1 },
    ],
    table: false,
    ingredientChoices: { [B.COBBLE]: [B.COBBLE, B.BLACKSTONE] },
  };
  const available = [
    { id: B.BLACKSTONE, count: 1 },
    { id: B.COBBLE, count: 1 },
  ];
  assert.ok(planIngredients(r, available));
  assert.equal(planIngredients(r, [{ id: B.BLACKSTONE, count: 1 }]), null);
  assert.deepEqual(available, [
    { id: B.BLACKSTONE, count: 1 },
    { id: B.COBBLE, count: 1 },
  ]);
});
test("recipe placement preserves exact ingredient metadata and returns surplus grid stacks", () => {
  const r = RECIPES.find((r) => r.out.id === I.STONE_PICK)!,
    inv = new Inventory();
  inv.grid[4] = { id: B.BIRCH_LOG, count: 7, name: "kept" };
  inv.add(B.BLACKSTONE, 3, undefined, { unbreaking: 1 }, "material");
  inv.add(I.STICK, 2);
  assert.ok(inv.placeRecipe(r, true));
  assert.equal(inv.countOf(B.BIRCH_LOG), 7);
  for (const s of inv.grid.filter((s) => s?.id === B.BLACKSTONE)) {
    assert.equal(s!.name, "material");
    assert.deepEqual(s!.ench, { unbreaking: 1 });
  }
  assert.equal(inv.craftGrid(true)?.id, I.STONE_PICK);
});
test("native 2x2 recipes no longer unnecessarily demand a crafting table", () => {
  for (const out of [
    B.QUARTZ_BLOCK,
    B.QUARTZ_PILLAR,
    B.NETHER_BRICKS,
    B.END_BRICKS,
  ]) {
    const r = RECIPES.find((r) => r.out.id === out)!,
      inv = new Inventory();
    assert.equal(r.table, false);
    for (const s of r.inputs) inv.add(s.id, s.count);
    assert.ok(inv.placeRecipe(r, false));
    assert.equal(inv.craftGrid(false)?.id, out);
  }
});
test("native speed fixes: beds, wool, flowers, grass, buttons and piston heads", () => {
  for (const bed of [B.BED, B.BED_HEAD_E])
    assert.equal(toolMiningSpeed(bed, I.GOLD_AXE), 1);
  for (const block of [
    B.WOOL_WHITE,
    B.FLOWER_RED,
    B.TALLGRASS,
    B.SUGARCANE,
    B.CROP3,
  ])
    assert.equal(toolMiningSpeed(block, I.WOOD_SWORD), 1);
  for (const block of [B.BUTTON, B.BUTTON_ON, B.PISTON_HEAD])
    assert.equal(toolMiningSpeed(block, I.DIAMOND_PICK), 8);
  assert.equal(toolMiningSpeed(B.LEAVES, I.GOLD_HOE), 12);
  assert.equal(toolMiningSpeed(B.LEAVES, I.SHEARS), 15);
  assert.equal(toolMiningSpeed(B.PUMPKIN, I.WOOD_SWORD), 1.5);
});
test("wrong drop tier must still receive native effective speed (independent component properties)", () => {
  assert.equal(toolMiningSpeed(B.DIAMOND_ORE, I.GOLD_PICK), 12);
  assert.deepEqual(blockDrops(B.DIAMOND_ORE, I.GOLD_PICK), []);
  assert.equal(
    miningDamage(B.DIAMOND_ORE, I.GOLD_PICK),
    12 / BLOCKS[B.DIAMOND_ORE].hardness / 100,
  );
  assert.ok(Math.abs(mineSeconds(B.STONE, I.WOOD_PICK) - 1.15) < 1e-10);
  assert.ok(Math.abs(mineSeconds(B.BED, I.GOLD_AXE) - 0.3) < 1e-10);
});
test("end-to-end inventory survival chain: logs -> stone tool -> raw iron -> furnace -> iron tool -> gold", () => {
  const inv = new Inventory();
  inv.add(B.LOG, 3);
  const make = (out: number, table = true) => {
    const r = RECIPES.find((r) => r.out.id === out)!;
    assert.ok(inv.placeRecipe(r, table), "place " + out);
    const result = inv.craftGrid(table)!;
    assert.equal(result.id, out);
    assert.ok(inv.add(result.id, result.count));
  };
  // Logs already use the project's single oak-plank representation.
  make(B.PLANKS, false);
  make(B.PLANKS, false);
  make(B.PLANKS, false);
  make(B.CRAFTING, false);
  make(I.STICK, false);
  make(I.WOOD_PICK);
  assert.deepEqual(blockDrops(B.IRON_ORE, I.WOOD_PICK), []);
  for (let i = 0; i < 11; i++)
    for (const s of blockDrops(B.BLACKSTONE, I.WOOD_PICK))
      inv.add(s.id, s.count);
  make(B.FURNACE);
  make(I.STONE_PICK);
  const raw = blockDrops(B.IRON_ORE, I.STONE_PICK);
  assert.deepEqual(raw, [{ id: I.RAW_IRON, count: 1 }]);
  for (let i = 0; i < 3; i++)
    for (const s of blockDrops(B.IRON_ORE, I.STONE_PICK))
      inv.add(s.id, s.count);
  assert.equal(inv.countOf(I.RAW_IRON), 3);
  inv.remove(I.RAW_IRON, 3);
  const f = emptyFurnace(0, 65, 0);
  f.input = { id: I.RAW_IRON, count: 3 };
  f.fuel = blockDrops(B.COAL_ORE, I.STONE_PICK)[0];
  tickFurnace(f, 30);
  assert.deepEqual(f.output, { id: I.IRON, count: 3 });
  inv.add(f.output!.id, f.output!.count);
  make(I.STICK, false);
  make(I.IRON_PICK);
  assert.deepEqual(blockDrops(B.GOLD_ORE, I.STONE_PICK), []);
  assert.deepEqual(blockDrops(B.GOLD_ORE, I.IRON_PICK), [
    { id: I.RAW_GOLD, count: 1 },
  ]);
});
console.log(
  `Survival: ${checks} groups PASS / ${failed} FAIL; ${matrix} native tool/block-state speed comparisons`,
);
if (failed) process.exitCode = 1;
