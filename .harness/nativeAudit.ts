import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { B } from "../src/game/blocks";
import { I, blockDrops } from "../src/game/items";
import {
  Inventory,
  RECIPES,
  recipeCells,
  type Stack,
} from "../src/game/inventory";

// Independent, deliberately small interpreter for the pinned reference JSON, never used by the game.
const dir = path.resolve(".harness/fixtures/java-1.20.4");
const load = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
const manifest = load("manifest.json");
let checks = 0,
  failed = 0;
const failures: { name: string; actual: unknown; expected: unknown }[] = [];
function eq(name: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++;
    if (failures.length < 30) failures.push({ name, actual, expected });
  }
}
for (const f of manifest.files) {
  const raw = fs.readFileSync(path.join(dir, f.path));
  eq(
    "pinned SHA " + f.path,
    crypto.createHash("sha256").update(raw).digest("hex"),
    f.sha256,
  );
}
const ids: Record<string, number> = {
  oak_planks: B.PLANKS,
  oak_log: B.LOG,
  stick: I.STICK,
  coal: I.COAL,
  iron_ingot: I.IRON,
  gold_ingot: I.GOLD,
  redstone: I.REDSTONE,
  sand: B.SAND,
  gunpowder: I.GUNPOWDER,
  tnt: B.TNT,
  compass: I.COMPASS,
  clock: I.CLOCK,
  campfire: B.CAMPFIRE,
  wheat: I.WHEAT,
  bread: I.BREAD,
  sugar_cane: B.SUGARCANE,
  paper: I.PAPER,
  bucket: I.BUCKET,
  shears: I.SHEARS,
  flint: I.FLINT,
  feather: I.FEATHER,
  arrow: I.ARROW,
  bookshelf: B.BOOKSHELF,
  book: I.BOOK,
  cobblestone: B.COBBLE,
  furnace: B.FURNACE,
  glowstone_dust: I.GLOWSTONE_DUST,
  glowstone: B.GLOWSTONE,
  torch: B.TORCH,
  crafting_table: B.CRAFTING,
  wooden_axe: I.WOOD_AXE,
  bow: I.BOW,
  string: I.STRING,
  oak_stairs: B.OAK_STAIRS_N,
  slime_block: B.SLIME_BLOCK,
  slime_ball: I.SLIME_BALL,
  honeycomb_block: B.HONEYCOMB_BLOCK,
  honeycomb: I.HONEYCOMB,
  gravel: B.GRAVEL,
  coal_ore: B.COAL_ORE,
  diamond_ore: B.DIAMOND_ORE,
  emerald_ore: B.EMERALD_ORE,
  lapis_ore: B.LAPIS_ORE,
  redstone_ore: B.REDSTONE_ORE,
  nether_quartz_ore: B.QUARTZ_ORE,
  diamond: I.DIAMOND,
  emerald: I.EMERALD,
  lapis_lazuli: I.LAPIS,
  quartz: I.QUARTZ,
};
function id(name: string) {
  const result = ids[name.replace("minecraft:", "")];
  if (result === undefined) throw Error("Unmapped native item " + name);
  return result;
}
const tags: Record<string, number> = {
  "minecraft:planks": B.PLANKS,
  "minecraft:logs": B.LOG,
  "minecraft:coals": I.COAL,
  "minecraft:sand": B.SAND,
  "minecraft:stone_crafting_materials": B.COBBLE,
};
function ingredient(value: any): number {
  if (Array.isArray(value)) return ingredient(value[0]);
  if (value.item) return id(value.item);
  if (value.tag in tags) return tags[value.tag];
  throw Error("Unsupported tag " + JSON.stringify(value));
}
function nativeCells(
  r: any,
  cols: number,
  mirror = false,
  ox = 0,
  oy = 0,
): number[] | null {
  if (r.type !== "minecraft:crafting_shaped")
    throw Error("Unexpected reference recipe type");
  const rows: string[] = r.pattern,
    w = rows[0].length,
    h = rows.length;
  if (w + ox > cols || h + oy > cols) return null;
  const out = Array<number>(9).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = rows[y][mirror ? w - 1 - x : x];
      if (c !== " ") out[(oy + y) * 3 + ox + x] = ingredient(r.key[c]);
    }
  return out;
}
function grid(cells: number[]) {
  const inv = new Inventory();
  inv.grid = cells.map((n) => (n ? { id: n, count: 2 } : null));
  return inv;
}
function result(inv: Inventory, table: boolean) {
  const r = inv.gridMatch(table);
  return r ? { id: r.out.id, count: r.out.count } : null;
}
function expected(r: any) {
  return { id: id(r.result.item), count: r.result.count ?? 1 };
}
const recipeNames = manifest.files
  .filter((f: any) => f.path.startsWith("recipes/"))
  .map((f: any) => f.path.slice(8, -5)) as string[];
for (const name of recipeNames) {
  const r = load("recipes/" + name + ".json");
  const want = expected(r);
  for (const cols of [2, 3])
    for (const mirror of [false, true])
      for (let oy = 0; oy <= cols - r.pattern.length; oy++)
        for (let ox = 0; ox <= cols - r.pattern[0].length; ox++) {
          const cells = nativeCells(r, cols, mirror, ox, oy)!;
          const label = `${name} ${cols}x${cols} mirror=${mirror} offset=${ox},${oy}`;
          const inv = grid(cells);
          eq("native shape " + label, result(inv, cols === 3), want);
          const out = inv.craftGrid(cols === 3);
          eq("actual craft output " + label, out, want);
          eq(
            "one unit per used cell " + label,
            inv.grid.map((s) => s?.count ?? 0),
            cells.map((n) => (n ? 1 : 0)),
          );
        }
  const candidates = RECIPES.filter((r) => r.out.id === want.id);
  // Canonical source ingredients and table requirement, not merely a matching result id.
  const canonical = nativeCells(r, 3)!;
  const counts = (cells: number[]) =>
    [
      ...cells
        .filter(Boolean)
        .reduce(
          (m, n) => m.set(n, (m.get(n) ?? 0) + 1),
          new Map<number, number>(),
        ),
    ].sort((a, b) => a[0] - b[0]);
  eq(
    "canonical recipe exists " + name,
    candidates.some(
      (c) =>
        JSON.stringify(counts(recipeCells(c, true) ?? [])) ===
        JSON.stringify(counts(canonical)),
    ),
    true,
  );
  if (r.pattern.length > 2 || r.pattern[0].length > 2) {
    const inv = grid(canonical);
    eq(
      "three-wide/tall recipe not in personal grid " + name,
      result(inv, false)?.id === want.id,
      false,
    );
  }
  const canonicalRecipe = candidates.find(
    (c) =>
      JSON.stringify(counts(recipeCells(c, true) ?? [])) ===
      JSON.stringify(counts(canonical)),
  );
  const book = new Inventory();
  for (const [item, count] of counts(canonical)) book.add(item, count);
  eq(
    "recipe book placement " + name,
    canonicalRecipe ? book.placeRecipe(canonicalRecipe, true) : false,
    true,
  );
  eq("recipe book output " + name, result(book, true), want);
  eq(
    "recipe book does not grant output early " + name,
    book.countOf(want.id),
    0,
  );
  eq("recipe book actual craft " + name, book.craftGrid(true), want);
  eq(
    "recipe book sources consumed once " + name,
    book.slots.every((s) => !s),
    true,
  );
  // A recipe with identical ingredients in a wrong arrangement must not match this output.
  const cells = canonical.slice();
  const occupied = cells.map((n, i) => (n ? i : -1)).filter((n) => n >= 0),
    blank = cells.findIndex((n) => !n);
  if (blank >= 0) {
    const from = occupied[0];
    [cells[from], cells[blank]] = [cells[blank], cells[from]];
    const valid = [nativeCells(r, 3), nativeCells(r, 3, true)].some(
      (v) => JSON.stringify(v) === JSON.stringify(cells),
    );
    if (!valid)
      eq(
        "wrong arrangement rejected " + name,
        result(grid(cells), true)?.id === want.id,
        false,
      );
  }
}
for (const [out, ingredients] of [
  [
    B.TNT,
    [B.SAND, B.SAND, B.SAND, B.SAND, I.COAL, I.COAL, I.COAL, I.COAL, I.COAL],
  ],
  [I.COMPASS, [I.IRON, I.IRON, I.IRON, I.IRON, I.COAL]],
  [I.CLOCK, [I.GOLD, I.GOLD, I.GOLD, I.GOLD, I.COAL]],
  [
    B.BOOKSHELF,
    [B.PLANKS, B.PLANKS, B.PLANKS, B.PLANKS, B.PLANKS, B.PLANKS, B.WOOL_WHITE],
  ],
] as [number, number[]][]) {
  eq(
    "invented ingredient shortcut removed " + out,
    result(
      grid([...ingredients, ...Array(9 - ingredients.length).fill(0)]),
      true,
    )?.id === out,
    false,
  );
  eq(
    "recipe book has no invented shortcut " + out,
    RECIPES.some(
      (r) =>
        r.out.id === out &&
        r.inputs.some(
          (i) => i.id === (out === B.BOOKSHELF ? B.WOOL_WHITE : I.COAL),
        ),
    ),
    false,
  );
}

// Supported loot operations, fail closed on unfamiliar JSON nodes. No explosions in this audit.
type Context = { fortune: number; silk: boolean; random: () => number };
const int = (lo: number, hi: number, c: Context) =>
  hi <= lo ? lo : lo + Math.floor(c.random() * (hi - lo + 1));
function condition(v: any, c: Context): boolean {
  if (v.condition === "minecraft:survives_explosion") return true;
  if (v.condition === "minecraft:match_tool")
    return v.predicate.enchantments.every(
      (e: any) =>
        e.enchantment === "minecraft:silk_touch" &&
        Number(c.silk) >= (e.levels.min ?? 0),
    );
  if (v.condition === "minecraft:table_bonus")
    return c.random() < v.chances[Math.min(c.fortune, v.chances.length - 1)];
  throw Error("Unsupported condition " + v.condition);
}
function entry(v: any, c: Context): Stack[] | null {
  if (!(v.conditions ?? []).every((x: any) => condition(x, c))) return null;
  if (v.type === "minecraft:alternatives") {
    for (const child of v.children) {
      const got = entry(child, c);
      if (got !== null) return got;
    }
    return [];
  }
  if (v.type !== "minecraft:item") throw Error("Unsupported entry " + v.type);
  let count = 1;
  for (const f of v.functions ?? []) {
    if (f.function === "minecraft:set_count")
      count =
        typeof f.count === "number"
          ? f.count
          : int(f.count.min, f.count.max, c);
    else if (f.function === "minecraft:apply_bonus") {
      if (f.formula === "minecraft:ore_drops") {
        if (c.fortune > 0)
          count *= Math.max(0, int(0, c.fortune + 1, c) - 1) + 1;
      } else if (f.formula === "minecraft:uniform_bonus_count")
        count += int(0, c.fortune * f.parameters.bonusMultiplier, c);
      else throw Error("Unsupported bonus " + f.formula);
    } else if (f.function === "minecraft:limit_count") {
      if (f.limit.min !== undefined) count = Math.max(count, f.limit.min);
      if (f.limit.max !== undefined) count = Math.min(count, f.limit.max);
    } else if (f.function !== "minecraft:explosion_decay")
      throw Error("Unsupported function " + f.function);
  }
  return [{ id: id(v.name), count }];
}
function referenceLoot(table: any, c: Context) {
  return table.pools.flatMap((p: any) => {
    if (p.rolls !== 1) throw Error("Unexpected rolls");
    return p.entries.flatMap((e: any) => entry(e, c) ?? []);
  });
}
function stream(a: number, b: number) {
  let n = 0;
  return () => (n++ % 2 ? b : a);
}
const names = [
  "slime_block",
  "honeycomb_block",
  "gravel",
  "glowstone",
  "coal_ore",
  "diamond_ore",
  "emerald_ore",
  "lapis_ore",
  "redstone_ore",
  "nether_quartz_ore",
];
for (const name of names)
  for (const fortune of [0, 1, 2, 3])
    for (const silk of [false, true])
      for (const a of [
        0, 0.099999, 0.1, 0.14285714, 0.14285715, 0.249999, 0.25, 0.333333,
        0.499999, 0.5, 0.666667, 0.75, 0.999999,
      ])
        for (const b of [0, 0.25, 0.5, 0.75, 0.999999]) {
          const table = load("loot_tables/blocks/" + name + ".json"),
            want = referenceLoot(table, {
              fortune,
              silk,
              random: stream(a, b),
            });
          const random = Math.random;
          let actual: Stack[];
          try {
            Math.random = stream(a, b);
            actual = blockDrops(id(name), I.DIAMOND_PICK, { fortune, silk });
          } finally {
            Math.random = random;
          }
          eq(
            `native loot ${name} fortune=${fortune} silk=${silk} random=${a},${b}`,
            actual!,
            want,
          );
        }
for (const fortune of [NaN, Infinity, -Infinity, -3])
  eq(
    "invalid Fortune does not corrupt stacks " + fortune,
    blockDrops(B.DIAMOND_ORE, I.DIAMOND_PICK, { fortune }),
    [{ id: I.DIAMOND, count: 1 }],
  );
{
  const inv = new Inventory(),
    recipe = RECIPES.find((r) => r.out.id === B.SLIME_BLOCK)!;
  inv.add(I.SLIME_BALL, 9);
  eq("slime compression succeeds", inv.craft(recipe), true);
  const drop = blockDrops(B.SLIME_BLOCK, 0);
  eq("slime break preserves compressed block", drop, [
    { id: B.SLIME_BLOCK, count: 1 },
  ]);
  inv.slots.fill(null);
  for (const stack of drop) inv.add(stack.id, stack.count);
  const unpack = RECIPES.find((r) => r.out.id === I.SLIME_BALL)!;
  eq("slime decompression succeeds", inv.craft(unpack), true);
  eq(
    "compression-break-decompression conserves nine balls",
    inv.countOf(I.SLIME_BALL),
    9,
  );
}
const summary = {
  version: "1.20.4",
  reference: manifest.commit,
  checks,
  failed,
  examples: failures,
  scope: {
    recipes: recipeNames,
    loot: names,
    excluded: [
      "full item/tag coverage (canonical oak/coal subset only)",
      "explosion decay",
      "Java PRNG bit sequence",
      "campfire charcoal (item not implemented)",
      "other recipes and loot not in this corpus",
    ],
  },
};
if (process.env.AUDIT_REPORT)
  fs.writeFileSync(
    process.env.AUDIT_REPORT,
    JSON.stringify(summary, null, 2) + "\n",
  );
console.log(`${checks} native reference checks, ${failed} failures`);
for (const f of failures) console.error(JSON.stringify(f));
if (failed) process.exitCode = 1;
