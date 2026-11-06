import { B } from "./blocks";
import { I } from "./items";
import type { Recipe } from "./inventory";
import { JAVA_REFINEMENT_RECIPES } from "./art/javaRecipes.generated";
/** Explicit supported representatives for native tags. No runtime downloads. */
export const NATIVE_RECIPE_IDS: Record<string, number> = {
  golden_pickaxe: I.GOLD_PICK,
  golden_axe: I.GOLD_AXE,
  golden_shovel: I.GOLD_SHOVEL,
  golden_sword: I.GOLD_SWORD,
  golden_hoe: I.GOLD_HOE,
  iron_ingot: I.IRON,
  gold_ingot: I.GOLD,
  iron_nugget: I.IRON_NUGGET,
  gold_nugget: I.GOLD_NUGGET,
  copper_ingot: I.COPPER,
  amethyst_shard: I.AMETHYST,
  brick: I.BRICK_ITEM,
  bricks: B.BRICK,
  clay_ball: I.CLAY_BALL,
  honey_block: B.HONEY_BLOCK,
  honey_bottle: I.HONEY_BOTTLE,
  glass_bottle: I.BOTTLE,
  stick: I.STICK,
  string: I.STRING,
  fishing_rod: I.FISHING_ROD,
  spyglass: I.SPYGLASS,
  torch: B.TORCH,
  lantern: B.LANTERN,
  stone: B.STONE,
  stone_bricks: B.STONE_BRICKS,
  sand: B.SAND,
  sandstone: B.SANDSTONE,
  white_wool: B.WOOL_WHITE,
  red_wool: B.WOOL_RED,
  red_bed: B.BED,
  planks: B.PLANKS,
  oak_planks: B.PLANKS,
  lever: B.LEVER,
  cobblestone: B.COBBLE,
  observer: B.OBSERVER,
  redstone: I.REDSTONE,
  quartz: I.QUARTZ,
  red_dye: I.RED_DYE,
  yellow_dye: I.YELLOW_DYE,
  blue_dye: I.BLUE_DYE,
  poppy: B.FLOWER_RED,
  dandelion: B.FLOWER_YELLOW,
  lapis_lazuli: I.LAPIS,
};
const ingredient = (v: any): number => {
  const key = (v.item ?? v.tag ?? "").replace("minecraft:", "");
  const id = NATIVE_RECIPE_IDS[key];
  if (id === undefined) throw Error("Unsupported native ingredient " + key);
  return id;
};
export function refinementRecipes(): Recipe[] {
  return Object.entries(JAVA_REFINEMENT_RECIPES)
    .filter(([name]) => name !== "oak_boat")
    .map(([, r]) => {
      const pattern: string[] | undefined = r.pattern,
        key: Record<string, number> | undefined = r.key
          ? Object.fromEntries(
              Object.entries(r.key).map(([k, v]) => [k, ingredient(v)]),
            )
          : undefined;
      const counts = new Map<number, number>();
      const ingredients: number[] = pattern
        ? pattern
            .join("")
            .split("")
            .filter((c) => c !== " ")
            .map((c) => key![c])
        : r.ingredients.map(ingredient);
      for (const id of ingredients) counts.set(id, (counts.get(id) ?? 0) + 1);
      return {
        out: { id: ingredient(r.result), count: r.result.count ?? 1 },
        inputs: [...counts].map(([id, count]) => ({ id, count })),
        table: pattern
          ? pattern.length > 2 || pattern.some((row) => row.length > 2)
          : ingredients.length > 4,
        ...(pattern ? { pattern, key } : {}),
      };
    });
}
