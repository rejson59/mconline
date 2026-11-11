import {
  B,
  BLOCKS,
  buildingItem,
  isBed,
  isChestBlock,
  isDoor,
  isLadder,
  isTrap,
} from "../src/game/blocks";
import { I } from "../src/game/items";
import { railBase } from "../src/game/rails";
/** Explicit representations only: no claim that absent native blocks exist. */
const names: Record<string, number> = {
  air: B.AIR,
  grass_block: B.GRASS,
  dirt: B.DIRT,
  stone: B.STONE,
  cobblestone: B.COBBLE,
  oak_log: B.LOG,
  oak_leaves: B.LEAVES,
  oak_planks: B.PLANKS,
  sand: B.SAND,
  water: B.WATER,
  glass: B.GLASS,
  bedrock: B.BEDROCK,
  gravel: B.GRAVEL,
  coal_ore: B.COAL_ORE,
  iron_ore: B.IRON_ORE,
  gold_ore: B.GOLD_ORE,
  diamond_ore: B.DIAMOND_ORE,
  bricks: B.BRICK,
  snow_block: B.SNOW,
  cactus: B.CACTUS,
  birch_log: B.BIRCH_LOG,
  birch_leaves: B.BIRCH_LEAVES,
  tnt: B.TNT,
  glowstone: B.GLOWSTONE,
  bookshelf: B.BOOKSHELF,
  crafting_table: B.CRAFTING,
  furnace: B.FURNACE,
  obsidian: B.OBSIDIAN,
  stone_bricks: B.STONE_BRICKS,
  ice: B.ICE,
  short_grass: B.TALLGRASS,
  poppy: B.FLOWER_RED,
  dandelion: B.FLOWER_YELLOW,
  lava: B.LAVA,
  sandstone: B.SANDSTONE,
  pumpkin: B.PUMPKIN,
  mossy_cobblestone: B.MOSSY,
  clay: B.CLAY,
  torch: B.TORCH,
  oak_sapling: B.SAPLING,
  birch_sapling: B.BIRCH_SAPLING,
  farmland: B.FARMLAND,
  red_bed: B.BED,
  chest: B.CHEST,
  oak_door: B.DOOR_N,
  ladder: B.LADDER_N,
  oak_fence: B.FENCE,
  oak_trapdoor: B.TRAP,
  campfire: B.CAMPFIRE,
  iron_block: B.IRON_BLOCK,
  gold_block: B.GOLD_BLOCK,
  diamond_block: B.DIAMOND_BLOCK,
  lapis_ore: B.LAPIS_ORE,
  lapis_block: B.LAPIS_BLOCK,
  enchanting_table: B.ENCHANT,
  sugar_cane: B.SUGARCANE,
  dirt_path: B.PATH,
  hay_block: B.HAY,
  lantern: B.LANTERN,
  emerald_ore: B.EMERALD_ORE,
  emerald_block: B.EMERALD_BLOCK,
  bell: B.BELL,
  redstone_ore: B.REDSTONE_ORE,
  redstone_block: B.REDSTONE_BLOCK,
  redstone_torch: B.REDSTONE_TORCH,
  redstone_lamp: B.REDSTONE_LAMP,
  lever: B.LEVER,
  stone_button: B.BUTTON,
  piston: B.PISTON,
  piston_head: B.PISTON_HEAD,
  sticky_piston: B.STICKY_PISTON,
  slime_block: B.SLIME_BLOCK,
  observer: B.OBSERVER,
  dispenser: B.DISPENSER,
  note_block: B.NOTE_BLOCK,
  netherrack: B.NETHERRACK,
  soul_sand: B.SOUL_SAND,
  nether_bricks: B.NETHER_BRICKS,
  nether_quartz_ore: B.QUARTZ_ORE,
  quartz_block: B.QUARTZ_BLOCK,
  quartz_pillar: B.QUARTZ_PILLAR,
  magma_block: B.MAGMA,
  end_stone: B.END_STONE,
  end_stone_bricks: B.END_BRICKS,
  purpur_block: B.PURPUR_BLOCK,
  purpur_pillar: B.PURPUR_PILLAR,
  nether_portal: B.NETHER_PORTAL,
  terracotta: B.TERRACOTTA,
  rail: B.RAIL,
  powered_rail: B.POWERED_RAIL,
  detector_rail: B.DETECTOR_RAIL,
  anvil: B.ANVIL,
  brewing_stand: B.BREWING,
  shroomlight: B.SHROOMLIGHT,
  basalt: B.BASALT,
  blackstone: B.BLACKSTONE,
  soul_soil: B.SOUL_SOIL,
  crying_obsidian: B.CRYING_OBSIDIAN,
  target: B.TARGET,
  honey_block: B.HONEY_BLOCK,
  honeycomb_block: B.HONEYCOMB_BLOCK,
  mud: B.MUD,
  acacia_log: B.ACACIA_LOG,
  acacia_leaves: B.ACACIA_LEAVES,
  jungle_leaves: B.JUNGLE_LEAVES,
  lily_pad: B.LILY_PAD,
  glass_pane: B.GLASS_PANE,
  fire: B.FIRE,
  soul_fire: B.SOUL_FIRE,
  bread: I.BREAD,
  stick: I.STICK,
  coal: I.COAL,
  charcoal: I.CHARCOAL,
  iron_ingot: I.IRON,
  gold_ingot: I.GOLD,
  diamond: I.DIAMOND,
  blaze_rod: I.BLAZE_ROD,
  nether_brick: I.NETHER_BRICK_ITEM,
  quartz: I.QUARTZ,
  paper: I.PAPER,
  book: I.BOOK,
  leather: I.LEATHER,
  wheat: I.WHEAT,
  glass_bottle: I.BOTTLE,
};
for (const color of [
  "WHITE",
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "BLACK",
  "ORANGE",
  "MAGENTA",
  "LIGHT_BLUE",
  "LIME",
  "PINK",
  "GRAY",
  "LIGHT_GRAY",
  "CYAN",
  "PURPLE",
  "BROWN",
])
  names[color.toLowerCase() + "_wool"] = B[("WOOL_" + color) as keyof typeof B];
for (const [native, project] of [
  ["wooden", "WOOD"],
  ["stone", "STONE"],
  ["iron", "IRON"],
  ["golden", "GOLD"],
  ["diamond", "DIAMOND"],
])
  for (const [kind, short] of [
    ["pickaxe", "PICK"],
    ["axe", "AXE"],
    ["shovel", "SHOVEL"],
    ["sword", "SWORD"],
    ["hoe", "HOE"],
  ])
    names[native + "_" + kind] = I[(project + "_" + short) as keyof typeof I];
names.shears = I.SHEARS;
for (const color of ["WHITE", "RED", "BLUE", "GREEN", "YELLOW", "BLACK"])
  names[color.toLowerCase() + "_concrete"] =
    B[("CONCRETE_" + color) as keyof typeof B];
for (const [prefix, native] of [
  ["OAK", "oak"],
  ["COBBLE", "cobblestone"],
  ["BRICK", "brick"],
  ["STONE_BRICK", "stone_brick"],
  ["SANDSTONE", "sandstone"],
  ["NETHER_BRICK", "nether_brick"],
  ["QUARTZ", "quartz"],
])
  names[native + "_stairs"] = B[(prefix + "_STAIRS_N") as keyof typeof B];
for (const [prefix, native] of [
  ["OAK", "oak"],
  ["STONE", "stone"],
  ["COBBLE", "cobblestone"],
  ["BRICK", "brick"],
  ["SANDSTONE", "sandstone"],
  ["NETHER_BRICK", "nether_brick"],
  ["QUARTZ", "quartz"],
])
  names[native + "_slab"] = B[(prefix + "_SLAB") as keyof typeof B];
export const nativeItems = names;
const reverse = Object.fromEntries(
  Object.entries(names)
    .filter(([, id]) => !!BLOCKS[id])
    .map(([n, id]) => [id, n]),
);
export const nativeBlocks: Record<number, string> = {};
for (const def of BLOCKS.filter(Boolean)) {
  const id = def.id;
  const canonical = isDoor(id)
    ? B.DOOR_N
    : isLadder(id)
      ? B.LADDER_N
      : isTrap(id)
        ? B.TRAP
        : isBed(id)
          ? B.BED
          : isChestBlock(id)
            ? B.CHEST
            : id === B.FARMLAND_WET
              ? B.FARMLAND
              : id === B.REDSTONE_LAMP_ON
                ? B.REDSTONE_LAMP
                : id === B.BUTTON_ON
                  ? B.BUTTON
                  : id === B.LEVER_ON
                    ? B.LEVER
                    : id === B.REDSTONE_TORCH_OFF
                      ? B.REDSTONE_TORCH
                      : id >= B.CROP0 && id <= B.CROP3
                        ? B.CROP0
                        : id >= B.WATER_FLOW_1 && id <= B.WATER_FALL
                          ? B.WATER
                          : buildingItem(railBase(id));
  nativeBlocks[id] = canonical === B.CROP0 ? "wheat" : reverse[canonical];
  if (!nativeBlocks[id])
    throw Error("Missing explicit native block binding " + id);
}
