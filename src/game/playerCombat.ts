import type { CombatEvent } from './net';
import { validVector } from './sharedDrops';

/** Ray against a standing player, including a small network/render tolerance. */
export function playerRay(origin: readonly number[], dir: readonly number[], pos: readonly number[], reach: number, height = 1.8): number | null {
  let near = 0, far = reach;
  for (let a = 0; a < 3; a++) {
    const lo = pos[a] - (a === 1 ? 0.05 : 0.4), hi = pos[a] + (a === 1 ? height + 0.05 : 0.4);
    if (Math.abs(dir[a]) < 1e-9) { if (origin[a] < lo || origin[a] > hi) return null; }
    else {
      const x = (lo - origin[a]) / dir[a], y = (hi - origin[a]) / dir[a];
      near = Math.max(near, Math.min(x, y)); far = Math.min(far, Math.max(x, y));
      if (near > far) return null;
    }
  }
  return near;
}
export function validCombat(h: CombatEvent, now = Date.now()): boolean {
  return !!h && typeof h.uid === 'string' && /^[\w:-]{1,160}$/.test(h.uid) &&
    (h.d === 'o' || h.d === 'n') && (h.kind === 'melee' || h.kind === 'arrow') &&
    Number.isFinite(h.at) && Math.abs(now - h.at) <= 2500 && validVector(h.origin) && validVector(h.direction, 1) &&
    Math.abs(Math.hypot(...h.direction) - 1) < 0.01 && Number.isInteger(h.weapon) && h.weapon >= 0 && h.weapon <= 65535 &&
    Number.isInteger(h.sharpness) && h.sharpness >= 0 && h.sharpness <= 5 && Number.isInteger(h.knockback) && h.knockback >= 0 && h.knockback <= 2 &&
    typeof h.strength === 'boolean' && typeof h.sprint === 'boolean' &&
    (h.kind !== 'arrow' || (Number.isFinite(h.speed) && h.speed! >= 22 && h.speed! <= 48 && Number.isFinite(h.power) && h.power! > 0 && h.power! <= 22.5));
}
