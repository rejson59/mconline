import type { Stack } from './inventory';

export const MINING_TICK = 1 / 20;
/** Java adds Efficiency to effective tool speed; it isn't a percentage bonus. */
export function efficiencyBonus(level: number): number {
  const n = Number.isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
  return n > 0 ? n * n + 1 : 0;
}
export interface MiningEnvironment { underwater?: boolean; onGround?: boolean; aquaAffinity?: boolean }
export function destroyProgress(hardness: number, speed: number, harvestable: boolean, environment: MiningEnvironment = {}): number {
  if (!Number.isFinite(hardness) || hardness < 0 || !Number.isFinite(speed) || speed <= 0) return 0;
  if (hardness === 0) return 1;
  if (environment.underwater && !environment.aquaAffinity) speed /= 5;
  if (environment.onGround === false) speed /= 5;
  return speed / hardness / (harvestable ? 30 : 100);
}
/** Count does not identify a tool; damage, name and enchantments do. */
export function miningIdentity(x: number, y: number, z: number, block: number, held: Stack | null | undefined): string {
  return JSON.stringify([x,y,z,block,held?.id ?? 0,held?.dur ?? null,held?.name ?? '',
    Object.entries(held?.ench ?? {}).sort(([a],[b]) => a.localeCompare(b))]);
}
/** Sample progress at 20 Hz independently of the renderer; discard excess after one block. */
export function advanceMining(progress: number, remainder: number, dt: number, damage: number) {
  const elapsed = Math.max(0, remainder) + (Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0);
  const ticks = Math.floor((elapsed + 1e-10) / MINING_TICK);
  const next = progress + ticks * (Number.isFinite(damage) ? Math.max(0, damage) : 0);
  const complete = next >= 1 - 1e-10;
  return { progress: complete ? 1 : Math.min(1, next), remainder: Math.max(0, elapsed - ticks * MINING_TICK), complete };
}
