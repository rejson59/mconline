// Tile indices in the texture atlas
export const T = {
  grass_top: 0, grass_side: 1, dirt: 2, stone: 3, cobble: 4, log_side: 5, log_top: 6,
  leaves: 7, planks: 8, sand: 9, water: 10, glass: 11, bedrock: 12, gravel: 13,
  coal_ore: 14, iron_ore: 15, gold_ore: 16, diamond_ore: 17, brick: 18, snow: 19,
  snow_side: 20, cactus_side: 21, cactus_top: 22, birch_side: 23, birch_top: 24,
  birch_leaves: 25, tnt_side: 26, tnt_top: 27, tnt_bottom: 28, glowstone: 29,
  bookshelf: 30, wool_white: 31, wool_red: 32, crafting_top: 33, crafting_side: 34,
  furnace_front: 35, furnace_side: 36, obsidian: 37, stone_bricks: 38, ice: 39,
  tallgrass: 40, flower_red: 41, flower_yellow: 42, wool_blue: 43, wool_green: 44,
  wool_yellow: 45, wool_black: 46, lava: 47, sandstone_side: 48, sandstone_top: 49,
  pumpkin_side: 50, pumpkin_top: 51, pumpkin_face: 52, mossy: 53, clay: 54, torch: 55, sapling: 56, birch_sapling: 57, farmland: 58,
  wheat0: 59, wheat1: 60, wheat2: 61, wheat3: 62, bed_top: 63, bed_side: 64,
  furnace_lit: 65,
  chest_top: 66, chest_side: 67, chest_front: 68, door: 69, door_top: 70,
  ladder: 71, fence: 72, trapdoor: 73, campfire: 74, campfire_side: 75,
  iron_block: 76, gold_block: 77, diamond_block: 78,
  lapis_ore: 79, lapis_block: 80, enchant_top: 81, enchant_side: 82, enchant_bottom: 83,
  sugarcane: 84,
  // 1.6 „Wioska”
  path_top: 85, path_side: 86, hay_top: 87, hay_side: 88, lantern: 89,
  emerald_ore: 90, emerald_block: 91, bell: 92,
  // 1.7 „Nether & Redstone”
  redstone_ore: 93, redstone_block: 94, redstone_torch: 95, redstone_torch_off: 96,
  redstone_lamp: 97, redstone_lamp_on: 98, lever: 99, piston_side: 100, piston_top: 101,
  piston_bottom: 102, sticky_piston_side: 103, slime: 104, observer_top: 105, observer_side: 106,
  observer_bottom: 107, dispenser_front: 108, dispenser_side: 109, note_block: 110,
  netherrack: 111, soul_sand: 112, nether_bricks: 113, quartz_ore: 114, quartz_block: 115,
  quartz_pillar: 116, quartz_chiseled: 117, magma: 118, end_stone: 119, end_bricks: 120,
  purpur_block: 121, purpur_pillar: 122, nether_portal: 123, oak_stairs: 124, cobble_stairs: 125,
  concrete_white: 126, concrete_red: 127, concrete_blue: 128, concrete_green: 129,
  concrete_yellow: 130, concrete_black: 131, terracotta: 132, rail: 133, powered_rail: 134,
  detector_rail: 135, anvil: 136, brewing_top: 137, brewing_side: 138, shroomlight: 139,
  basalt_top: 140, basalt_side: 141, blackstone: 142, soul_soil: 143, crying_obsidian: 144,
  target_top: 145, target_side: 146, honey_block: 147, honeycomb_block: 148,
} as const;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, PLANKS: 7, SAND: 8,
  WATER: 9, GLASS: 10, BEDROCK: 11, GRAVEL: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15,
  DIAMOND_ORE: 16, BRICK: 17, SNOW: 18, CACTUS: 19, BIRCH_LOG: 20, BIRCH_LEAVES: 21,
  TNT: 22, GLOWSTONE: 23, BOOKSHELF: 24, WOOL_WHITE: 25, WOOL_RED: 26, CRAFTING: 27,
  FURNACE: 28, OBSIDIAN: 29, STONE_BRICKS: 30, ICE: 31, TALLGRASS: 32, FLOWER_RED: 33,
  FLOWER_YELLOW: 34, WOOL_BLUE: 35, WOOL_GREEN: 36, WOOL_YELLOW: 37, WOOL_BLACK: 38,
  LAVA: 39, SANDSTONE: 40, PUMPKIN: 41, MOSSY: 42, CLAY: 43,
  TORCH: 44, SAPLING: 45, BIRCH_SAPLING: 46, FARMLAND: 47,
  CROP0: 48, CROP1: 49, CROP2: 50, CROP3: 51, BED: 52, FURNACE_ON: 53,
  CHEST: 54,
  DOOR_N: 55, DOOR_E: 56, DOOR_S: 57, DOOR_W: 58,
  DOOR_ON: 59, DOOR_OE: 60, DOOR_OS: 61, DOOR_OW: 62,
  LADDER_N: 63, LADDER_E: 64, LADDER_S: 65, LADDER_W: 66,
  FENCE: 67,
  TRAP: 68, TRAP_N: 69, TRAP_E: 70, TRAP_S: 71, TRAP_W: 72,
  CAMPFIRE: 73, LOOT_CHEST: 74,
  DOOR_UN: 75, DOOR_UE: 76, DOOR_US: 77, DOOR_UW: 78,
  DOOR_UON: 79, DOOR_UOE: 80, DOOR_UOS: 81, DOOR_UOW: 82,
  IRON_BLOCK: 83, GOLD_BLOCK: 84, DIAMOND_BLOCK: 85,
  // 1.5 „Zaklęcia“ – new ids are always appended, existing saves keep working
  LAPIS_ORE: 86, LAPIS_BLOCK: 87, ENCHANT: 88, SUGARCANE: 89,
  // 1.6 „Wioska“ – ścieżka, siano, latarnia, szmaragd i dzwon
  PATH: 90, HAY: 91, LANTERN: 92, EMERALD_ORE: 93, EMERALD_BLOCK: 94, BELL: 95,
  // 1.7 „Nether & Redstone“ – nowe bloki zaczynają się od 250, żeby nie kolidować z ID przedmiotów (100–230)
  REDSTONE_ORE: 250, REDSTONE_BLOCK: 251, REDSTONE_TORCH: 252, REDSTONE_TORCH_OFF: 253,
  REDSTONE_LAMP: 254, REDSTONE_LAMP_ON: 255, LEVER: 256, LEVER_ON: 257,
  BUTTON: 258, BUTTON_ON: 259, PISTON: 260, PISTON_HEAD: 261, STICKY_PISTON: 262,
  SLIME_BLOCK: 263, OBSERVER: 264, DISPENSER: 265, NOTE_BLOCK: 266,
  NETHERRACK: 267, SOUL_SAND: 268, NETHER_BRICKS: 269, QUARTZ_ORE: 270,
  QUARTZ_BLOCK: 271, QUARTZ_PILLAR: 272, MAGMA: 273, END_STONE: 274, END_BRICKS: 275,
  PURPUR_BLOCK: 276, PURPUR_PILLAR: 277, NETHER_PORTAL: 278,
  // Schody – 4 kierunki na materiał (N,E,S,W)
  OAK_STAIRS_N: 279, OAK_STAIRS_E: 280, OAK_STAIRS_S: 281, OAK_STAIRS_W: 282,
  COBBLE_STAIRS_N: 283, COBBLE_STAIRS_E: 284, COBBLE_STAIRS_S: 285, COBBLE_STAIRS_W: 286,
  BRICK_STAIRS_N: 287, BRICK_STAIRS_E: 288, BRICK_STAIRS_S: 289, BRICK_STAIRS_W: 290,
  STONE_BRICK_STAIRS_N: 291, STONE_BRICK_STAIRS_E: 292, STONE_BRICK_STAIRS_S: 293, STONE_BRICK_STAIRS_W: 294,
  SANDSTONE_STAIRS_N: 295, SANDSTONE_STAIRS_E: 296, SANDSTONE_STAIRS_S: 297, SANDSTONE_STAIRS_W: 298,
  NETHER_BRICK_STAIRS_N: 299, NETHER_BRICK_STAIRS_E: 300, NETHER_BRICK_STAIRS_S: 301, NETHER_BRICK_STAIRS_W: 302,
  QUARTZ_STAIRS_N: 303, QUARTZ_STAIRS_E: 304, QUARTZ_STAIRS_S: 305, QUARTZ_STAIRS_W: 306,
  // Płyty – dolna i górna
  OAK_SLAB: 307, OAK_SLAB_TOP: 308,
  STONE_SLAB: 309, STONE_SLAB_TOP: 310,
  COBBLE_SLAB: 311, COBBLE_SLAB_TOP: 312,
  BRICK_SLAB: 313, BRICK_SLAB_TOP: 314,
  SANDSTONE_SLAB: 315, SANDSTONE_SLAB_TOP: 316,
  NETHER_BRICK_SLAB: 317, NETHER_BRICK_SLAB_TOP: 318,
  QUARTZ_SLAB: 319, QUARTZ_SLAB_TOP: 320,
  // Beton i inne dekoracyjne
  CONCRETE_WHITE: 321, CONCRETE_RED: 322, CONCRETE_BLUE: 323, CONCRETE_GREEN: 324,
  CONCRETE_YELLOW: 325, CONCRETE_BLACK: 326, TERRACOTTA: 327,
  RAIL: 328, POWERED_RAIL: 329, DETECTOR_RAIL: 330,
  ANVIL: 331, BREWING: 332, SHROOMLIGHT: 333, BASALT: 334, BLACKSTONE: 335,
  SOUL_SOIL: 336, CRYING_OBSIDIAN: 337, TARGET: 338, HONEY_BLOCK: 339, HONEYCOMB_BLOCK: 340,
} as const;

export type RenderType = 'cube' | 'cross' | 'liquid' | 'slab' | 'stairs' | 'portal' | 'rail';

export interface BlockDef {
  id: number;
  name: string;
  top: number;
  bottom: number;
  side: number;
  front?: number;
  solid: boolean;
  opaque: boolean;
  layer: 0 | 1 | 2; // 0 opaque, 1 cutout, 2 transparent
  render: RenderType;
  hardness: number; // -1 unbreakable
  drop: number; // -1 = nothing, otherwise block id
  sound: 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth' | 'slime';
}

const defs: BlockDef[] = [];

function def(
  id: number,
  name: string,
  tiles: number | [number, number, number] | [number, number, number, number],
  opts: Partial<BlockDef> = {}
) {
  const t = typeof tiles === 'number' ? [tiles, tiles, tiles] : tiles;
  defs[id] = {
    id,
    name,
    top: t[0],
    bottom: t[1],
    side: t[2],
    front: t[3],
    solid: true,
    opaque: true,
    layer: 0,
    render: 'cube',
    hardness: 1,
    drop: id,
    sound: 'stone',
    ...opts,
  };
}

def(B.AIR, 'Powietrze', 0, { solid: false, opaque: false, hardness: 0, drop: -1 });
def(B.GRASS, 'Blok trawy', [T.grass_top, T.dirt, T.grass_side], { hardness: 0.6, drop: B.DIRT, sound: 'grass' });
def(B.DIRT, 'Ziemia', T.dirt, { hardness: 0.5, sound: 'grass' });
def(B.STONE, 'Kamień', T.stone, { hardness: 1.5, drop: B.COBBLE });
def(B.COBBLE, 'Bruk', T.cobble, { hardness: 2 });
def(B.LOG, 'Pień dębu', [T.log_top, T.log_top, T.log_side], { hardness: 2, sound: 'wood' });
def(B.LEAVES, 'Liście dębu', T.leaves, { opaque: false, layer: 1, hardness: 0.2, drop: -1, sound: 'grass' });
def(B.PLANKS, 'Deski dębowe', T.planks, { hardness: 2, sound: 'wood' });
def(B.SAND, 'Piasek', T.sand, { hardness: 0.5, sound: 'sand' });
def(B.WATER, 'Woda', T.water, { solid: false, opaque: false, layer: 2, render: 'liquid', hardness: -1, drop: -1 });
def(B.GLASS, 'Szkło', T.glass, { opaque: false, layer: 1, hardness: 0.3, drop: -1, sound: 'glass' });
def(B.BEDROCK, 'Skała macierzysta', T.bedrock, { hardness: -1, drop: -1 });
def(B.GRAVEL, 'Żwir', T.gravel, { hardness: 0.6, sound: 'sand' });
def(B.COAL_ORE, 'Ruda węgla', T.coal_ore, { hardness: 3 });
def(B.IRON_ORE, 'Ruda żelaza', T.iron_ore, { hardness: 3 });
def(B.GOLD_ORE, 'Ruda złota', T.gold_ore, { hardness: 3 });
def(B.DIAMOND_ORE, 'Ruda diamentu', T.diamond_ore, { hardness: 3 });
def(B.BRICK, 'Cegły', T.brick, { hardness: 2 });
def(B.SNOW, 'Blok śniegu', [T.snow, T.dirt, T.snow_side], { hardness: 0.5, drop: B.DIRT, sound: 'cloth' });
def(B.CACTUS, 'Kaktus', [T.cactus_top, T.cactus_top, T.cactus_side], { opaque: false, layer: 1, hardness: 0.4, sound: 'cloth' });
def(B.BIRCH_LOG, 'Pień brzozy', [T.birch_top, T.birch_top, T.birch_side], { hardness: 2, sound: 'wood' });
def(B.BIRCH_LEAVES, 'Liście brzozy', T.birch_leaves, { opaque: false, layer: 1, hardness: 0.2, drop: -1, sound: 'grass' });
def(B.TNT, 'TNT', [T.tnt_top, T.tnt_bottom, T.tnt_side], { hardness: 0, sound: 'grass' });
def(B.GLOWSTONE, 'Jasnogłaz', T.glowstone, { hardness: 0.3, sound: 'glass' });
def(B.BOOKSHELF, 'Biblioteczka', [T.planks, T.planks, T.bookshelf], { hardness: 1.5, sound: 'wood' });
def(B.WOOL_WHITE, 'Biała wełna', T.wool_white, { hardness: 0.8, sound: 'cloth' });
def(B.WOOL_RED, 'Czerwona wełna', T.wool_red, { hardness: 0.8, sound: 'cloth' });
def(B.CRAFTING, 'Stół rzemieślniczy', [T.crafting_top, T.planks, T.crafting_side], { hardness: 2.5, sound: 'wood' });
def(B.FURNACE, 'Piec', [T.furnace_side, T.furnace_side, T.furnace_side, T.furnace_front], { hardness: 3.5 });
def(B.OBSIDIAN, 'Obsydian', T.obsidian, { hardness: 10 });
def(B.STONE_BRICKS, 'Kamienne cegły', T.stone_bricks, { hardness: 1.5 });
def(B.ICE, 'Lód', T.ice, { opaque: false, layer: 2, hardness: 0.5, drop: -1, sound: 'glass' });
def(B.TALLGRASS, 'Wysoka trawa', T.tallgrass, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, drop: -1, sound: 'grass' });
def(B.FLOWER_RED, 'Mak', T.flower_red, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });
def(B.FLOWER_YELLOW, 'Mniszek', T.flower_yellow, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });
def(B.WOOL_BLUE, 'Niebieska wełna', T.wool_blue, { hardness: 0.8, sound: 'cloth' });
def(B.WOOL_GREEN, 'Zielona wełna', T.wool_green, { hardness: 0.8, sound: 'cloth' });
def(B.WOOL_YELLOW, 'Żółta wełna', T.wool_yellow, { hardness: 0.8, sound: 'cloth' });
def(B.WOOL_BLACK, 'Czarna wełna', T.wool_black, { hardness: 0.8, sound: 'cloth' });
def(B.LAVA, 'Lawa', T.lava, { solid: false, opaque: false, layer: 2, render: 'liquid', hardness: -1, drop: -1 });
def(B.SANDSTONE, 'Piaskowiec', [T.sandstone_top, T.sandstone_top, T.sandstone_side], { hardness: 0.8 });
def(B.PUMPKIN, 'Dynia', [T.pumpkin_top, T.pumpkin_top, T.pumpkin_side, T.pumpkin_face], { hardness: 1, sound: 'wood' });
def(B.MOSSY, 'Zamszony bruk', T.mossy, { hardness: 2 });
def(B.CLAY, 'Glina', T.clay, { hardness: 0.6, sound: 'sand' });
def(B.TORCH, 'Pochodnia', T.torch, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'wood' });
def(B.SAPLING, 'Sadzonka dębu', T.sapling, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });
def(B.BIRCH_SAPLING, 'Sadzonka brzozy', T.birch_sapling, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });
def(B.FARMLAND, 'Grządka', [T.farmland, T.dirt, T.dirt], { hardness: 0.6, drop: B.DIRT, sound: 'grass' });
def(B.CROP0, 'Kiełki pszenicy', T.wheat0, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, drop: -1, sound: 'grass' });
def(B.CROP1, 'Młoda pszenica', T.wheat1, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, drop: -1, sound: 'grass' });
def(B.CROP2, 'Pszenica', T.wheat2, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, drop: -1, sound: 'grass' });
def(B.CROP3, 'Dojrzała pszenica', T.wheat3, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, drop: -1, sound: 'grass' });
def(B.BED, 'Łóżko', [T.bed_top, T.planks, T.bed_side], { hardness: 0.2, sound: 'cloth' });
def(B.FURNACE_ON, 'Rozpalony piec', [T.furnace_side, T.furnace_side, T.furnace_side, T.furnace_lit], { hardness: 3.5, drop: B.FURNACE });
def(B.CHEST, 'Skrzynia', [T.chest_top, T.planks, T.chest_side, T.chest_front], { hardness: 2.5, sound: 'wood' });
def(B.LOOT_CHEST, 'Stara skrzynia', [T.chest_top, T.planks, T.chest_side, T.chest_front], { hardness: 2.5, sound: 'wood', drop: B.CHEST });
const FACE_PL = ['północ', 'wschód', 'południe', 'zachód'];
for (let i = 0; i < 4; i++) {
  def(B.DOOR_N + i, i === 0 ? 'Drzwi' : `Drzwi (${FACE_PL[i]})`, T.door, { hardness: 2, sound: 'wood', drop: B.DOOR_N });
  def(B.DOOR_ON + i, `Otwarte drzwi (${FACE_PL[i]})`, T.door, { hardness: 2, sound: 'wood', drop: B.DOOR_N, solid: false, opaque: false });
  def(B.DOOR_UN + i, i === 0 ? 'Górne drzwi' : `Górne drzwi (${FACE_PL[i]})`, T.door_top, { hardness: 2, sound: 'wood', drop: -1 });
  def(B.DOOR_UON + i, `Otwarte górne drzwi (${FACE_PL[i]})`, T.door_top, { hardness: 2, sound: 'wood', drop: -1, solid: false, opaque: false });
  def(B.LADDER_N + i, i === 0 ? 'Drabina' : `Drabina (${FACE_PL[i]})`, T.ladder, { solid: false, opaque: false, layer: 1, hardness: 0.4, sound: 'wood', drop: B.LADDER_N });
  def(B.TRAP_N + i, `Otwarty właz (${FACE_PL[i]})`, T.trapdoor, { hardness: 2, sound: 'wood', drop: B.TRAP, solid: false, opaque: false });
}
def(B.TRAP, 'Właz', T.trapdoor, { hardness: 2, sound: 'wood', opaque: false });
def(B.FENCE, 'Płot', T.fence, { opaque: false, layer: 1, hardness: 2, sound: 'wood' });
def(B.CAMPFIRE, 'Ognisko', [T.campfire, T.campfire_side, T.campfire_side], { hardness: 2, sound: 'wood' });
def(B.IRON_BLOCK, 'Blok żelaza', T.iron_block, { hardness: 5, sound: 'stone' });
def(B.GOLD_BLOCK, 'Blok złota', T.gold_block, { hardness: 3, sound: 'stone' });
def(B.DIAMOND_BLOCK, 'Blok diamentu', T.diamond_block, { hardness: 5, sound: 'stone' });
// 1.5 „Zaklęcia“: lapis, enchanting table, sugar cane
def(B.LAPIS_ORE, 'Ruda lazurytu', T.lapis_ore, { hardness: 3, drop: -1 });
def(B.LAPIS_BLOCK, 'Blok lazurytu', T.lapis_block, { hardness: 3, sound: 'stone' });
def(B.ENCHANT, 'Stół zaklęć', [T.enchant_top, T.enchant_bottom, T.enchant_side], { hardness: 5, sound: 'stone' });
def(B.SUGARCANE, 'Trzcina cukrowa', T.sugarcane, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });
// 1.6 „Wioska“: ścieżki, siano, latarnie, szmaragd i dzwon
def(B.PATH, 'Ścieżka', [T.path_top, T.dirt, T.path_side], { hardness: 0.65, drop: B.DIRT, sound: 'grass' });
def(B.HAY, 'Bela siana', [T.hay_top, T.hay_top, T.hay_side], { hardness: 0.5, sound: 'grass' });
def(B.LANTERN, 'Latarnia', T.lantern, { hardness: 3.5, opaque: false, sound: 'glass' });
def(B.EMERALD_ORE, 'Ruda szmaragdu', T.emerald_ore, { hardness: 3 });
def(B.EMERALD_BLOCK, 'Blok szmaragdu', T.emerald_block, { hardness: 5 });
def(B.BELL, 'Dzwon', T.bell, { hardness: 4, sound: 'stone' });
// 1.7 „Nether & Redstone“
def(B.REDSTONE_ORE, 'Ruda czerwonego kamienia', T.redstone_ore, { hardness: 3, drop: -1 });
def(B.REDSTONE_BLOCK, 'Blok czerwonego kamienia', T.redstone_block, { hardness: 3 });
def(B.REDSTONE_TORCH, 'Pochodnia redstone', T.redstone_torch, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'wood' });
def(B.REDSTONE_TORCH_OFF, 'Zgaszona pochodnia redstone', T.redstone_torch_off, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'wood', drop: B.REDSTONE_TORCH });
def(B.REDSTONE_LAMP, 'Lampa redstone', T.redstone_lamp, { hardness: 0.3, sound: 'glass' });
def(B.REDSTONE_LAMP_ON, 'Zapalona lampa redstone', T.redstone_lamp_on, { hardness: 0.3, sound: 'glass', drop: B.REDSTONE_LAMP });
def(B.LEVER, 'Dźwignia (wył)', T.lever, { solid: false, opaque: false, layer: 1, hardness: 0.5, sound: 'stone' });
def(B.LEVER_ON, 'Dźwignia (wł)', T.lever, { solid: false, opaque: false, layer: 1, hardness: 0.5, sound: 'stone', drop: B.LEVER });
def(B.BUTTON, 'Przycisk', T.stone, { solid: false, opaque: false, layer: 1, hardness: 0.5, sound: 'stone' });
def(B.BUTTON_ON, 'Przycisk (wciśnięty)', T.stone, { solid: false, opaque: false, layer: 1, hardness: 0.5, sound: 'stone', drop: B.BUTTON });
def(B.PISTON, 'Tłok', [T.piston_top, T.piston_bottom, T.piston_side, T.piston_top], { hardness: 1.5, sound: 'stone' });
def(B.PISTON_HEAD, 'Głowica tłoka', T.piston_top, { hardness: 1.5, sound: 'stone', drop: -1, solid: false });
def(B.STICKY_PISTON, 'Lepki tłok', [T.piston_top, T.piston_bottom, T.sticky_piston_side, T.piston_top], { hardness: 1.5, sound: 'stone' });
def(B.SLIME_BLOCK, 'Blok szlamu', T.slime, { hardness: 0, sound: 'slime', opaque: false, layer: 2 });
def(B.OBSERVER, 'Obserwator', [T.observer_top, T.observer_bottom, T.observer_side, T.observer_top], { hardness: 3, sound: 'stone' });
def(B.DISPENSER, 'Dozownik', [T.dispenser_side, T.dispenser_side, T.dispenser_side, T.dispenser_front], { hardness: 3.5 });
def(B.NOTE_BLOCK, 'Blok dźwiękowy', T.note_block, { hardness: 0.8, sound: 'wood' });
def(B.NETHERRACK, 'Netherrack', T.netherrack, { hardness: 0.4, sound: 'stone' });
def(B.SOUL_SAND, 'Piasek dusz', T.soul_sand, { hardness: 0.5, sound: 'sand' });
def(B.NETHER_BRICKS, 'Cegły netherowe', T.nether_bricks, { hardness: 2 });
def(B.QUARTZ_ORE, 'Ruda kwarcu', T.quartz_ore, { hardness: 3, drop: -1 });
def(B.QUARTZ_BLOCK, 'Blok kwarcu', T.quartz_block, { hardness: 0.8 });
def(B.QUARTZ_PILLAR, 'Filar kwarcowy', [T.quartz_pillar, T.quartz_pillar, T.quartz_block], { hardness: 0.8 });
def(B.MAGMA, 'Blok magmy', T.magma, { hardness: 0.5, sound: 'stone' });
def(B.END_STONE, 'Kamień Endu', T.end_stone, { hardness: 3 });
def(B.END_BRICKS, 'Cegły Endu', T.end_bricks, { hardness: 3 });
def(B.PURPUR_BLOCK, 'Purpur', T.purpur_block, { hardness: 1.5 });
def(B.PURPUR_PILLAR, 'Filar purpuru', [T.purpur_pillar, T.purpur_pillar, T.purpur_block], { hardness: 1.5 });
def(B.NETHER_PORTAL, 'Portal Netheru', T.nether_portal, { solid: false, opaque: false, layer: 2, render: 'portal', hardness: -1, drop: -1, sound: 'glass' });
// Schody – każdy kierunek to osobny ID
for (let i = 0; i < 4; i++) {
  def(B.OAK_STAIRS_N + i, i === 0 ? 'Dębowe schody' : `Dębowe schody (${FACE_PL[i]})`, T.oak_stairs, { hardness: 2, sound: 'wood', drop: B.OAK_STAIRS_N, render: 'stairs' as any });
  def(B.COBBLE_STAIRS_N + i, i === 0 ? 'Brukowe schody' : `Brukowe schody (${FACE_PL[i]})`, T.cobble, { hardness: 2, drop: B.COBBLE_STAIRS_N, render: 'stairs' as any });
  def(B.BRICK_STAIRS_N + i, i === 0 ? 'Ceglane schody' : `Ceglane schody (${FACE_PL[i]})`, T.brick, { hardness: 2, drop: B.BRICK_STAIRS_N, render: 'stairs' as any });
  def(B.STONE_BRICK_STAIRS_N + i, i === 0 ? 'Schody z kamiennych cegieł' : `Schody z kamiennych cegieł (${FACE_PL[i]})`, T.stone_bricks, { hardness: 1.5, drop: B.STONE_BRICK_STAIRS_N, render: 'stairs' as any });
  def(B.SANDSTONE_STAIRS_N + i, i === 0 ? 'Schody z piaskowca' : `Schody z piaskowca (${FACE_PL[i]})`, T.sandstone_top, { hardness: 0.8, drop: B.SANDSTONE_STAIRS_N, render: 'stairs' as any });
  def(B.NETHER_BRICK_STAIRS_N + i, i === 0 ? 'Schody z netherowych cegieł' : `Schody z netherowych cegieł (${FACE_PL[i]})`, T.nether_bricks, { hardness: 2, drop: B.NETHER_BRICK_STAIRS_N, render: 'stairs' as any });
  def(B.QUARTZ_STAIRS_N + i, i === 0 ? 'Kwarcowe schody' : `Kwarcowe schody (${FACE_PL[i]})`, T.quartz_block, { hardness: 0.8, drop: B.QUARTZ_STAIRS_N, render: 'stairs' as any });
}
// Płyty
def(B.OAK_SLAB, 'Dębowa płyta', T.planks, { hardness: 2, sound: 'wood', render: 'slab' as any });
def(B.OAK_SLAB_TOP, 'Dębowa płyta (górna)', T.planks, { hardness: 2, sound: 'wood', drop: B.OAK_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.STONE_SLAB, 'Kamienna płyta', T.stone, { hardness: 2, render: 'slab' as any });
def(B.STONE_SLAB_TOP, 'Kamienna płyta (górna)', T.stone, { hardness: 2, drop: B.STONE_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.COBBLE_SLAB, 'Brukowa płyta', T.cobble, { hardness: 2, render: 'slab' as any });
def(B.COBBLE_SLAB_TOP, 'Brukowa płyta (górna)', T.cobble, { hardness: 2, drop: B.COBBLE_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.BRICK_SLAB, 'Ceglana płyta', T.brick, { hardness: 2, render: 'slab' as any });
def(B.BRICK_SLAB_TOP, 'Ceglana płyta (górna)', T.brick, { hardness: 2, drop: B.BRICK_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.SANDSTONE_SLAB, 'Płyta z piaskowca', T.sandstone_top, { hardness: 0.8, render: 'slab' as any });
def(B.SANDSTONE_SLAB_TOP, 'Płyta z piaskowca (górna)', T.sandstone_top, { hardness: 0.8, drop: B.SANDSTONE_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.NETHER_BRICK_SLAB, 'Płyta z netherowych cegieł', T.nether_bricks, { hardness: 2, render: 'slab' as any });
def(B.NETHER_BRICK_SLAB_TOP, 'Płyta z netherowych cegieł (górna)', T.nether_bricks, { hardness: 2, drop: B.NETHER_BRICK_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
def(B.QUARTZ_SLAB, 'Kwarcowa płyta', T.quartz_block, { hardness: 0.8, render: 'slab' as any });
def(B.QUARTZ_SLAB_TOP, 'Kwarcowa płyta (górna)', T.quartz_block, { hardness: 0.8, drop: B.QUARTZ_SLAB, render: 'slab' as any, solid: true, opaque: false, layer: 1 });
// Beton
def(B.CONCRETE_WHITE, 'Biały beton', T.concrete_white, { hardness: 1.8 });
def(B.CONCRETE_RED, 'Czerwony beton', T.concrete_red, { hardness: 1.8 });
def(B.CONCRETE_BLUE, 'Niebieski beton', T.concrete_blue, { hardness: 1.8 });
def(B.CONCRETE_GREEN, 'Zielony beton', T.concrete_green, { hardness: 1.8 });
def(B.CONCRETE_YELLOW, 'Żółty beton', T.concrete_yellow, { hardness: 1.8 });
def(B.CONCRETE_BLACK, 'Czarny beton', T.concrete_black, { hardness: 1.8 });
def(B.TERRACOTTA, 'Terakota', T.terracotta, { hardness: 1.25 });
def(B.RAIL, 'Tory', T.rail, { solid: false, opaque: false, layer: 1, render: 'rail' as any, hardness: 0.7, sound: 'stone' });
def(B.POWERED_RAIL, 'Zasilane tory', T.powered_rail, { solid: false, opaque: false, layer: 1, render: 'rail' as any, hardness: 0.7, sound: 'stone' });
def(B.DETECTOR_RAIL, 'Tory detekcyjne', T.detector_rail, { solid: false, opaque: false, layer: 1, render: 'rail' as any, hardness: 0.7, sound: 'stone' });
def(B.ANVIL, 'Kowadło', T.anvil, { hardness: 5, sound: 'stone' });
def(B.BREWING, 'Statyw alchemiczny', T.brewing_top, { hardness: 0.5, sound: 'stone', solid: false, opaque: false, layer: 1, render: 'cross' as any });
def(B.SHROOMLIGHT, 'Shroomlight', T.shroomlight, { hardness: 1, sound: 'wood' });
def(B.BASALT, 'Bazalt', [T.basalt_top, T.basalt_top, T.basalt_side], { hardness: 1.25 });
def(B.BLACKSTONE, 'Czernit', T.blackstone, { hardness: 1.5 });
def(B.SOUL_SOIL, 'Gleba dusz', T.soul_soil, { hardness: 0.5, sound: 'sand' });
def(B.CRYING_OBSIDIAN, 'Płaczący obsydian', T.crying_obsidian, { hardness: 10 });
def(B.TARGET, 'Tarcza strzelnicza', [T.target_top, T.target_top, T.target_side], { hardness: 0.5, sound: 'grass' });
def(B.HONEY_BLOCK, 'Blok miodu', T.honey_block, { hardness: 0, sound: 'slime', opaque: false, layer: 2 });
def(B.HONEYCOMB_BLOCK, 'Blok plastra miodu', T.honeycomb_block, { hardness: 0.6, sound: 'grass' });

export const BLOCKS = defs;
export const BLOCK_COUNT = defs.length;

// Fast lookup tables – expanded to 512 for 1.7 blocks
export const IS_SOLID = new Uint8Array(512);
export const IS_OPAQUE = new Uint8Array(512);
export const LAYER = new Uint8Array(512);
export const RENDER = new Uint8Array(512); // 0 cube, 1 cross, 2 liquid, 3 slab, 4 stairs, 5 portal, 6 rail
for (const d of defs) {
  if (!d) continue;
  IS_SOLID[d.id] = d.solid ? 1 : 0;
  IS_OPAQUE[d.id] = d.opaque ? 1 : 0;
  LAYER[d.id] = d.layer;
  if (d.render === 'cube') RENDER[d.id] = 0;
  else if (d.render === 'cross') RENDER[d.id] = 1;
  else if (d.render === 'liquid') RENDER[d.id] = 2;
  else if ((d.render as any) === 'slab') RENDER[d.id] = 3;
  else if ((d.render as any) === 'stairs') RENDER[d.id] = 4;
  else if ((d.render as any) === 'portal') RENDER[d.id] = 5;
  else if ((d.render as any) === 'rail') RENDER[d.id] = 6;
  else RENDER[d.id] = 0;
}

/** Light level emitted by a block (0–15). Sampled while meshing, not stored in the save. */
export const EMIT = new Uint8Array(512);
EMIT[B.LAVA] = 15;
EMIT[B.GLOWSTONE] = 15;
EMIT[B.TORCH] = 14;
EMIT[B.FURNACE_ON] = 12;
EMIT[B.CAMPFIRE] = 15;
EMIT[B.LANTERN] = 15;
EMIT[B.REDSTONE_TORCH] = 7;
EMIT[B.REDSTONE_BLOCK] = 0;
EMIT[B.REDSTONE_LAMP_ON] = 15;
EMIT[B.SHROOMLIGHT] = 15;
EMIT[B.MAGMA] = 3;
EMIT[B.NETHER_PORTAL] = 11;
EMIT[B.REDSTONE_ORE] = 9;

// Face order: -x, +x, -y, +y, -z, +z
export function tileFor(id: number, face: number): number {
  const d = defs[id];
  if (!d) return 0;
  if (face === 3) return d.top;
  if (face === 2) return d.bottom;
  if (face === 5 && d.front !== undefined) return d.front;
  return d.side;
}

// Blocks available in creative inventory
function creativeVisible(id: number): boolean {
  if (id === B.AIR || id === B.WATER || id === B.LAVA || id === B.FURNACE_ON || id === B.CROP1 || id === B.CROP2 || id === B.LOOT_CHEST) return false;
  if (id === B.REDSTONE_LAMP_ON || id === B.REDSTONE_TORCH_OFF || id === B.LEVER_ON || id === B.BUTTON_ON) return false;
  if (id === B.PISTON_HEAD) return false;
  if (id === B.OAK_SLAB_TOP || id === B.STONE_SLAB_TOP || id === B.COBBLE_SLAB_TOP || id === B.BRICK_SLAB_TOP || id === B.SANDSTONE_SLAB_TOP || id === B.NETHER_BRICK_SLAB_TOP || id === B.QUARTZ_SLAB_TOP) return false;
  if (id >= B.DOOR_E && id <= B.DOOR_OW) return false;
  if (id >= B.DOOR_UN && id <= B.DOOR_UOW) return false;
  if (id >= B.LADDER_E && id <= B.LADDER_W) return false;
  if (id >= B.TRAP_N && id <= B.TRAP_W) return false;
  if (id >= B.OAK_STAIRS_E && id <= B.OAK_STAIRS_W) return false;
  if (id >= B.COBBLE_STAIRS_E && id <= B.COBBLE_STAIRS_W) return false;
  if (id >= B.BRICK_STAIRS_E && id <= B.BRICK_STAIRS_W) return false;
  if (id >= B.STONE_BRICK_STAIRS_E && id <= B.STONE_BRICK_STAIRS_W) return false;
  if (id >= B.SANDSTONE_STAIRS_E && id <= B.SANDSTONE_STAIRS_W) return false;
  if (id >= B.NETHER_BRICK_STAIRS_E && id <= B.NETHER_BRICK_STAIRS_W) return false;
  if (id >= B.QUARTZ_STAIRS_E && id <= B.QUARTZ_STAIRS_W) return false;
  return true;
}

export const CREATIVE_BLOCKS: number[] = defs
  .filter((d) => d && creativeVisible(d.id))
  .map((d) => d.id)
  .concat([B.WATER, B.LAVA]);

/** 0 north (−Z), 1 east (+X), 2 south (+Z), 3 west (−X). -1 if not a door. */
export function doorFacing(id: number): number {
  if (id >= B.DOOR_N && id <= B.DOOR_W) return id - B.DOOR_N;
  if (id >= B.DOOR_ON && id <= B.DOOR_OW) return id - B.DOOR_ON;
  if (id >= B.DOOR_UN && id <= B.DOOR_UW) return id - B.DOOR_UN;
  if (id >= B.DOOR_UON && id <= B.DOOR_UOW) return id - B.DOOR_UON;
  return -1;
}
export function isDoor(id: number): boolean {
  return doorFacing(id) >= 0;
}
export function isDoorTop(id: number): boolean {
  return id >= B.DOOR_UN && id <= B.DOOR_UOW;
}
export function isDoorOpen(id: number): boolean {
  return (id >= B.DOOR_ON && id <= B.DOOR_OW) || (id >= B.DOOR_UON && id <= B.DOOR_UOW);
}
export function doorPair(facing: number, open: boolean, top: boolean): number {
  if (top) return (open ? B.DOOR_UON : B.DOOR_UN) + facing;
  return (open ? B.DOOR_ON : B.DOOR_N) + facing;
}

export function ladderFacing(id: number): number {
  return id >= B.LADDER_N && id <= B.LADDER_W ? id - B.LADDER_N : -1;
}
export function isLadder(id: number): boolean {
  return ladderFacing(id) >= 0;
}

export function isTrap(id: number): boolean {
  return id === B.TRAP || (id >= B.TRAP_N && id <= B.TRAP_W);
}
export function isTrapOpen(id: number): boolean {
  return id >= B.TRAP_N && id <= B.TRAP_W;
}

/** Horizontal facing from a face normal that points toward the player. */
export function facingFromNormal(nx: number, nz: number): number {
  if (Math.abs(nx) > Math.abs(nz)) return nx > 0 ? 1 : 3;
  return nz > 0 ? 2 : 0;
}

// ---------- 1.7 helpers ----------

export function isStairs(id: number): boolean {
  return (id >= B.OAK_STAIRS_N && id <= B.QUARTZ_STAIRS_W);
}
export function stairsFacing(id: number): number {
  if (id >= B.OAK_STAIRS_N && id <= B.OAK_STAIRS_W) return id - B.OAK_STAIRS_N;
  if (id >= B.COBBLE_STAIRS_N && id <= B.COBBLE_STAIRS_W) return id - B.COBBLE_STAIRS_N;
  if (id >= B.BRICK_STAIRS_N && id <= B.BRICK_STAIRS_W) return id - B.BRICK_STAIRS_N;
  if (id >= B.STONE_BRICK_STAIRS_N && id <= B.STONE_BRICK_STAIRS_W) return id - B.STONE_BRICK_STAIRS_N;
  if (id >= B.SANDSTONE_STAIRS_N && id <= B.SANDSTONE_STAIRS_W) return id - B.SANDSTONE_STAIRS_N;
  if (id >= B.NETHER_BRICK_STAIRS_N && id <= B.NETHER_BRICK_STAIRS_W) return id - B.NETHER_BRICK_STAIRS_N;
  if (id >= B.QUARTZ_STAIRS_N && id <= B.QUARTZ_STAIRS_W) return id - B.QUARTZ_STAIRS_N;
  return -1;
}
export function stairsBase(id: number): number {
  if (id >= B.OAK_STAIRS_N && id <= B.OAK_STAIRS_W) return B.OAK_STAIRS_N;
  if (id >= B.COBBLE_STAIRS_N && id <= B.COBBLE_STAIRS_W) return B.COBBLE_STAIRS_N;
  if (id >= B.BRICK_STAIRS_N && id <= B.BRICK_STAIRS_W) return B.BRICK_STAIRS_N;
  if (id >= B.STONE_BRICK_STAIRS_N && id <= B.STONE_BRICK_STAIRS_W) return B.STONE_BRICK_STAIRS_N;
  if (id >= B.SANDSTONE_STAIRS_N && id <= B.SANDSTONE_STAIRS_W) return B.SANDSTONE_STAIRS_N;
  if (id >= B.NETHER_BRICK_STAIRS_N && id <= B.NETHER_BRICK_STAIRS_W) return B.NETHER_BRICK_STAIRS_N;
  if (id >= B.QUARTZ_STAIRS_N && id <= B.QUARTZ_STAIRS_W) return B.QUARTZ_STAIRS_N;
  return id;
}
export function isSlab(id: number): boolean {
  return (id >= B.OAK_SLAB && id <= B.QUARTZ_SLAB_TOP);
}
export function isSlabTop(id: number): boolean {
  return id === B.OAK_SLAB_TOP || id === B.STONE_SLAB_TOP || id === B.COBBLE_SLAB_TOP || id === B.BRICK_SLAB_TOP || id === B.SANDSTONE_SLAB_TOP || id === B.NETHER_BRICK_SLAB_TOP || id === B.QUARTZ_SLAB_TOP;
}
export function isSlabBottom(id: number): boolean {
  return id === B.OAK_SLAB || id === B.STONE_SLAB || id === B.COBBLE_SLAB || id === B.BRICK_SLAB || id === B.SANDSTONE_SLAB || id === B.NETHER_BRICK_SLAB || id === B.QUARTZ_SLAB;
}
export function slabBase(id: number): number {
  if (id === B.OAK_SLAB || id === B.OAK_SLAB_TOP) return B.OAK_SLAB;
  if (id === B.STONE_SLAB || id === B.STONE_SLAB_TOP) return B.STONE_SLAB;
  if (id === B.COBBLE_SLAB || id === B.COBBLE_SLAB_TOP) return B.COBBLE_SLAB;
  if (id === B.BRICK_SLAB || id === B.BRICK_SLAB_TOP) return B.BRICK_SLAB;
  if (id === B.SANDSTONE_SLAB || id === B.SANDSTONE_SLAB_TOP) return B.SANDSTONE_SLAB;
  if (id === B.NETHER_BRICK_SLAB || id === B.NETHER_BRICK_SLAB_TOP) return B.NETHER_BRICK_SLAB;
  if (id === B.QUARTZ_SLAB || id === B.QUARTZ_SLAB_TOP) return B.QUARTZ_SLAB;
  return id;
}
export function isLever(id: number): boolean {
  return id === B.LEVER || id === B.LEVER_ON;
}
export function isLeverOn(id: number): boolean {
  return id === B.LEVER_ON;
}
export function isButton(id: number): boolean {
  return id === B.BUTTON || id === B.BUTTON_ON;
}
export function isButtonOn(id: number): boolean {
  return id === B.BUTTON_ON;
}
export function isRedstoneLamp(id: number): boolean {
  return id === B.REDSTONE_LAMP || id === B.REDSTONE_LAMP_ON;
}
export function isRedstoneLampOn(id: number): boolean {
  return id === B.REDSTONE_LAMP_ON;
}
export function isRedstoneTorch(id: number): boolean {
  return id === B.REDSTONE_TORCH || id === B.REDSTONE_TORCH_OFF;
}
export function isRedstoneTorchOn(id: number): boolean {
  return id === B.REDSTONE_TORCH;
}
export function isPiston(id: number): boolean {
  return id === B.PISTON || id === B.STICKY_PISTON;
}
export function isPistonHead(id: number): boolean {
  return id === B.PISTON_HEAD;
}
export function isPortal(id: number): boolean {
  return id === B.NETHER_PORTAL;
}
export function isRail(id: number): boolean {
  return id === B.RAIL || id === B.POWERED_RAIL || id === B.DETECTOR_RAIL;
}
export function isRedstoneSource(id: number): boolean {
  return id === B.REDSTONE_BLOCK || id === B.LEVER_ON || id === B.BUTTON_ON || id === B.REDSTONE_TORCH;
}
export function isNetherBlock(id: number): boolean {
  return id === B.NETHERRACK || id === B.SOUL_SAND || id === B.SOUL_SOIL || id === B.NETHER_BRICKS || id === B.BASALT || id === B.BLACKSTONE || id === B.MAGMA || id === B.SHROOMLIGHT || id === B.CRYING_OBSIDIAN || id === B.QUARTZ_BLOCK || id === B.QUARTZ_PILLAR || id === B.QUARTZ_ORE;
}
