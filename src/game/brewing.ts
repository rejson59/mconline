/** Supported Java brewing recipes and tick-based stand simulation. No renderer. */
import type { Stack } from './inventory';
import { I, ITEMS, type PotionEffectId } from './items';
import { effectClock } from './statusEffects';
export type { PotionEffectId };
export interface PotionDef {
  id: number;
  name: string;
  effect: PotionEffectId;
  duration: number;
  color: string;
  desc: string;
}
const potion = (
  id: number,
  effect: PotionEffectId,
  duration: number,
  color: number,
  desc: string,
): PotionDef => ({
  id,
  name: ITEMS[id]?.name ?? '',
  effect,
  duration,
  color: '#' + color.toString(16).padStart(6, '0'),
  desc,
});
export const POTIONS: Record<number, PotionDef> = {
  [I.WATER_BOTTLE]: potion(
    I.WATER_BOTTLE,
    'none',
    0,
    3694022,
    'Woda — do klarownej mikstury dodaj brodawkę netherową.',
  ),
  [I.POTION_AWKWARD]: potion(
    I.POTION_AWKWARD,
    'none',
    0,
    3694022,
    'Baza mikstur; dodaj właściwy składnik efektu.',
  ),
  [I.POTION_MUNDANE]: potion(
    I.POTION_MUNDANE,
    'none',
    0,
    3694022,
    'Bez efektów. Nie jest bazą mikstur wzmacniających.',
  ),
  [I.POTION_THICK]: potion(
    I.POTION_THICK,
    'none',
    0,
    3694022,
    'Bez efektów. Pył jasnogłazu dodany do wody.',
  ),
  [I.POTION_HEAL]: potion(
    I.POTION_HEAL,
    'heal',
    0,
    16262179,
    'Natychmiastowe leczenie I: +4 HP.',
  ),
  [I.POTION_FIRE]: potion(
    I.POTION_FIRE,
    'fire',
    180,
    16750848,
    'Ognioodporność (3:00).',
  ),
  [I.POTION_SPEED]: potion(
    I.POTION_SPEED,
    'speed',
    180,
    3402751,
    'Szybkość (3:00): +20% prędkości.',
  ),
  [I.POTION_NIGHT]: potion(
    I.POTION_NIGHT,
    'night',
    180,
    12779366,
    'Noktowizja (3:00).',
  ),
  [I.POTION_STRENGTH]: potion(
    I.POTION_STRENGTH,
    'strength',
    180,
    16762624,
    'Siła (3:00): +3 obrażenia w zwarciu.',
  ),
  [I.POTION_REGEN]: potion(
    I.POTION_REGEN,
    'regen',
    45,
    13458603,
    'Regeneracja I (0:45): +1 HP co 2,5 s.',
  ),
};
export const HEAL_AMOUNT = 4;
export const STRENGTH_DAMAGE = 3;
export const SPEED_FACTOR = 1.2;
export const BREW_TIME = 20;
export const BREW_TICKS = 400;
export const BREW_FUELS = 20;
const MIXES = new Map<number, number>([
  [I.GLISTERING_MELON, I.POTION_HEAL],
  [I.MAGMA_CREAM, I.POTION_FIRE],
  [I.SUGAR, I.POTION_SPEED],
  [I.GOLDEN_CARROT, I.POTION_NIGHT],
  [I.BLAZE_POWDER, I.POTION_STRENGTH],
  [I.GHAST_TEAR, I.POTION_REGEN],
]);
export const BREWING_INGREDIENTS = new Set<number>([
  I.NETHER_WART,
  I.GLOWSTONE_DUST,
  I.REDSTONE,
  ...MIXES.keys(),
]);
export function brewResult(
  bottleId: number,
  ingredientId: number,
): number | null {
  if (bottleId === I.WATER_BOTTLE) {
    if (ingredientId === I.NETHER_WART) return I.POTION_AWKWARD;
    if (ingredientId === I.GLOWSTONE_DUST) return I.POTION_THICK;
    if (
      ingredientId === I.REDSTONE ||
      (MIXES.has(ingredientId) && ingredientId !== I.GOLDEN_CARROT)
    )
      return I.POTION_MUNDANE;
  }
  return bottleId === I.POTION_AWKWARD
    ? (MIXES.get(ingredientId) ?? null)
    : null;
}
export function applyBrew(
  bottles: (Stack | null)[],
  ingredientId: number,
): { bottles: (Stack | null)[]; brewed: boolean } {
  let brewed = false;
  const out = bottles.map((b, i) => {
    if (!b) return null;
    const next = i < 3 && b.count > 0 ? brewResult(b.id, ingredientId) : null;
    if (next === null) return { ...b };
    brewed = true;
    return { id: next, count: b.count };
  });
  return { bottles: out, brewed };
}
export interface BrewingState {
  x: number;
  y: number;
  z: number;
  dim?: number;
  bottles: (Stack | null)[];
  ingredient: Stack | null;
  fuel: Stack | null;
  fuelLeft: number;
  /** Elapsed seconds, mirrored for existing save readers. Zero can mean just started. */
  progress: number;
  /** New fields optional for legacy saves. */
  rules?: 1;
  remainingTicks?: number;
  brewingIngredient?: number;
  tickRemainder?: number;
}
export function brewingKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}
export function emptyBrewing(x: number, y: number, z: number): BrewingState {
  return {
    x,
    y,
    z,
    bottles: [null, null, null],
    ingredient: null,
    fuel: null,
    fuelLeft: 0,
    progress: 0,
    rules: 1,
    remainingTicks: 0,
    tickRemainder: 0,
  };
}
const positive = (s: Stack | null | undefined): s is Stack =>
  !!s && Number.isFinite(s.count) && s.count >= 1;
const integer = (n: unknown, max: number) =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.max(0, Math.min(max, Math.floor(n)))
    : 0;
/** Keep old items/paid fuel, but restart old eight-second in-flight recipes.
 * A rod stays a rod; players can remove it and craft powder without data loss. */
export function cleanBrewing(raw: BrewingState): BrewingState {
  const out = emptyBrewing(raw.x, raw.y, raw.z);
  out.dim = raw.dim;
  const copy = (s: Stack | null | undefined) =>
    positive(s) ? { ...s, ench: s.ench ? { ...s.ench } : undefined } : null;
  out.bottles = Array.from({ length: 3 }, (_, i) => copy(raw.bottles?.[i]));
  out.ingredient = copy(raw.ingredient);
  out.fuel = copy(raw.fuel);
  out.fuelLeft = integer(raw.fuelLeft, raw.rules === 1 ? BREW_FUELS : 3);
  if (raw.rules === 1) {
    out.remainingTicks = integer(raw.remainingTicks, BREW_TICKS);
    out.brewingIngredient =
      typeof raw.brewingIngredient === 'number' &&
      Number.isFinite(raw.brewingIngredient)
        ? raw.brewingIngredient
        : undefined;
    if (!out.brewingIngredient) out.remainingTicks = 0;
    out.progress =
      out.remainingTicks > 0 ? (BREW_TICKS - out.remainingTicks) / 20 : 0;
    out.tickRemainder =
      typeof raw.tickRemainder === 'number' &&
      Number.isFinite(raw.tickRemainder)
        ? Math.max(0, Math.min(0.049999999, raw.tickRemainder))
        : 0;
  }
  return out;
}
function brewable(s: BrewingState): boolean {
  return (
    positive(s.ingredient) &&
    s.bottles.some(
      (b) => positive(b) && brewResult(b.id, s.ingredient!.id) !== null,
    )
  );
}
export function canStartBrew(s: BrewingState): boolean {
  return (
    brewable(s) &&
    (s.fuelLeft > 0 || (positive(s.fuel) && s.fuel.id === I.BLAZE_POWDER))
  );
}
/** Native order per tick: load powder even if idle, decrement/cancel active
 * batch, otherwise spend a fuel charge to start 400 countdown ticks. */
export function tickBrewing(s: BrewingState, dt: number): { done: boolean } {
  if (!Number.isFinite(dt) || dt <= 0) return { done: false };
  if (s.rules !== 1) Object.assign(s, cleanBrewing(s));
  const clock = effectClock(s.tickRemainder ?? 0, dt);
  s.tickRemainder = clock.remainder;
  let done = false;
  for (let tick = 0; tick < clock.ticks; tick++) {
    if (s.fuelLeft <= 0 && positive(s.fuel) && s.fuel.id === I.BLAZE_POWDER) {
      s.fuelLeft = BREW_FUELS;
      if (--s.fuel.count <= 0) s.fuel = null;
    }
    const valid = brewable(s);
    if ((s.remainingTicks ?? 0) > 0) {
      s.remainingTicks = (s.remainingTicks ?? 0) - 1;
      if (s.remainingTicks === 0 && valid) {
        const result = applyBrew(s.bottles, s.ingredient!.id);
        s.bottles = result.bottles;
        if (--s.ingredient!.count <= 0) s.ingredient = null;
        done = done || result.brewed;
      } else if (!valid || s.ingredient?.id !== s.brewingIngredient)
        s.remainingTicks = 0;
    } else if (valid && s.fuelLeft > 0) {
      s.fuelLeft--;
      s.remainingTicks = BREW_TICKS;
      s.brewingIngredient = s.ingredient!.id;
    }
    s.progress =
      (s.remainingTicks ?? 0) > 0 ? (BREW_TICKS - s.remainingTicks!) / 20 : 0;
  }
  return { done };
}
/** Native GUI cropping: progress from top, seven-frame bubbles from bottom. */
export function brewingFrame(s: BrewingState): {
  progress: number;
  bubbles: number;
  fuel: number;
  lit: boolean;
} {
  const ticks =
    s.remainingTicks ??
    (s.progress > 0
      ? Math.max(0, BREW_TICKS - Math.floor(s.progress * 20))
      : 0);
  return {
    progress: ticks > 0 ? Math.floor(28 * (1 - ticks / BREW_TICKS)) : 0,
    bubbles:
      ticks > 0 ? [29, 24, 20, 16, 11, 6, 0][Math.floor(ticks / 2) % 7] : 0,
    fuel: Math.max(0, Math.min(18, Math.ceil((18 * s.fuelLeft) / BREW_FUELS))),
    lit: ticks > 0,
  };
}
export function potionName(id: number): string {
  return POTIONS[id]?.name ?? ITEMS[id]?.name ?? '';
}
export function potionEffect(id: number): PotionEffectId | null {
  return POTIONS[id]?.effect ?? null;
}
