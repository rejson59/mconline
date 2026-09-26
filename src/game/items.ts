import { B, BLOCKS, RENDER, isDoor, isLadder, isTrap } from './blocks';
import type { Stack } from './inventory';

/** Item ids sit above block ids so a stack can hold either. */
export const I = {
  STICK: 100,
  COAL: 101,
  IRON: 102,
  GOLD: 103,
  DIAMOND: 104,
  GUNPOWDER: 105,
  SEEDS: 106,
  WHEAT: 107,
  APPLE: 108,
  BREAD: 109,
  RAW_PORK: 110,
  COOKED_PORK: 111,
  RAW_BEEF: 112,
  COOKED_BEEF: 113,
  RAW_CHICKEN: 114,
  COOKED_CHICKEN: 115,
  BUCKET: 116,
  WATER_BUCKET: 117,
  LAVA_BUCKET: 118,
  WOOD_PICK: 120,
  STONE_PICK: 121,
  IRON_PICK: 122,
  DIAMOND_PICK: 123,
  WOOD_AXE: 124,
  STONE_AXE: 125,
  IRON_AXE: 126,
  DIAMOND_AXE: 127,
  WOOD_SHOVEL: 128,
  STONE_SHOVEL: 129,
  IRON_SHOVEL: 130,
  DIAMOND_SHOVEL: 131,
  WOOD_SWORD: 132,
  STONE_SWORD: 133,
  IRON_SWORD: 134,
  DIAMOND_SWORD: 135,
  WOOD_HOE: 136,
  STONE_HOE: 137,
  IRON_HOE: 138,
  DIAMOND_HOE: 139,
  FLINT: 140,
  SHEARS: 141,
  FLINT_STEEL: 142,
  COMPASS: 143,
  CLOCK: 144,
  STRING: 145,
  BONE: 146,
  FEATHER: 147,
  ARROW: 148,
  BOW: 149,
  LAPIS: 150,
  PAPER: 151,
  BOOK: 152,
  EMERALD: 153,
  LEATHER: 200,
  LEATHER_HELMET: 201,
  LEATHER_CHEST: 202,
  LEATHER_LEGS: 203,
  LEATHER_BOOTS: 204,
  IRON_HELMET: 205,
  IRON_CHEST: 206,
  IRON_LEGS: 207,
  IRON_BOOTS: 208,
  GOLD_HELMET: 209,
  GOLD_CHEST: 210,
  GOLD_LEGS: 211,
  GOLD_BOOTS: 212,
  DIAMOND_HELMET: 213,
  DIAMOND_CHEST: 214,
  DIAMOND_LEGS: 215,
  DIAMOND_BOOTS: 216,
  SHIELD: 217,
} as const;

export type ToolKind = 'pick' | 'axe' | 'shovel' | 'sword' | 'hoe' | 'shears' | 'igniter' | 'bow' | 'shield';

export interface ItemDef {
  id: number;
  name: string;
  /** Short aliases accepted by /give (Polish, without diacritics, and English). */
  keys: string[];
  kind: 'material' | 'tool' | 'food' | 'bucket' | 'armor';
  tool?: ToolKind;
  tier?: 1 | 2 | 3 | 4;
  durability?: number;
  hunger?: number;
  heal?: number;
  /** Armor metadata: which slot it occupies and how many armor points it adds. */
  armor?: { slot: 0 | 1 | 2 | 3; points: number };
  /** Flat color used by drop entities and the icon painter. */
  color: string;
}

const DUR = [0, 40, 90, 180, 420];

function tool(
  id: number,
  name: string,
  keys: string[],
  kind: ToolKind,
  tier: 1 | 2 | 3 | 4,
  color: string
): ItemDef {
  return { id, name, keys, kind: 'tool', tool: kind, tier, durability: DUR[tier], color };
}

const WOOD = '#c49a62';
const STONE = '#9a9a9a';
const IRON = '#d8d8d8';
const GEM = '#3ee0d0';

export const ITEM_LIST: ItemDef[] = [
  { id: I.STICK, name: 'Patyk', keys: ['patyk', 'stick'], kind: 'material', color: '#b5834a' },
  { id: I.COAL, name: 'Węgiel', keys: ['wegiel', 'węgiel', 'coal'], kind: 'material', color: '#2a2a2a' },
  { id: I.IRON, name: 'Sztabka żelaza', keys: ['zelazo', 'żelazo', 'iron'], kind: 'material', color: IRON },
  { id: I.GOLD, name: 'Sztabka złota', keys: ['zloto', 'złoto', 'gold'], kind: 'material', color: '#f6d34a' },
  { id: I.DIAMOND, name: 'Diament', keys: ['diament', 'diamond'], kind: 'material', color: GEM },
  { id: I.GUNPOWDER, name: 'Proch', keys: ['proch', 'gunpowder'], kind: 'material', color: '#6d6d72' },
  { id: I.SEEDS, name: 'Nasiona pszenicy', keys: ['nasiona', 'seeds'], kind: 'material', color: '#6ea84a' },
  { id: I.WHEAT, name: 'Pszenica', keys: ['pszenica', 'wheat'], kind: 'material', color: '#e2c04a' },
  { id: I.APPLE, name: 'Jabłko', keys: ['jablko', 'jabłko', 'apple'], kind: 'food', hunger: 4, heal: 1, color: '#d4372a' },
  { id: I.BREAD, name: 'Chleb', keys: ['chleb', 'bread'], kind: 'food', hunger: 6, heal: 1, color: '#d7a15a' },
  { id: I.RAW_PORK, name: 'Surowa wieprzowina', keys: ['wieprzowina', 'pork'], kind: 'food', hunger: 3, color: '#e08a8a' },
  { id: I.COOKED_PORK, name: 'Pieczona wieprzowina', keys: ['pieczona_wieprzowina', 'cooked_pork'], kind: 'food', hunger: 8, heal: 2, color: '#c46a45' },
  { id: I.RAW_BEEF, name: 'Surowa wołowina', keys: ['wolowina', 'wołowina', 'beef'], kind: 'food', hunger: 3, color: '#c45a5a' },
  { id: I.COOKED_BEEF, name: 'Stek', keys: ['stek', 'steak'], kind: 'food', hunger: 8, heal: 2, color: '#8a4030' },
  { id: I.RAW_CHICKEN, name: 'Surowy kurczak', keys: ['kurczak', 'chicken'], kind: 'food', hunger: 2, color: '#f0c9b0' },
  { id: I.COOKED_CHICKEN, name: 'Pieczony kurczak', keys: ['pieczony_kurczak', 'cooked_chicken'], kind: 'food', hunger: 6, heal: 1, color: '#e0a060' },
  { id: I.BUCKET, name: 'Wiadro', keys: ['wiadro', 'bucket'], kind: 'bucket', color: '#8e8e92' },
  { id: I.WATER_BUCKET, name: 'Wiadro wody', keys: ['wiadro_wody', 'water_bucket'], kind: 'bucket', color: '#3a6ad4' },
  { id: I.LAVA_BUCKET, name: 'Wiadro lawy', keys: ['wiadro_lawy', 'lava_bucket'], kind: 'bucket', color: '#e07020' },
  tool(I.WOOD_PICK, 'Drewniany kilof', ['drewniany_kilof', 'wood_pick'], 'pick', 1, WOOD),
  tool(I.STONE_PICK, 'Kamienny kilof', ['kamienny_kilof', 'stone_pick'], 'pick', 2, STONE),
  tool(I.IRON_PICK, 'Żelazny kilof', ['zelazny_kilof', 'iron_pick'], 'pick', 3, IRON),
  tool(I.DIAMOND_PICK, 'Diamentowy kilof', ['diamentowy_kilof', 'diamond_pick'], 'pick', 4, GEM),
  tool(I.WOOD_AXE, 'Drewniana siekiera', ['drewniana_siekiera', 'wood_axe'], 'axe', 1, WOOD),
  tool(I.STONE_AXE, 'Kamienna siekiera', ['kamienna_siekiera', 'stone_axe'], 'axe', 2, STONE),
  tool(I.IRON_AXE, 'Żelazna siekiera', ['zelazna_siekiera', 'iron_axe'], 'axe', 3, IRON),
  tool(I.DIAMOND_AXE, 'Diamentowa siekiera', ['diamentowa_siekiera', 'diamond_axe'], 'axe', 4, GEM),
  tool(I.WOOD_SHOVEL, 'Drewniana łopata', ['drewniana_lopata', 'wood_shovel'], 'shovel', 1, WOOD),
  tool(I.STONE_SHOVEL, 'Kamienna łopata', ['kamienna_lopata', 'stone_shovel'], 'shovel', 2, STONE),
  tool(I.IRON_SHOVEL, 'Żelazna łopata', ['zelazna_lopata', 'iron_shovel'], 'shovel', 3, IRON),
  tool(I.DIAMOND_SHOVEL, 'Diamentowa łopata', ['diamentowa_lopata', 'diamond_shovel'], 'shovel', 4, GEM),
  tool(I.WOOD_SWORD, 'Drewniany miecz', ['drewniany_miecz', 'wood_sword'], 'sword', 1, WOOD),
  tool(I.STONE_SWORD, 'Kamienny miecz', ['kamienny_miecz', 'stone_sword'], 'sword', 2, STONE),
  tool(I.IRON_SWORD, 'Żelazny miecz', ['zelazny_miecz', 'iron_sword'], 'sword', 3, IRON),
  tool(I.DIAMOND_SWORD, 'Diamentowy miecz', ['diamentowy_miecz', 'diamond_sword'], 'sword', 4, GEM),
  tool(I.WOOD_HOE, 'Drewniana motyka', ['drewniana_motyka', 'wood_hoe'], 'hoe', 1, WOOD),
  tool(I.STONE_HOE, 'Kamienna motyka', ['kamienna_motyka', 'stone_hoe'], 'hoe', 2, STONE),
  tool(I.IRON_HOE, 'Żelazna motyka', ['zelazna_motyka', 'iron_hoe'], 'hoe', 3, IRON),
  tool(I.DIAMOND_HOE, 'Diamentowa motyka', ['diamentowa_motyka', 'diamond_hoe'], 'hoe', 4, GEM),
  { id: I.FLINT, name: 'Krzemień', keys: ['krzemien', 'krzemień', 'flint'], kind: 'material', color: '#6a6a72' },
  { id: I.SHEARS, name: 'Nożyce', keys: ['nozyce', 'nożyce', 'shears'], kind: 'tool', tool: 'shears', durability: 120, color: '#d8d8e0' },
  { id: I.FLINT_STEEL, name: 'Krzesiwo', keys: ['krzesiwo', 'flint_and_steel', 'zapalniczka'], kind: 'tool', tool: 'igniter', durability: 48, color: '#c8c8d0' },
  { id: I.COMPASS, name: 'Kompas', keys: ['kompas', 'compass'], kind: 'material', color: '#c44848' },
  { id: I.CLOCK, name: 'Zegar', keys: ['zegar', 'clock'], kind: 'material', color: '#e2c14a' },
  { id: I.STRING, name: 'Struna', keys: ['struna', 'string'], kind: 'material', color: '#e8e8ea' },
  { id: I.BONE, name: 'Kość', keys: ['kosc', 'kość', 'bone'], kind: 'material', color: '#efe9d8' },
  { id: I.FEATHER, name: 'Pióro', keys: ['pioro', 'piórko', 'feather'], kind: 'material', color: '#f2f2f0' },
  { id: I.ARROW, name: 'Strzała', keys: ['strzala', 'strzała', 'arrow'], kind: 'material', color: '#c8b08a' },
  { id: I.BOW, name: 'Łuk', keys: ['luk', 'łuk', 'bow'], kind: 'tool', tool: 'bow', durability: 200, color: '#8a5a2b' },
  { id: I.LAPIS, name: 'Lazuryt', keys: ['lazuryt', 'lapis', 'lapis_lazuli'], kind: 'material', color: '#3a5fd0' },
  { id: I.PAPER, name: 'Papier', keys: ['papier', 'paper'], kind: 'material', color: '#f2f2ee' },
  { id: I.BOOK, name: 'Książka', keys: ['ksiazka', 'książka', 'book'], kind: 'material', color: '#9a4a3a' },
  { id: I.EMERALD, name: 'Szmaragd', keys: ['szmaragd', 'emerald'], kind: 'material', color: '#2ed06a' },
  { id: I.LEATHER, name: 'Skóra', keys: ['skora', 'skóra', 'leather'], kind: 'material', color: '#8a5a3b' },
  { id: I.SHIELD, name: 'Tarcza', keys: ['tarcza', 'shield'], kind: 'tool', tool: 'shield', durability: 300, color: '#8a6a3a' },
];

const ARMOR_TIERS: {
  prefix: string; keys: [string, string]; color: string;
  points: [number, number, number, number]; // head, chest, legs, feet
  durability: [number, number, number, number];
  names: [string, string, string, string];
}[] = [
  {
    prefix: 'skorzany', keys: ['skorzany', 'leather'], color: '#8a5a3b',
    points: [1, 3, 2, 1], durability: [55, 70, 75, 55],
    names: ['Skórzany kaptur', 'Skórzany napierśnik', 'Skórzane nogawice', 'Skórzane buty'],
  },
  {
    prefix: 'zelazny', keys: ['zelazny', 'iron'], color: '#d8d8d8',
    points: [2, 5, 6, 2], durability: [165, 240, 275, 165],
    names: ['Żelazny kaptur', 'Żelazny napierśnik', 'Żelazne nogawice', 'Żelazne buty'],
  },
  {
    prefix: 'zloty', keys: ['zloty', 'gold'], color: '#f6d34a',
    points: [2, 5, 6, 2], durability: [75, 100, 105, 75],
    names: ['Złoty kaptur', 'Złoty napierśnik', 'Złote nogawice', 'Złote buty'],
  },
  {
    prefix: 'diamontowy', keys: ['diamontowy', 'diamond'], color: '#3ee0d0',
    points: [3, 8, 6, 3], durability: [365, 480, 540, 365],
    names: ['Diamentowy kaptur', 'Diamentowy napierśnik', 'Diamentowe nogawice', 'Diamentowe buty'],
  },
];

const SLOT_KEYS = [
  ['kaptur', 'helmet'],
  ['napiersnik', 'chestplate', 'chest'],
  ['nogawice', 'leggings', 'legs'],
  ['buty', 'boots'],
];
const SLOT_ORDER: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

const armorItems: ItemDef[] = [];
ARMOR_TIERS.forEach((tier, ti) => {
  const baseId = [I.LEATHER_HELMET, I.IRON_HELMET, I.GOLD_HELMET, I.DIAMOND_HELMET][ti];
  SLOT_ORDER.forEach((slot, si) => {
    const id = baseId + si;
    const en = SLOT_KEYS[si][1];
    armorItems.push({
      id,
      name: tier.names[si],
      keys: [`${tier.keys[0]}_${SLOT_KEYS[si][0]}`, `${tier.keys[1]}_${en}`],
      kind: 'armor',
      durability: tier.durability[si],
      armor: { slot, points: tier.points[si] },
      color: tier.color,
    });
  });
});
ITEM_LIST.push(...armorItems);

export const ITEMS: (ItemDef | undefined)[] = [];
for (const it of ITEM_LIST) ITEMS[it.id] = it;

const KEYS = new Map<string, number>();
for (const b of BLOCKS) {
  if (!b || b.id === 0) continue;
  KEYS.set(String(b.id), b.id);
  KEYS.set(fold(b.name), b.id);
}
// Items are registered last so their aliases win over same-named blocks
// (e.g. "pszenica" is the wheat item, not the wheat crop block).
for (const it of ITEM_LIST) {
  KEYS.set(String(it.id), it.id);
  for (const k of it.keys) KEYS.set(k, it.id);
}
// A block whose name was shadowed by an item alias stays reachable as "<nazwa>_blok".
for (const b of BLOCKS) {
  if (!b || b.id === 0) continue;
  const n = fold(b.name);
  if (KEYS.get(n) !== b.id && !KEYS.has(n + '_blok')) KEYS.set(n + '_blok', b.id);
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

export function itemDef(id: number): ItemDef | undefined {
  return ITEMS[id];
}

export function isItem(id: number): boolean {
  return !!ITEMS[id];
}

export function displayName(id: number): string {
  return ITEMS[id]?.name || BLOCKS[id]?.name || 'Nieznane';
}

export function stackLimit(id: number): number {
  const it = ITEMS[id];
  if (!it) return 64;
  if (it.kind === 'tool' || it.kind === 'armor') return 1;
  if (it.kind === 'bucket') return 16;
  return 64;
}

export function durabilityMax(id: number): number {
  return ITEMS[id]?.durability ?? 0;
}

export const CREATIVE_ITEMS: number[] = ITEM_LIST.map((it) => it.id);

const TIER_SPEED = [0, 2, 4, 6, 8];

const PICK_BLOCKS = new Set<number>([
  B.STONE, B.COBBLE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.BRICK, B.FURNACE,
  B.FURNACE_ON, B.OBSIDIAN, B.STONE_BRICKS, B.SANDSTONE, B.MOSSY, B.ICE, B.GLOWSTONE, B.BEDROCK,
  B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK, B.LAPIS_ORE, B.LAPIS_BLOCK, B.ENCHANT,
  B.EMERALD_ORE, B.EMERALD_BLOCK, B.LANTERN, B.BELL,
]);
const AXE_BLOCKS = new Set<number>([
  B.LOG, B.BIRCH_LOG, B.PLANKS, B.CRAFTING, B.BOOKSHELF, B.PUMPKIN, B.BED,
]);
const SHOVEL_BLOCKS = new Set<number>([
  B.DIRT, B.GRASS, B.SAND, B.GRAVEL, B.SNOW, B.CLAY, B.FARMLAND, B.PATH,
]);
const ORES = new Set<number>([B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.LAPIS_ORE, B.EMERALD_ORE]);

export function isOre(id: number): boolean {
  return ORES.has(id);
}

export function pickTier(toolId: number): number {
  const tool = ITEMS[toolId];
  return tool?.tool === 'pick' ? tool.tier ?? 1 : 0;
}

/** 0 = any tool. 1 wood, 2 stone, 3 iron, 4 diamond. */
export function requiredPickTier(blockId: number): number {
  if (blockId === B.OBSIDIAN) return 4;
  if (blockId === B.DIAMOND_ORE) return 3;
  if (blockId === B.IRON_ORE || blockId === B.GOLD_ORE) return 2;
  if (blockId === B.LAPIS_ORE) return 2;
  if (blockId === B.EMERALD_ORE) return 3;
  if (blockId === B.EMERALD_BLOCK) return 2;
  if (blockId === B.GOLD_BLOCK || blockId === B.DIAMOND_BLOCK) return 3;
  if (blockId === B.IRON_BLOCK) return 2;
  if (PICK_BLOCKS.has(blockId)) return 1;
  return 0;
}

export function pickHint(blockId: number, toolId: number): string | null {
  if (pickTier(toolId) >= requiredPickTier(blockId)) return null;
  const need = requiredPickTier(blockId);
  if (need >= 4) return 'Obsydian kruszy tylko diamentowy kilof.';
  if (need >= 3) return 'Ruda diamentu wymaga żelaznego kilofa.';
  if (need >= 2) return 'Ta ruda wymaga co najmniej kamiennego kilofa.';
  if (need >= 1) return 'Do tego bloku potrzebny jest kilof.';
  return null;
}

/** Seconds of holding LMB to break this block with the given tool (0 = hand).
 *  `eff` is the Efficiency level of the held item (update 1.5). */
export function mineSeconds(blockId: number, toolId: number, eff = 0): number {
  const def = BLOCKS[blockId];
  if (!def || def.hardness < 0) return 1e9;
  if (def.hardness === 0) return 0.05;
  const tool = ITEMS[toolId];
  if (tool?.tool === 'shears' && (blockId === B.LEAVES || blockId === B.BIRCH_LEAVES || blockId === B.TALLGRASS)) return 0.12;
  const need = requiredPickTier(blockId);
  const tier = pickTier(toolId);
  if (blockId === B.OBSIDIAN) return tier >= 4 ? 7.5 : Infinity;
  if (need >= 2 && tier < need) return Infinity;
  let speed = 1;
  let penalty = 1;
  if (PICK_BLOCKS.has(blockId)) {
    if (tier >= need && tier > 0) speed = TIER_SPEED[tier];
    else penalty = 3.2;
  } else if (AXE_BLOCKS.has(blockId) || isDoor(blockId) || isLadder(blockId) || isTrap(blockId) || blockId === B.FENCE || blockId === B.CHEST || blockId === B.LOOT_CHEST || blockId === B.CAMPFIRE) {
    if (tool?.tool === 'axe') speed = TIER_SPEED[tool.tier ?? 1];
  } else if (SHOVEL_BLOCKS.has(blockId)) {
    if (tool?.tool === 'shovel') speed = TIER_SPEED[tool.tier ?? 1];
  } else if (tool?.tool === 'sword' && (RENDER[blockId] === 1 || blockId === B.LEAVES || blockId === B.BIRCH_LEAVES)) {
    speed = 5;
  }
  if (eff > 0) speed *= 1 + eff * 0.35 + eff * eff * 0.12;
  return ((def.hardness * 0.5 + 0.06) * penalty) / speed;
}

export function toolHelps(blockId: number, toolId: number): boolean {
  const tool = ITEMS[toolId];
  if (!tool?.tool) return false;
  if (tool.tool === 'pick') return PICK_BLOCKS.has(blockId);
  if (tool.tool === 'axe') return AXE_BLOCKS.has(blockId) || isDoor(blockId) || isLadder(blockId) || isTrap(blockId) || blockId === B.FENCE || blockId === B.CHEST || blockId === B.LOOT_CHEST || blockId === B.CAMPFIRE;
  if (tool.tool === 'shovel') return SHOVEL_BLOCKS.has(blockId);
  if (tool.tool === 'sword') return RENDER[blockId] === 1 || blockId === B.LEAVES || blockId === B.BIRCH_LEAVES;
  if (tool.tool === 'shears') return blockId === B.LEAVES || blockId === B.BIRCH_LEAVES || blockId === B.TALLGRASS;
  return tool.tool === 'hoe' && (blockId === B.DIRT || blockId === B.GRASS);
}

/** `sharp` is the Sharpness level of the held weapon (update 1.5). */
export function attackDamage(toolId: number, sprinting: boolean, sharp = 0): number {
  const tool = ITEMS[toolId];
  let d = 3;
  if (tool?.tool === 'sword') d = [0, 5, 6, 7, 9][tool.tier ?? 1];
  if (sharp > 0) d += sharp * 0.5 + 0.5;
  else if (tool?.tool === 'shield') d = 2;
  else if (tool?.tool === 'shears' || tool?.tool === 'igniter' || tool?.tool === 'bow') d = 1;
  else if (tool?.tool) d = 4;
  if (sprinting) d += 2;
  return d;
}

export function attackCooldown(toolId: number): number {
  return ITEMS[toolId]?.tool === 'sword' ? 0.42 : 0.5;
}

/** What a broken block yields. Empty array = nothing (wrong tool on ore, leaves that rolled nothing).
 *  `opts.fortune` (Szczęście) multiplies ore/crop yields, `opts.silk`
 *  (Jedwabny dotyk) makes the block drop in its original form. */
export interface DropOpts { fortune?: number; silk?: boolean }
export function blockDrops(blockId: number, toolId: number, opts: DropOpts = {}): Stack[] {
  const tier = pickTier(toolId);
  const shears = ITEMS[toolId]?.tool === 'shears';
  const fortune = Math.max(0, Math.floor(opts.fortune ?? 0));
  // Jedwabny dotyk: blok wypada taki, jaki stał (kamień, szkło, ruda, liście…)
  if (opts.silk) {
    if (blockId === B.AIR || BLOCKS[blockId]?.hardness < 0) return [];
    if (RENDER[blockId] === 1 && (blockId < B.CROP0 || blockId > B.CROP3)) {
      // cross plants (flowers, saplings, tall grass, torch) drop as themselves
      return [{ id: blockId, count: 1 }];
    }
    if (blockId === B.COAL_ORE || blockId === B.DIAMOND_ORE || blockId === B.IRON_ORE || blockId === B.GOLD_ORE ||
        blockId === B.LAPIS_ORE || blockId === B.EMERALD_ORE || blockId === B.STONE || blockId === B.GLASS || blockId === B.ICE ||
        blockId === B.LEAVES || blockId === B.BIRCH_LEAVES || blockId === B.GRASS || blockId === B.SNOW ||
        blockId === B.FARMLAND || (blockId >= B.CROP0 && blockId <= B.CROP3)) {
      return [{ id: blockId, count: 1 }];
    }
    if (BLOCKS[blockId]?.drop >= 0) return [{ id: blockId, count: 1 }];
    return [];
  }
  if (shears && (blockId === B.LEAVES || blockId === B.BIRCH_LEAVES || blockId === B.TALLGRASS)) return [{ id: blockId, count: 1 }];
  if (blockId === B.GRAVEL) return Math.random() < 0.12 ? [{ id: I.FLINT, count: 1 }] : [{ id: B.GRAVEL, count: 1 }];
  if (blockId === B.COAL_ORE) return tier >= 1 ? [{ id: I.COAL, count: 1 + (fortune ? Math.floor(Math.random() * (fortune + 1)) : 0) }] : [];
  if (blockId === B.DIAMOND_ORE) return tier >= 3 ? [{ id: I.DIAMOND, count: 1 + (fortune ? Math.floor(Math.random() * fortune) : 0) }] : [];
  if (blockId === B.EMERALD_ORE) return tier >= 3 ? [{ id: I.EMERALD, count: 1 + (fortune ? Math.floor(Math.random() * fortune) : 0) }] : [];
  if (blockId === B.LAPIS_ORE) return tier >= 2 ? [{ id: I.LAPIS, count: 4 + Math.floor(Math.random() * 4) + (fortune ? Math.floor(Math.random() * (fortune + 1)) * 2 : 0) }] : [];
  if (blockId === B.IRON_ORE || blockId === B.GOLD_ORE) return tier >= 2 ? [{ id: blockId, count: 1 }] : [];
  if (blockId === B.LEAVES) {
    const out: Stack[] = [];
    if (Math.random() < 0.1) out.push({ id: B.SAPLING, count: 1 });
    if (Math.random() < 0.045) out.push({ id: I.APPLE, count: 1 });
    return out;
  }
  if (blockId === B.BIRCH_LEAVES) return Math.random() < 0.1 ? [{ id: B.BIRCH_SAPLING, count: 1 }] : [];
  if (blockId === B.TALLGRASS) return Math.random() < 0.18 ? [{ id: I.SEEDS, count: 1 }] : [];
  if (blockId === B.GRASS) {
    const out: Stack[] = [{ id: B.DIRT, count: 1 }];
    if (Math.random() < 0.12) out.push({ id: I.SEEDS, count: 1 });
    return out;
  }
  if (blockId === B.CROP0 || blockId === B.CROP1 || blockId === B.CROP2) return [{ id: I.SEEDS, count: 1 }];
  if (blockId === B.CROP3) {
    const extra = fortune ? Math.floor(Math.random() * (fortune + 1)) : 0;
    return [
      { id: I.WHEAT, count: 1 + extra },
      { id: I.SEEDS, count: 1 + (Math.random() < 0.45 ? 1 : 0) + extra },
    ];
  }
  if (blockId === B.FURNACE_ON) return [{ id: B.FURNACE, count: 1 }];
  const def = BLOCKS[blockId];
  if (!def || def.drop < 0) return [];
  return [{ id: def.drop, count: 1 }];
}

export function smeltResult(id: number): number | null {
  switch (id) {
    case B.IRON_ORE:
      return I.IRON;
    case B.GOLD_ORE:
      return I.GOLD;
    case B.SAND:
      return B.GLASS;
    case B.COBBLE:
      return B.STONE;
    case B.CLAY:
      return B.BRICK;
    case B.COAL_ORE:
      return I.COAL;
    case B.LOG:
    case B.BIRCH_LOG:
      return I.COAL;
    case I.RAW_PORK:
      return I.COOKED_PORK;
    case I.RAW_BEEF:
      return I.COOKED_BEEF;
    case I.RAW_CHICKEN:
      return I.COOKED_CHICKEN;
    default:
      return null;
  }
}

/** Seconds of burn time one item of fuel provides. 0 = not fuel. */
export function fuelSeconds(id: number): number {
  if (id === I.COAL || id === B.COAL_ORE) return 32;
  if (id === B.PLANKS || id === B.LOG || id === B.BIRCH_LOG || id === B.CRAFTING || id === B.BOOKSHELF || id === B.CHEST || id === B.FENCE || id === B.TRAP || id === B.CAMPFIRE || isDoor(id)) return 6;
  if (id === I.STICK || id === B.SAPLING || id === B.BIRCH_SAPLING || isLadder(id)) return 2;
  if (id === B.HAY) return 6;
  if (id === B.WOOL_WHITE || id === B.WOOL_RED || id === B.WOOL_BLUE || id === B.WOOL_GREEN || id === B.WOOL_YELLOW || id === B.WOOL_BLACK) return 3;
  const it = ITEMS[id];
  if (it?.tool && it.tier === 1) return 4;
  return 0;
}

export function resolveId(arg: string): number | null {
  const q = fold(arg.trim());
  if (!q) return null;
  if (KEYS.has(q)) return KEYS.get(q)!;
  const n = parseInt(arg, 10);
  if (!Number.isNaN(n) && (BLOCKS[n] || ITEMS[n])) return n;
  return null;
}

export function isFood(id: number): boolean {
  return ITEMS[id]?.kind === 'food';
}

export function isHoe(id: number): boolean {
  return ITEMS[id]?.tool === 'hoe';
}
