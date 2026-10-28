import { B } from './blocks';
import { I, stackLimit } from './items';
import type { Stack } from './inventory';

export interface ChestState {
  x: number;
  y: number;
  z: number;
  slots: (Stack | null)[];
  /** 1.8: 1 = skrzynia stoi w Netherze (osobny klucz, obcy wymiar jej nie przejmie). */
  dim?: number;
}

export const CHEST_SLOTS = 27;
export type ChestLootKind = 'cave' | 'house' | 'smith' | 'library' | 'farm' | 'bakery' | 'apothecary' | 'watchtower' | 'mine' | 'crater' | 'portal' | 'temple' | 'swamp';
interface LootEntry { id: number; min: number; max: number; weight: number }
const entry = (id: number, min = 1, max = min, weight = 5): LootEntry => ({ id, min, max, weight });
/** Weighted, distinct rewards; tools/armor/potions obey their actual stack limits. */
const TABLES: Record<Exclude<ChestLootKind, 'cave'>, LootEntry[]> = {
  house: [entry(I.BREAD, 2, 5), entry(I.APPLE, 2, 5), entry(I.STICK, 3, 9), entry(B.PLANKS, 4, 12), entry(I.SEEDS, 2, 7), entry(I.WHEAT, 2, 6), entry(B.TORCH, 3, 8), entry(I.LEATHER, 1, 3), entry(I.EMERALD, 1, 2, 1), entry(I.WOOD_AXE), entry(I.STRING, 1, 4)],
  smith: [entry(I.IRON, 2, 5, 9), entry(I.COAL, 3, 9, 9), entry(I.IRON_PICK, 1, 1, 3), entry(I.STONE_AXE), entry(I.IRON_SWORD, 1, 1, 2), entry(I.IRON_HELMET, 1, 1, 2), entry(I.FLINT, 2, 5), entry(I.BREAD, 1, 3), entry(I.GOLD, 1, 3, 2), entry(I.DIAMOND, 1, 1, 0.25), entry(B.OBSIDIAN, 1, 3, 2)],
  library: [entry(I.PAPER, 4, 12, 9), entry(I.BOOK, 1, 4, 8), entry(I.FEATHER, 1, 4), entry(I.STRING, 2, 5), entry(I.LAPIS, 2, 6), entry(I.COMPASS, 1, 1, 1), entry(I.EMERALD, 1, 2, 2), entry(B.TORCH, 2, 6), entry(I.APPLE, 1, 3), entry(B.BOOKSHELF, 1, 2, 2)],
  farm: [entry(I.SEEDS, 4, 12, 9), entry(I.WHEAT, 3, 10, 9), entry(I.BREAD, 2, 5), entry(I.APPLE, 2, 4), entry(I.WOOD_HOE), entry(I.STONE_HOE, 1, 1, 2), entry(I.BUCKET, 1, 1, 2), entry(B.HAY, 1, 3), entry(I.STICK, 2, 6), entry(I.SUGAR, 1, 4)],
  bakery: [entry(I.BREAD, 3, 7, 10), entry(I.WHEAT, 4, 12, 9), entry(I.SUGAR, 2, 6), entry(I.APPLE, 2, 6), entry(I.COAL, 2, 6), entry(I.HONEY_BOTTLE, 1, 1, 2), entry(I.BUCKET, 1, 1, 1), entry(I.COOKED_CHICKEN, 1, 3, 2), entry(B.HAY, 1, 3), entry(I.STICK, 2, 5)],
  apothecary: [entry(I.BOTTLE, 1, 1, 9), entry(I.SUGAR, 2, 5), entry(I.NETHER_WART, 1, 3), entry(I.GLOWSTONE_DUST, 1, 3), entry(I.REDSTONE, 1, 4), entry(I.WATER_BOTTLE), entry(I.POTION_HEAL, 1, 1, 2), entry(I.POTION_NIGHT, 1, 1, 1), entry(I.BOOK, 1, 2), entry(I.HONEY_BOTTLE, 1, 1, 2), entry(I.MAGMA_CREAM, 1, 1, 1)],
  watchtower: [entry(I.ARROW, 6, 16, 9), entry(I.STRING, 2, 6), entry(I.BOW, 1, 1, 2), entry(I.LEATHER_HELMET, 1, 1, 3), entry(I.BREAD, 2, 5), entry(B.TORCH, 4, 10), entry(I.FLINT, 2, 5), entry(I.FEATHER, 2, 5), entry(I.IRON, 1, 3, 2), entry(I.SHIELD, 1, 1, 1)],
  mine: [entry(B.TORCH, 5, 12, 9), entry(B.RAIL, 5, 16, 8), entry(I.COAL, 4, 10), entry(I.IRON, 2, 6), entry(I.STONE_PICK), entry(I.IRON_PICK, 1, 1, 2), entry(I.BREAD, 2, 4), entry(I.REDSTONE, 3, 8), entry(I.LAPIS, 2, 5), entry(I.GOLD, 1, 3, 2), entry(I.DIAMOND, 1, 1, 0.2)],
  crater: [entry(B.BASALT, 4, 12), entry(B.BLACKSTONE, 3, 9), entry(I.COAL, 3, 7), entry(I.IRON, 2, 5), entry(I.FLINT, 2, 5), entry(I.GOLD, 1, 3, 2), entry(B.OBSIDIAN, 1, 3, 2), entry(I.GUNPOWDER, 1, 4), entry(I.QUARTZ, 2, 5), entry(I.DIAMOND, 1, 1, 0.15)],
  portal: [entry(B.OBSIDIAN, 2, 5, 9), entry(I.FLINT_STEEL, 1, 1, 4), entry(I.GOLD, 2, 6), entry(I.GOLD_BOOTS, 1, 1, 2), entry(I.NETHER_WART, 1, 4), entry(I.QUARTZ, 2, 6), entry(I.GLOWSTONE_DUST, 2, 5), entry(I.COAL, 2, 6), entry(I.POTION_FIRE, 1, 1, 1), entry(I.FLINT, 2, 5)],
  temple: [entry(I.GOLD, 2, 6, 8), entry(I.BONE, 3, 8), entry(I.STRING, 3, 8), entry(I.EMERALD, 1, 3, 3), entry(I.GUNPOWDER, 2, 5), entry(I.IRON, 2, 5), entry(I.BOOK, 1, 2), entry(I.LAPIS, 2, 6), entry(I.DIAMOND, 1, 1, 0.3), entry(I.BREAD, 1, 3)],
  swamp: [entry(I.BOTTLE), entry(I.SUGAR, 2, 5), entry(I.NETHER_WART, 1, 4), entry(I.REDSTONE, 2, 6), entry(I.GLOWSTONE_DUST, 1, 4), entry(B.LILY_PAD, 1, 3), entry(I.SLIME_BALL, 1, 3), entry(I.BONE, 2, 5), entry(I.POTION_HEAL, 1, 1, 1), entry(I.STRING, 2, 5)],
};

function themedLoot(seed: number, x: number, y: number, z: number, kind: Exclude<ChestLootKind, 'cave'>): Stack[] {
  let state = Math.imul(seed, 374761393) ^ Math.imul(x, 668265263) ^ Math.imul(y, 144665) ^ Math.imul(z, 1274126177);
  for (const ch of kind) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const pool = TABLES[kind].map((e) => ({ ...e }));
  const count = 5 + Math.floor(random() * 4);
  const out: Stack[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = random() * total, index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) { roll -= pool[j].weight; if (roll < 0) { index = j; break; } }
    const [e] = pool.splice(index, 1);
    out.push({ id: e.id, count: Math.min(stackLimit(e.id), e.min + Math.floor(random() * (e.max - e.min + 1))) });
  }
  return out;
}


export function chestKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function emptyChest(x: number, y: number, z: number): ChestState {
  return { x, y, z, slots: new Array(CHEST_SLOTS).fill(null) };
}

function hash(seed: number, x: number, y: number, z: number): () => number {
  let h = (seed * 374761393 + x * 668265263 + y * 144665 + z * 1274126177) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

/** Deterministic cave-chest contents. Same seed and position always roll the same loot. */
export function chestLoot(seed: number, x: number, y: number, z: number, kind: ChestLootKind = 'cave'): Stack[] {
  if (kind !== 'cave') return themedLoot(seed, x, y, z, kind);
  const r = hash(seed, x, y, z);
  const out: Stack[] = [{ id: B.TORCH, count: 2 + Math.floor(r() * 5) }];
  if (r() < 0.75) out.push({ id: I.BREAD, count: 1 + Math.floor(r() * 3) });
  if (r() < 0.55) out.push({ id: I.COAL, count: 2 + Math.floor(r() * 5) });
  if (r() < 0.4) out.push({ id: B.PLANKS, count: 4 + Math.floor(r() * 8) });
  if (r() < 0.28) out.push({ id: I.IRON, count: 1 + Math.floor(r() * 2) });
  if (r() < 0.22) out.push({ id: I.SEEDS, count: 1 + Math.floor(r() * 2) });
  if (r() < 0.05) out.push({ id: I.DIAMOND, count: 1 });
  if (r() < 0.18) out.push({ id: I.PAPER, count: 2 + Math.floor(r() * 4) });
  if (r() < 0.10) out.push({ id: I.BOOK, count: 1 });
  if (r() < 0.06) out.push({ id: I.LAPIS, count: 2 + Math.floor(r() * 4) });
  if (r() < 0.08) out.push({ id: I.NETHER_WART, count: 1 + Math.floor(r() * 3) });
  return out;
}

export function lootChest(seed: number, x: number, y: number, z: number, kind: ChestLootKind = 'cave'): ChestState {
  const chest = emptyChest(x, y, z);
  chestLoot(seed, x, y, z, kind).forEach((s, i) => {
    chest.slots[i] = { ...s };
  });
  return chest;
}
