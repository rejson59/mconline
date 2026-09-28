import { I, isOre } from './items';
import { B } from './blocks';

/** Per-world rules. Optional in old saves; unrelated to device/graphics settings. */
export type Aggression = 'spokojna' | 'normalna' | 'zaciekla';
export type DamageLevel = 'lagodne' | 'normalne' | 'surowe';
export type ResourceLevel = 'skape' | 'normalne' | 'obfite';

export interface WorldDifficulty {
  aggression: Aggression;
  damage: DamageLevel;
  resources: ResourceLevel;
}

export const DEFAULT_DIFFICULTY: WorldDifficulty = {
  aggression: 'normalna', damage: 'normalne', resources: 'normalne',
};

export function normalizeDifficulty(raw: unknown): WorldDifficulty {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_DIFFICULTY };
  const d = raw as Record<string, unknown>;
  return {
    aggression: d.aggression === 'spokojna' || d.aggression === 'zaciekla' ? d.aggression : 'normalna',
    damage: d.damage === 'lagodne' || d.damage === 'surowe' ? d.damage : 'normalne',
    resources: d.resources === 'skape' || d.resources === 'obfite' ? d.resources : 'normalne',
  };
}

/** Passive animals are untouched. Existing hostile mobs stop attacking in calm mode. */
export function hostileCap(a: Aggression): number {
  return a === 'spokojna' ? 0 : a === 'zaciekla' ? 12 : 8;
}
export function hostileSpeed(a: Aggression): number {
  return a === 'zaciekla' ? 1.25 : 1;
}
export function mobDamage(damage: number, level: DamageLevel): number {
  return level === 'lagodne' ? Math.max(1, Math.ceil(damage * 0.7)) : level === 'surowe' ? Math.ceil(damage * 1.4) : damage;
}
/** Resource scarcity affects unmodified ore drops; normal keeps 2.7 behavior. */
export function oreYield(count: number, resources: ResourceLevel, roll?: number): number {
  return resources === 'skape' ? Math.max(0, count - ((roll ?? Math.random()) < 0.25 ? 1 : 0)) : resources === 'obfite' ? count + 1 : count;
}

/** Food from animals is not a placeable block, unlike wool or equipment. */
export function animalMeatYield(resources: ResourceLevel, roll?: number): number {
  return oreYield(1, resources, roll);
}

/** Placed ore blocks must never duplicate through rich-mode drops. */
export function resourceDropCount(blockId: number, dropId: number, count: number, resources: ResourceLevel, silk: boolean, roll?: number): number {
  if (silk) return count;
  // Only the ripe crop's edible yield varies. Seeds always survive harvest,
  // preventing scarcity from making a one-seed farm impossible to replant.
  if (blockId === B.CROP3 && dropId === I.WHEAT) return oreYield(count, resources, roll);
  if (!isOre(blockId)) return count;
  return oreYield(count, resources === 'obfite' && blockId === dropId ? 'normalne' : resources, roll);
}
