import { I } from './items';
import type { Stack } from './inventory';

/** A single equipped slot; items in a backpack or hotbar have no passive effect. */
export const TALISMANS: Readonly<Record<number, { description: string; factor: number }>> = {
  [I.WANDER_CHARM]: { description: 'Ruch pieszo +5%, bez wpływu na lot.', factor: 1.05 },
  [I.TIDE_CHARM]: { description: 'Powietrze pod wodą zużywa się o 20% wolniej.', factor: 0.8 },
};

export function isTalisman(id: number): boolean { return id === I.WANDER_CHARM || id === I.TIDE_CHARM; }

export function restoreTalisman(raw: unknown): Stack | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Stack>;
  return typeof s.id === 'number' && isTalisman(s.id) && s.count === 1
    ? { id: s.id, count: 1 } : null;
}

// Kept distinct from potion effects: no duration, no stacking and no effect from inventory.
export function walkCharmFactor(equipped: Stack | null): number {
  return equipped?.id === I.WANDER_CHARM ? TALISMANS[I.WANDER_CHARM].factor : 1;
}
export function breathCharmFactor(equipped: Stack | null): number {
  return equipped?.id === I.TIDE_CHARM ? TALISMANS[I.TIDE_CHARM].factor : 1;
}

