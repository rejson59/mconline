/** Root reservations must be world-coordinate based, including roots OUTSIDE
 * the chunk being generated. Otherwise a cancelled tree can leave an orphan
 * canopy in its neighbour. Never load/generate neighbour chunks recursively.
 */
import { CH, CS } from './constants';
import { applyVillages, type VillageContext } from './village';
import { applyStructures } from './structures';
const cache = new WeakMap<VillageContext, Map<string, Uint8Array>>();
export function rememberDecorationMask(cx: number, cz: number, ctx: VillageContext, mask: Uint8Array) {
  let masks = cache.get(ctx);
  if (!masks) { masks = new Map(); cache.set(ctx, masks); }
  if (masks.size >= 128) masks.clear();
  masks.set(`${cx},${cz}`, mask);
}
export function treeRootReserved(x: number, z: number, ctx: VillageContext): boolean {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), key = `${cx},${cz}`;
  let mask = cache.get(ctx)?.get(key);
  if (!mask) {
    // Reuse the exact building/terrain writers, not an approximate circular
    // village exclusion. Underground mine columns deliberately remain wooded.
    const scratch = new Uint16Array(CH * CS * CS);
    mask = applyVillages(scratch, cx, cz, ctx).mask;
    applyStructures(scratch, cx, cz, ctx, mask);
    rememberDecorationMask(cx, cz, ctx, mask);
  }
  return mask[(z - cz * CS) * CS + x - cx * CS] !== 0;
}
