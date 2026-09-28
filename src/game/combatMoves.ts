/** Combat inputs are derived from the player's actual view direction. Shared by
 * PC and touch; do not grant a parry when an attacker is behind the shield. */
export function threatInFront(yaw: number, px: number, pz: number, tx: number, tz: number): boolean {
  const dx = tx - px, dz = tz - pz;
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance < 0.001) return false;
  return (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > 0.45;
}

/** Default is a backward dodge. Strafe or forward inputs choose a direction;
 * normalised diagonals never travel farther than cardinal dodges. */
export function dodgeDirection(yaw: number, keys: ReadonlySet<string>): { x: number; z: number } {
  let sideways = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  if (!sideways && !forward) forward = -1;
  const length = Math.hypot(sideways, forward);
  sideways /= length; forward /= length;
  return { x: sideways * Math.cos(yaw) - forward * Math.sin(yaw),
    z: -sideways * Math.sin(yaw) - forward * Math.cos(yaw) };
}
