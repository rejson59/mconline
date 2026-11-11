import { cleanStacks } from '../src/game/profile';
import { cleanDrop } from '../src/game/sharedDrops';
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { B, BLOCKS, EMIT } from "../src/game/blocks";
import {
  I,
  ITEMS,
  blockDrops,
  fuelSeconds,
  smeltResult,
  resolveId,
} from "../src/game/items";
import { Inventory, RECIPES } from "../src/game/inventory";
import { COOK_TIME, emptyFurnace, tickFurnace } from "../src/game/furnace";
import { officialItemPixels, hasOfficialItemIcon } from "../src/game/packArt";
import { decodePng } from "../src/game/art/miniPng";
import { JAVA_FURNACE_ITEMS } from "../src/game/art/javaFurnace.generated";

let checks = 0,
  failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++;
    console.error("FAIL", name, { actual, expected });
  }
}
function near(name: string, actual: number, expected: number) {
  eq(name, Math.abs(actual - expected) < 1e-7, true);
}
eq("lit furnace emits Java light level 13", EMIT[B.FURNACE_ON], 13);
const root = path.resolve(".harness/fixtures/java-furnace-1.20.4");
const load = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const manifest = load("manifest.json");
for (const file of manifest.files) {
  const data = fs.readFileSync(path.join(root, file.path));
  eq("original byte count " + file.path, data.length, file.bytes);
  eq(
    "original SHA " + file.path,
    createHash("sha256").update(data).digest("hex"),
    file.sha256,
  );
}
const ids: Record<string, number> = {
  raw_iron: I.RAW_IRON,
  raw_gold: I.RAW_GOLD,
  charcoal: I.CHARCOAL,
  coal: I.COAL,
  iron_ingot: I.IRON,
  gold_ingot: I.GOLD,
  glass: B.GLASS,
  sand: B.SAND,
  cobblestone: B.COBBLE,
  stone: B.STONE,
  porkchop: I.RAW_PORK,
  cooked_porkchop: I.COOKED_PORK,
  iron_ore: B.IRON_ORE,
  gold_ore: B.GOLD_ORE,
};
for (const file of manifest.files.filter((f: { path: string }) =>
  f.path.includes("/recipes/"),
)) {
  const data = load(file.path);
  eq("ordinary smelting type " + file.path, data.type, "minecraft:smelting");
  eq(
    "original cooking duration " + file.path,
    COOK_TIME,
    data.cookingtime / 20,
  );
  const inputs =
    data.ingredient.tag === "minecraft:logs_that_burn"
      ? [B.LOG, B.BIRCH_LOG, B.ACACIA_LOG]
      : data.ingredient.tag === "minecraft:smelts_to_glass"
        ? [B.SAND]
        : [ids[data.ingredient.item.replace("minecraft:", "")]];
  const output = ids[data.result.replace("minecraft:", "")];
  eq(
    "reference output is implemented " + file.path,
    Number.isInteger(output),
    true,
  );
  for (const input of inputs) {
    eq(
      "reference input is implemented " + file.path,
      Number.isInteger(input),
      true,
    );
    eq("native smelting result " + input, smeltResult(input), output);
    const f = emptyFurnace(1, 2, 3);
    f.input = { id: input, count: 1 };
    f.fuel = { id: I.CHARCOAL, count: 1 };
    tickFurnace(f, COOK_TIME - 0.05);
    eq("no early result " + input, f.output, null);
    tickFurnace(f, 0.05);
    eq("exact result at 200 ticks " + input, f.output, {
      id: output,
      count: 1,
    });
    eq("one source consumed " + input, f.input, null);
  }
}

for (const [fuel, seconds] of [
  [I.COAL, 80],
  [I.CHARCOAL, 80],
  [I.BLAZE_ROD, 120],
  [I.LAVA_BUCKET, 1000],
  [B.PLANKS, 15],
  [B.LOG, 15],
  [B.BIRCH_LOG, 15],
  [B.ACACIA_LOG, 15],
  [B.CRAFTING, 15],
  [B.BOOKSHELF, 15],
  [B.LADDER_N, 15],
  [B.DOOR_N, 10],
  [B.OAK_SLAB, 7.5],
  [I.WOOD_PICK, 10],
  [I.STICK, 5],
  [I.BOW, 15],
  [I.SHIELD, 15],
  [I.FISHING_ROD, 15],
])
  eq("Java fuel seconds " + fuel, fuelSeconds(fuel), seconds);
for (const block of [
  B.CAMPFIRE,
  B.CAMPFIRE_OFF,
  B.HAY,
  B.COAL_ORE,
  B.FURNACE,
  B.FURNACE_ON,
  B.OBSIDIAN,
  B.STONE_BRICKS,
  B.ICE,
  B.TALLGRASS,
  B.FLOWER_RED,
  B.FLOWER_YELLOW,
  B.STONE,
  B.SAND,
  I.IRON,
  I.RAW_IRON,
])
  eq("not furnace fuel " + block, fuelSeconds(block), 0);
for (const block of [
  B.WOOL_WHITE,
  B.WOOL_RED,
  B.WOOL_GREEN,
  B.WOOL_BLUE,
  B.WOOL_YELLOW,
  B.WOOL_BLACK,
  ...Array.from({ length: 10 }, (_, i) => B.WOOL_ORANGE + i),
])
  eq("wool fuel " + block, fuelSeconds(block), 5);
for (const block of [B.SOUL_SAND, B.COBBLE_STAIRS_N])
  eq("no invented smelting " + block, smeltResult(block), null);

// Time partition invariance, including long frames and fuel exhaustion exactly on a recipe boundary.
for (const fuel of [I.COAL, I.CHARCOAL])
  for (const dt of [
    1 / 144,
    1 / 60,
    1 / 30,
    0.05,
    0.1,
    0.7,
    1,
    3,
    10,
    80,
    100,
  ]) {
    const f = emptyFurnace(0, 0, 0);
    f.input = { id: I.RAW_IRON, count: 16 };
    f.fuel = { id: fuel, count: 1 };
    let remaining = 100;
    while (remaining > 1e-9) {
      const elapsed = Math.min(dt, remaining);
      tickFurnace(f, elapsed);
      remaining -= elapsed;
    }
    eq("one coal cooks exactly eight " + fuel + "/" + dt, f.output, {
      id: I.IRON,
      count: 8,
    });
    eq("eight sources remain " + dt, f.input, { id: I.RAW_IRON, count: 8 });
    near("spent fuel " + dt, f.burn, 0);
    near("cooled progress " + dt, f.cook, 0);
  }
for (const dt of [1 / 60, 0.05, 1, 7, 160]) {
  const f = emptyFurnace(0, 0, 0);
  f.input = { id: I.RAW_GOLD, count: 16 };
  f.fuel = { id: I.COAL, count: 2 };
  let t = 160;
  while (t > 1e-9) {
    const d = Math.min(dt, t);
    tickFurnace(f, d);
    t -= d;
  }
  eq("second fuel preserves frame fraction " + dt, f.output, {
    id: I.GOLD,
    count: 16,
  });
  eq("second fuel consumed " + dt, f.fuel, null);
}
{
  const f = emptyFurnace(0, 0, 0);
  f.input = { id: I.RAW_IRON, count: 64 };
  f.fuel = { id: I.LAVA_BUCKET, count: 1 };
  tickFurnace(f, 640);
  eq("lava cooks stack", f.output, { id: I.IRON, count: 64 });
  eq("lava leaves bucket", f.fuel, { id: I.BUCKET, count: 1 });
  near("lava retains remaining heat", f.burn, 360);
  tickFurnace(f, 360);
  near("unused heat expires without input", f.burn, 0);
}
for (const output of [
  { id: I.GOLD, count: 1 },
  { id: I.IRON, count: 64 },
]) {
  const f = emptyFurnace(0, 0, 0);
  f.input = { id: I.RAW_IRON, count: 2 };
  f.fuel = { id: I.COAL, count: 1 };
  f.output = { ...output };
  tickFurnace(f, 20);
  eq("blocked output consumes no fuel", f.fuel.count, 1);
  eq("blocked output unchanged", f.output, output);
  eq("blocked input unchanged", f.input.count, 2);
  f.burn = 10;
  f.cook = 0.8;
  tickFurnace(f, 1);
  near("blocked burning clears progress", f.cook, 0);
  near("blocked burning still consumes existing heat", f.burn, 9);
}
{
  const f = emptyFurnace(0, 0, 0);
  f.input = { id: I.RAW_IRON, count: 1 };
  f.cook = 0.8;
  tickFurnace(f, 1);
  near("cold furnace cools at two game ticks per tick", f.cook, 0.6);
  const saved = JSON.stringify({ ...f, burn: 17, burnMax: 32 });
  const restored = JSON.parse(saved);
  tickFurnace(restored, 4);
  eq("legacy normalized progress resumes", restored.output, {
    id: I.IRON,
    count: 1,
  });
  near("legacy remaining heat is not refilled", restored.burn, 13);
  for (const dt of [NaN, Infinity, -1, 0]) {
    const before = JSON.stringify(restored);
    tickFurnace(restored, dt);
    eq("bad dt is inert " + dt, JSON.stringify(restored), before);
  }
}
for (const invalidFuel of [B.OBSIDIAN, B.HAY, B.COAL_ORE, B.CAMPFIRE]) {
  const f = emptyFurnace(0, 0, 0);
  f.input = { id: I.RAW_IRON, count: 1 };
  f.fuel = { id: invalidFuel, count: 1 };
  tickFurnace(f, 100);
  eq("invalid fuel preserved " + invalidFuel, f.fuel, {
    id: invalidFuel,
    count: 1,
  });
  eq("invalid fuel cannot smelt " + invalidFuel, f.output, null);
}

// Original ore JSON's apply_bonus/ore_drops distribution, independent table of outcomes.
const distributions = [[1], [1, 1, 2], [1, 1, 2, 3], [1, 1, 2, 3, 4]];
for (const [name, ore, raw] of [
  ["iron_ore", B.IRON_ORE, I.RAW_IRON],
  ["gold_ore", B.GOLD_ORE, I.RAW_GOLD],
] as const) {
  const children = load("data/minecraft/loot_tables/blocks/" + name + ".json")
    .pools[0].entries[0].children;
  eq(
    "original normal ore output " + name,
    children[1].name,
    "minecraft:" + (name === "iron_ore" ? "raw_iron" : "raw_gold"),
  );
  eq(
    "original ore bonus " + name,
    children[1].functions.find(
      (f: { function: string }) => f.function === "minecraft:apply_bonus",
    ).formula,
    "minecraft:ore_drops",
  );
  for (let fortune = 0; fortune <= 3; fortune++)
    for (let i = 0; i < 20; i++) {
      const draw = (i + 0.5) / 20,
        rand = Math.random;
      Math.random = () => draw;
      try {
        eq(
          "ore drop " + name + "/" + fortune + "/" + i,
          blockDrops(ore, I.DIAMOND_PICK, { fortune }),
          [
            {
              id: raw,
              count:
                distributions[fortune][
                  Math.floor(draw * distributions[fortune].length)
                ],
            },
          ],
        );
        eq(
          "silk keeps ore " + name + "/" + fortune + "/" + i,
          blockDrops(ore, I.DIAMOND_PICK, { fortune, silk: true }),
          [{ id: ore, count: 1 }],
        );
      } finally {
        Math.random = rand;
      }
    }
  eq("hand cannot harvest " + name, blockDrops(ore, 0), []);
  eq("wood cannot harvest " + name, blockDrops(ore, I.WOOD_PICK), []);
}
const campfire = load("data/minecraft/loot_tables/blocks/campfire.json")
  .pools[0].entries[0].children;
for (const block of [B.CAMPFIRE, B.CAMPFIRE_OFF]) {
  eq("native campfire normal drop " + block, blockDrops(block, I.DIAMOND_AXE), [
    {
      id: ids[campfire[1].name.replace("minecraft:", "")],
      count: campfire[1].functions[0].count,
    },
  ]);
  eq(
    "native campfire silk drop " + block,
    blockDrops(block, I.DIAMOND_AXE, { silk: true }),
    [{ id: B.CAMPFIRE, count: 1 }],
  );
}
for (const output of [B.TORCH, B.CAMPFIRE]) {
  const r = RECIPES.find(
    (r) => r.out.id === output && r.inputs.some((s) => s.id === I.CHARCOAL || r.ingredientChoices?.[s.id]?.includes(I.CHARCOAL)),
  )!;
  eq("charcoal recipe exists " + output, !!r, true);
  const inv = new Inventory();
  for (const input of r.inputs) inv.add(r.ingredientChoices?.[input.id]?.includes(I.CHARCOAL) ? I.CHARCOAL : input.id, input.count);
  eq("book places charcoal " + output, inv.placeRecipe(r, r.table), true);
  eq("charcoal grid matches " + output, inv.gridMatch(r.table)?.out, r.out);
  eq("charcoal craft output " + output, inv.craftGrid(r.table), r.out);
  eq("charcoal consumed " + output, inv.grid.filter(Boolean).length, 0);
}
for (const [name, id] of Object.entries({
  charcoal: I.CHARCOAL,
  raw_iron: I.RAW_IRON,
  raw_gold: I.RAW_GOLD,
  coal: I.COAL,
  iron_ingot: I.IRON,
  gold_ingot: I.GOLD,
})) {
  const b64 = JAVA_FURNACE_ITEMS[name];
  const original = fs.readFileSync(
    path.join(root, "assets/minecraft/textures/item/" + name + ".png"),
  );
  eq(
    "embedded original PNG " + name,
    Buffer.from(b64, "base64").equals(original),
    true,
  );
  const image = decodePng(b64);
  eq("original 16x16 " + name, [image.width, image.height], [16, 16]);
  eq("native icon routing " + name, hasOfficialItemIcon(id), true);
  eq("exact original pixels " + name, officialItemPixels(id), image.data);
  const pixels = officialItemPixels(id)!;
  pixels.fill(0);
  eq(
    "cached pixels cannot be corrupted " + name,
    officialItemPixels(id),
    image.data,
  );
}
for (const [alias, id] of Object.entries({
  charcoal: I.CHARCOAL,
  raw_iron: I.RAW_IRON,
  raw_gold: I.RAW_GOLD,
})) {
  eq("new item command alias " + alias, resolveId(alias), id);
  eq("no block ID collision " + alias, !!BLOCKS[id], false);
  eq("new material registered " + alias, ITEMS[id]?.kind, "material");
  eq('new ID fits existing numeric boundary '+alias, id > 493 && id < 512, true);
  eq('multiplayer client drop validator accepts '+alias, cleanDrop({uid:'audit:'+id,owner:'audit',d:'o',stack:{id,count:64},pos:[0,65,0],vel:[0,0,0],created:1,expires:1001})?.stack,{id,count:64});
  const inv = new Inventory();
  inv.add(id, 64);
  const restored = cleanStacks(JSON.parse(JSON.stringify(inv.slots)), 36);
  eq("new material stack save " + alias, restored[0], { id, count: 64 });
}
console.log(
  `${checks} furnace/material/native-icon checks, ${failed} failures`,
);
if (process.env.FURNACE_REPORT) fs.writeFileSync(process.env.FURNACE_REPORT, JSON.stringify({checks,failed,reference:manifest.commit,referenceFiles:manifest.files.length,referenceBytes:manifest.files.reduce((n:number,f:{bytes:number})=>n+f.bytes,0)},null,2)+'\n');
if (failed) process.exit(1);
