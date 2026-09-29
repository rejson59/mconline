import type { Stack } from './inventory';
import { I, stackLimit } from './items';
import { CH } from './world';

/** A camp cauldron only cooks travel rations or brews two simple field tonics.
 * A single fuel item is consumed when a batch begins, never again on reload. */
export const TRAVEL_CAULDRON_LIMIT = 256;

export interface TravelCauldronState {
  x: number; y: number; z: number; dim?: number;
  input: Stack | null;
  ingredient: Stack | null;
  fuel: Stack | null;
  output: Stack | null;
  /** Elapsed seconds of the current recipe, 0 = idle. */
  progress: number;
}

export function emptyTravelCauldron(x: number, y: number, z: number): TravelCauldronState {
  return { x, y, z, input: null, ingredient: null, fuel: null, output: null, progress: 0 };
}

/** A deliberately smaller recipe list than the stationary furnace or stand. */
export function travelRecipe(input: number, ingredient: number | null): { output: number; seconds: number } | null {
  if (ingredient == null) {
    switch (input) {
      case I.RAW_PORK: return { output: I.COOKED_PORK, seconds: 5 };
      case I.RAW_BEEF: return { output: I.COOKED_BEEF, seconds: 5 };
      case I.RAW_CHICKEN: return { output: I.COOKED_CHICKEN, seconds: 5 };
      case I.RAW_RABBIT: return { output: I.COOKED_RABBIT, seconds: 5 };
      case I.RAW_FISH: return { output: I.COOKED_FISH, seconds: 5 };
      case I.RAW_SALMON: return { output: I.COOKED_SALMON, seconds: 5 };
      case I.CARROT: return { output: I.ROASTED_CARROT, seconds: 5 };
      case I.PUMPKIN_SLICE: return { output: I.ROASTED_PUMPKIN, seconds: 5 };
    }
  } else if (input === I.WATER_BOTTLE) {
    if (ingredient === I.GHAST_TEAR) return { output: I.POTION_HEAL, seconds: 9 };
    if (ingredient === I.SUGAR) return { output: I.POTION_SPEED, seconds: 9 };
  }
  return null;
}

export function travelFuel(id: number): boolean { return id === I.COAL || id === I.STICK; }

/** Each batch consumes one input, optionally one reagent, and one fuel; no result
 * is minted when the output slot is full. Progress is saved continuously. */
export function tickTravelCauldron(s: TravelCauldronState, dt: number): number | null {
  const recipe = s.input ? travelRecipe(s.input.id, s.ingredient?.id ?? null) : null;
  if (!recipe || (s.output && (s.output.id !== recipe.output || s.output.count >= stackLimit(recipe.output)))) {
    s.progress = 0;
    return null;
  }
  if (s.progress <= 0) {
    if (!s.fuel || !travelFuel(s.fuel.id) || s.fuel.count < 1) return null;
    // Charge the real fuel stack up front; reload cannot make the first second free.
    if (--s.fuel.count <= 0) s.fuel = null;
    s.progress = 0.0001;
  }
  s.progress = Math.min(recipe.seconds, s.progress + Math.max(0, dt));
  if (s.progress < recipe.seconds) return null;
  s.progress = 0;
  if (--s.input!.count <= 0) s.input = null;
  if (s.ingredient && --s.ingredient.count <= 0) s.ingredient = null;
  if (s.output) s.output.count++;
  else s.output = { id: recipe.output, count: 1 };
  return recipe.output;
}

/** Imported slots are untrusted: restrict count, IDs and state bounds. */
export function restoreTravelCauldron(raw: unknown): TravelCauldronState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<TravelCauldronState>;
  if (![r.x, r.y, r.z].every((v) => Number.isSafeInteger(v) && Math.abs(v!) < 1e7) ||
      r.y! < 1 || r.y! >= CH || (r.dim !== undefined && r.dim !== 0 && r.dim !== 1)) return null;
  const stack = (rawStack: unknown, valid: (id: number) => boolean): Stack | null => {
    if (!rawStack || typeof rawStack !== 'object') return null;
    const v = rawStack as Partial<Stack>;
    if (!Number.isSafeInteger(v.id) || !valid(v.id!) || !Number.isSafeInteger(v.count) || v.count! < 1) return null;
    return { id: v.id!, count: Math.min(stackLimit(v.id!), v.count!) };
  };
  const input = stack(r.input, (id) => travelRecipe(id, null) !== null || id === I.WATER_BOTTLE);
  const ingredient = stack(r.ingredient, (id) => id === I.GHAST_TEAR || id === I.SUGAR);
  const fuel = stack(r.fuel, travelFuel);
  const output = stack(r.output, (id) =>
    ([I.COOKED_PORK, I.COOKED_BEEF, I.COOKED_CHICKEN, I.COOKED_RABBIT, I.COOKED_FISH, I.COOKED_SALMON, I.ROASTED_CARROT, I.ROASTED_PUMPKIN, I.POTION_HEAL, I.POTION_SPEED] as number[]).includes(id));
  const seconds = input ? travelRecipe(input.id, ingredient?.id ?? null)?.seconds : undefined;
  const progress = typeof r.progress === 'number' && Number.isFinite(r.progress) && seconds && r.progress > 0 && r.progress < seconds
    ? r.progress : 0;
  return { x: r.x!, y: r.y!, z: r.z!, dim: r.dim, input, ingredient, fuel, output, progress };
}
