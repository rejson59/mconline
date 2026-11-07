/** Derived fence geometry. N/E/S/W bits are shared by rendering and physics. */
const collisionCache: Float32Array[] = [],
  outlineCache: Float32Array[] = [];
export function fenceBoxes(mask: number, collision = true): Float32Array {
  mask &= 15;
  const cache = collision ? collisionCache : outlineCache;
  if (cache[mask]) return cache[mask];
  const h = collision ? 1.5 : 1;
  const b = [6 / 16, 0, 6 / 16, 10 / 16, h, 10 / 16];
  if (mask & 1) b.push(6 / 16, 0, 0, 10 / 16, h, 6 / 16);
  if (mask & 2) b.push(10 / 16, 0, 6 / 16, 1, h, 10 / 16);
  if (mask & 4) b.push(6 / 16, 0, 10 / 16, 10 / 16, h, 1);
  if (mask & 8) b.push(0, 0, 6 / 16, 6 / 16, h, 10 / 16);
  return (cache[mask] = new Float32Array(b));
}

/** Does a union of boxes cover the whole vertical face? No opacity shortcut.
 * Partition by exact box edges: supports stair corners without sampling holes.
 */
export function fullSide(boxes: Float32Array, side: number): boolean {
  const axis = side % 2 ? 0 : 2,
    tangent = axis === 0 ? 2 : 0;
  const high = side === 1 || side === 2,
    plane = high ? 1 : 0;
  const rects: number[][] = [];
  for (let i = 0; i < boxes.length; i += 6) {
    if (boxes[i + axis] > plane || boxes[i + axis + 3] < plane) continue;
    const u0 = Math.max(0, boxes[i + tangent]),
      u1 = Math.min(1, boxes[i + tangent + 3]);
    const v0 = Math.max(0, boxes[i + 1]),
      v1 = Math.min(1, boxes[i + 4]);
    if (u1 > u0 && v1 > v0) rects.push([u0, v0, u1, v1]);
  }
  const us = [...new Set([0, 1, ...rects.flatMap((r) => [r[0], r[2]])])].sort(
    (a, b) => a - b,
  );
  const vs = [...new Set([0, 1, ...rects.flatMap((r) => [r[1], r[3]])])].sort(
    (a, b) => a - b,
  );
  for (let u = 0; u < us.length - 1; u++)
    for (let v = 0; v < vs.length - 1; v++) {
      const x = (us[u] + us[u + 1]) / 2,
        y = (vs[v] + vs[v + 1]) / 2;
      if (!rects.some((r) => x > r[0] && x < r[2] && y > r[1] && y < r[3]))
        return false;
    }
  return true;
}
