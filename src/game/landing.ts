import { B, isBed } from './blocks';

/** Raw landing damage, before the separate Protection/Feather Falling stage. */
export function landingDamage(distance: number, block: number, sneaking = false): number {
  if (!Number.isFinite(distance) || distance <= 3) return 0;
  if (block === B.SLIME_BLOCK && !sneaking) return 0;
  // Beds halve the distance before the three-block allowance, unlike hay/honey.
  const effectiveDistance = isBed(block) ? distance * .5 : distance;
  const multiplier = block === B.HAY || block === B.HONEY_BLOCK ? .2 : 1;
  return Math.max(0, Math.ceil((effectiveDistance - 3) * multiplier - 1e-7));
}
