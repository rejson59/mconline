/** Exponential damping is independent of frame subdivision (30/60/144 FPS). */
export function smoothAlpha(dt: number, rate: number): number {
  return -Math.expm1(-Math.max(0, dt) * Math.max(0, rate));
}
export function movementFov(base: number, sprint: boolean, flying: boolean, strength: number): number {
  return base + (sprint ? 10 + (flying ? 5 : 0) : 0) * strength;
}
export function mousePitch(pitch: number, dy: number, sensitivity: number, invert: boolean): number {
  const next = pitch - dy * sensitivity * (invert ? -1 : 1);
  return Math.max(-Math.PI / 2 + .001, Math.min(Math.PI / 2 - .001, next));
}
/** Deterministic hurt roll, rather than random translations of the player's eyes. */
export function damageRoll(remaining: number, strength: number): number {
  const phase = Math.max(0, Math.min(1, remaining / .6));
  return -Math.sin(Math.pow(phase, 4) * Math.PI) * .14 * strength;
}
