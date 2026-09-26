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
  // 1.5 „Zaklęcia" – new ids are always appended, existing saves keep working
  LAPIS_ORE: 86, LAPIS_BLOCK: 87, ENCHANT: 88, SUGARCANE: 89,
} as const;

export type RenderType = 'cube' | 'cross' | 'liquid';

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
  sound: 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'cloth';
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
// 1.5 „Zaklęcia": lapis, enchanting table, sugar cane
def(B.LAPIS_ORE, 'Ruda lazurytu', T.lapis_ore, { hardness: 3, drop: -1 });
def(B.LAPIS_BLOCK, 'Blok lazurytu', T.lapis_block, { hardness: 3, sound: 'stone' });
def(B.ENCHANT, 'Stół zaklęć', [T.enchant_top, T.enchant_bottom, T.enchant_side], { hardness: 5, sound: 'stone' });
def(B.SUGARCANE, 'Trzcina cukrowa', T.sugarcane, { solid: false, opaque: false, layer: 1, render: 'cross', hardness: 0, sound: 'grass' });

export const BLOCKS = defs;
export const BLOCK_COUNT = defs.length;

// Fast lookup tables
export const IS_SOLID = new Uint8Array(256);
export const IS_OPAQUE = new Uint8Array(256);
export const LAYER = new Uint8Array(256);
export const RENDER = new Uint8Array(256); // 0 cube, 1 cross, 2 liquid
for (const d of defs) {
  if (!d) continue;
  IS_SOLID[d.id] = d.solid ? 1 : 0;
  IS_OPAQUE[d.id] = d.opaque ? 1 : 0;
  LAYER[d.id] = d.layer;
  RENDER[d.id] = d.render === 'cube' ? 0 : d.render === 'cross' ? 1 : 2;
}

/** Light level emitted by a block (0–15). Sampled while meshing, not stored in the save. */
export const EMIT = new Uint8Array(256);
EMIT[B.LAVA] = 15;
EMIT[B.GLOWSTONE] = 15;
EMIT[B.TORCH] = 14;
EMIT[B.FURNACE_ON] = 12;
EMIT[B.CAMPFIRE] = 15;

// Face order: -x, +x, -y, +y, -z, +z
export function tileFor(id: number, face: number): number {
  const d = defs[id];
  if (face === 3) return d.top;
  if (face === 2) return d.bottom;
  if (face === 5 && d.front !== undefined) return d.front;
  return d.side;
}

// Blocks available in creative inventory
function creativeVisible(id: number): boolean {
  if (id === B.AIR || id === B.WATER || id === B.LAVA || id === B.FURNACE_ON || id === B.CROP1 || id === B.CROP2 || id === B.LOOT_CHEST) return false;
  if (id >= B.DOOR_E && id <= B.DOOR_OW) return false;
  if (id >= B.DOOR_UN && id <= B.DOOR_UOW) return false;
  if (id >= B.LADDER_E && id <= B.LADDER_W) return false;
  if (id >= B.TRAP_N && id <= B.TRAP_W) return false;
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
