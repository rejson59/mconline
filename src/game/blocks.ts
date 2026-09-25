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
  pumpkin_side: 50, pumpkin_top: 51, pumpkin_face: 52, mossy: 53, clay: 54,
} as const;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, PLANKS: 7, SAND: 8,
  WATER: 9, GLASS: 10, BEDROCK: 11, GRAVEL: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15,
  DIAMOND_ORE: 16, BRICK: 17, SNOW: 18, CACTUS: 19, BIRCH_LOG: 20, BIRCH_LEAVES: 21,
  TNT: 22, GLOWSTONE: 23, BOOKSHELF: 24, WOOL_WHITE: 25, WOOL_RED: 26, CRAFTING: 27,
  FURNACE: 28, OBSIDIAN: 29, STONE_BRICKS: 30, ICE: 31, TALLGRASS: 32, FLOWER_RED: 33,
  FLOWER_YELLOW: 34, WOOL_BLUE: 35, WOOL_GREEN: 36, WOOL_YELLOW: 37, WOOL_BLACK: 38,
  LAVA: 39, SANDSTONE: 40, PUMPKIN: 41, MOSSY: 42, CLAY: 43,
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

// Face order: -x, +x, -y, +y, -z, +z
export function tileFor(id: number, face: number): number {
  const d = defs[id];
  if (face === 3) return d.top;
  if (face === 2) return d.bottom;
  if (face === 5 && d.front !== undefined) return d.front;
  return d.side;
}

// Blocks available in creative inventory
export const CREATIVE_BLOCKS: number[] = defs
  .filter((d) => d && d.id !== B.AIR && d.id !== B.WATER && d.id !== B.LAVA)
  .map((d) => d.id)
  .concat([B.WATER, B.LAVA]);
