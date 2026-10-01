import { B, IS_SOLID, RENDER } from './blocks';
import { CS, type World } from './world';

/** A bounded, loaded-chunk-only 2D route around walls. Returns the FIRST step,
 * not a distant destination. Does not generate terrain or enter fire/water.
 * Max 96 expanded cells and radius 8 keep worst-case mobile costs finite.
 * One-block ledges are deliberately handled by the existing jump physics. */
export function boundedPathStep(
  world: Pick<World, 'peekBlock' | 'hasChunk'>,
  px: number, py: number, pz: number, tx: number, tz: number,
  maxVisited = 96,
): { x: number; z: number } | null {
  const sx = Math.floor(px), sz = Math.floor(pz), y = Math.floor(py);
  const targetDistance = Math.hypot(tx - px, tz - pz);
  if (targetDistance < 0.6) return null;
  const goalX = targetDistance > 7.5 ? px + (tx - px) * 7.5 / targetDistance : tx;
  const goalZ = targetDistance > 7.5 ? pz + (tz - pz) * 7.5 / targetDistance : tz;
  const targetCellX = Math.floor(goalX), targetCellZ = Math.floor(goalZ);
  const key = (x: number, z: number) => `${x},${z}`;
  type Node = { x: number; z: number; parent: number; g: number; score: number };
  const nodes: Node[] = [{ x: sx, z: sz, parent: -1, g: 0, score: 0 }];
  const open = [0];
  const seen = new Set([key(sx, sz)]);
  const max = Number.isFinite(maxVisited) ? Math.max(1, Math.min(128, Math.floor(maxVisited))) : 96;
  let best = 0;
  let bestDist = Math.hypot(sx - targetCellX, sz - targetCellZ);
  const clear = (x: number, z: number) => {
    if (!world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) return false;
    const floor = world.peekBlock(x, y - 1, z);
    const feet = world.peekBlock(x, y, z);
    const head = world.peekBlock(x, y + 1, z);
    return !!IS_SOLID[floor] && floor !== B.MAGMA && floor !== B.CAMPFIRE &&
      floor !== B.CACTUS && floor !== B.LAVA &&
      (feet === B.AIR || RENDER[feet] === 1) &&
      head === B.AIR;
  };
  while (open.length) {
    let pick = 0;
    for (let i = 1; i < open.length; i++) if (nodes[open[i]].score < nodes[open[pick]].score) pick = i;
    const index = open.splice(pick, 1)[0];
    const n = nodes[index];
    const distance = Math.hypot(n.x - targetCellX, n.z - targetCellZ);
    if (distance < bestDist) { bestDist = distance; best = index; }
    if (distance === 0) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = n.x + dx, z = n.z + dz;
      if (nodes.length >= max) break;
      if (Math.abs(x - sx) > 8 || Math.abs(z - sz) > 8 || seen.has(key(x, z)) || !clear(x, z)) continue;
      seen.add(key(x, z));
      const g = n.g + 1;
      nodes.push({ x, z, parent: index, g, score: g + Math.hypot(x - targetCellX, z - targetCellZ) * 1.12 });
      open.push(nodes.length - 1);
    }
  }
  if (best === 0) return null; // sealed room or completely blocked approach
  while (nodes[best].parent > 0) best = nodes[best].parent;
  return { x: nodes[best].x + 0.5, z: nodes[best].z + 0.5 };
}
