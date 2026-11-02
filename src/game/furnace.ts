import type { Stack } from "./inventory";
import { I, fuelSeconds, smeltResult, stackLimit } from "./items";

/** Java ordinary furnace: 200 game ticks at 20 ticks per second. */
export const COOK_TIME = 10;

export interface FurnaceState {
  x: number;
  y: number;
  z: number;
  input: Stack | null;
  fuel: Stack | null;
  output: Stack | null;
  burn: number;
  burnMax: number;
  cook: number;
  /** 1.8: 1 = piec stoi w Netherze (osobny klucz, obcy wymiar go nie skasuje). */
  dim?: number;
}

export function furnaceKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function emptyFurnace(x: number, y: number, z: number): FurnaceState {
  return {
    x,
    y,
    z,
    input: null,
    fuel: null,
    output: null,
    burn: 0,
    burnMax: 0,
    cook: 0,
  };
}

/** Advance by elapsed seconds, splitting at fuel and recipe boundaries.
 * Never discard the fraction of a frame after completing an item; one coal
 * must cook eight items both at 30/60 FPS and in a batched time step.
 * Saves retain the existing normalized cook fraction and remaining burn time.
 */
export function tickFurnace(f: FurnaceState, dt: number): boolean {
  if (!Number.isFinite(dt) || dt <= 0) return f.burn > 0;
  let remaining = dt;
  const epsilon = 1e-10;
  while (remaining > epsilon) {
    const result =
      f.input && f.input.count > 0 ? smeltResult(f.input.id) : null;
    const canOut =
      result != null &&
      (!f.output ||
        (f.output.id === result && f.output.count < stackLimit(result)));
    if (f.burn <= epsilon) {
      f.burn = 0;
      const duration = f.fuel && f.fuel.count > 0 ? fuelSeconds(f.fuel.id) : 0;
      if (canOut && duration > 0 && f.fuel) {
        f.burn = f.burnMax = duration;
        // Lava is a fuel with a container remainder, not a disappearing bucket.
        if (f.fuel.id === I.LAVA_BUCKET) f.fuel = { id: I.BUCKET, count: 1 };
        else if (--f.fuel.count <= 0) f.fuel = null;
      } else {
        // Unlit Java furnaces lose two cooking ticks per elapsed game tick.
        f.cook = Math.max(0, f.cook - (remaining * 2) / COOK_TIME);
        break;
      }
    }
    if (!canOut) {
      f.cook = 0;
      f.burn = Math.max(0, f.burn - remaining);
      break;
    }
    const elapsed = Math.min(
      remaining,
      f.burn,
      Math.max(0, (1 - f.cook) * COOK_TIME),
    );
    f.burn = Math.max(0, f.burn - elapsed);
    f.cook += elapsed / COOK_TIME;
    remaining -= elapsed;
    if (f.cook >= 1 - epsilon && f.input && result != null) {
      f.cook = 0;
      if (--f.input.count <= 0) f.input = null;
      if (!f.output) f.output = { id: result, count: 1 };
      else f.output.count++;
    }
  }
  if (f.burn < epsilon) f.burn = 0;
  return f.burn > 0;
}
