import { enchLevel } from './enchant';
import { ITEMS } from './items';
import type { Stack } from './inventory';

/**
 * Player armor. The item definitions live in items.ts (kind "armor"); this
 * module only derives per-slot stats and the damage formula so the engine
 * stays out of the data tables.
 */

export type ArmorSlot = 0 | 1 | 2 | 3; // head, chest, legs, feet

export const ARMOR_SLOT_COUNT = 4;

export const ARMOR_SLOT_NAMES = ['Kaptur', 'Napierśnik', 'Nogawice', 'Buty'] as const;

export interface ArmorInfo {
  id: number;
  slot: ArmorSlot;
  /** Base armor points; effective protection also depends on incoming damage. */
  points: number;
  toughness: number;
  /** Maximum durability. */
  max: number;
}

export const ARMOR: (ArmorInfo | undefined)[] = [];
for (const it of ITEMS) {
  if (it?.kind === 'armor') {
    ARMOR[it.id] = { id: it.id, slot: it.armor!.slot, points: it.armor!.points, toughness: it.armor!.toughness ?? 0, max: it.durability ?? 1 };
  }
}

export function armorInfo(id: number): ArmorInfo | undefined {
  return ARMOR[id];
}

export function isArmor(id: number): boolean {
  return !!ARMOR[id];
}

export function armorSlotOf(id: number): ArmorSlot | null {
  return ARMOR[id]?.slot ?? null;
}

/** Sum of armor points of the four equipped pieces. */
export function armorPoints(equipped: (Stack | null)[]): number {
  let sum = 0;
  for (const s of equipped) {
    if (!s) continue;
    sum += ARMOR[s.id]?.points ?? 0;
  }
  return sum;
}

/** Java CombatRules: stronger hits penetrate armor; toughness limits penetration. */
export function damageReduction(points: number, damage = 0, toughness = 0): number {
  const effective = Math.min(20, Math.max(points * 0.2, points - damage / (2 + toughness / 4)));
  return Math.max(0, effective / 25);
}

export function armorToughness(equipped: (Stack | null)[]): number {
  return equipped.reduce((sum, s) => sum + (s ? ARMOR[s.id]?.toughness ?? 0 : 0), 0);
}

export type DamageKind = 'normal' | 'fall' | 'drown';
/** Environmental bypass skips armor points/wear, not the separate Protection stage. */
export function usesArmor(kind: DamageKind): boolean { return kind === 'normal'; }

export function damageAfterArmor(amount: number, equipped: (Stack | null)[], kind: DamageKind = 'normal'): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return usesArmor(kind) ? amount * (1 - damageReduction(armorPoints(equipped), amount, armorToughness(equipped))) : amount;
}
export function damageAfterEnchantments(amount: number, equipped: (Stack | null)[], kind: DamageKind = 'normal'): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  let epf = 0;
  for (const piece of equipped) if (piece && ARMOR[piece.id]) epf += Math.min(4, Math.max(0, enchLevel(piece, 'protection')));
  if (kind === 'fall') epf += 3 * Math.min(4, Math.max(0, enchLevel(equipped[3], 'featherfalling')));
  return amount * (1 - Math.min(20, epf) / 25);
}

export function damageAfterProtection(amount: number, equipped: (Stack | null)[], kind: DamageKind = 'normal'): number {
  return damageAfterEnchantments(damageAfterArmor(amount, equipped, kind), equipped, kind);
}

/** Armor wears from incoming damage, before absorption, with integer truncation. */
export function armorWear(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? Math.max(1, Math.floor(amount / 4)) : 0;
}
/** Java armor Unbreaking still spends 60% of points before its ordinary roll. */
export function armorPointWears(level: number, random: () => number = Math.random): boolean {
  const n = Number.isFinite(level) ? Math.max(0, Math.min(3, Math.floor(level))) : 0;
  return n === 0 || random() < .6 || Math.floor(random() * (n + 1)) === 0;
}
