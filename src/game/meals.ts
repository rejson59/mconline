import { I, type PotionEffectId } from './items';

/** Meals reuse the existing (saved, bounded, HUD-visible) potion timer system.
 * A short refresh never adds time on top of an active potion or another meal. */
export const MEAL_BONUSES: Readonly<Partial<Record<number, { effect: PotionEffectId; seconds: number; bowl: boolean }>>> = {
  [I.PUMPKIN_SOUP]: { effect: 'speed', seconds: 8, bowl: true },
  [I.RABBIT_STEW]: { effect: 'regen', seconds: 6, bowl: true },
  [I.HARVEST_PLATE]: { effect: 'sprint', seconds: 7, bowl: false },
};

export function mealBonus(id: number) { return MEAL_BONUSES[id] ?? null; }
