/** Java-style 0–15 skylight, including lateral light through openings.
 * Direct vertical sky stays 15; indirect light loses one level per voxel.
 * Scratch reuse is synchronous, bounded to the supplied volume, never loads chunks.
 */
import { IS_OPAQUE, IS_LEAFY, isWater } from './blocks';
export const LIGHT_RADIUS = 15;
const LIGHT_CURVE = Float64Array.from(
  { length: 16 },
  (_, n) => n / (60 - 3 * n)
);
export function lightLevel(level: number): number {
  const cached = LIGHT_CURVE[level];
  if (cached !== undefined) return cached;
  const n = Math.max(0, Math.min(15, level)) / 15;
  return n / (4 - 3 * n);
}
export interface SkyField {
  data: Uint8Array;
  width: number;
  height: number;
  depth: number;
  x0: number;
  z0: number;
}
const buckets: number[][] = Array.from({ length: 16 }, () => []);
export function buildSkyLight(
  get: (x: number, y: number, z: number) => number,
  width: number,
  depth: number,
  height: number,
  x0 = 0,
  z0 = 0,
  reuse?: Uint8Array
): SkyField {
  const size = width * depth * height,
    plane = width * depth;
  const data = reuse && reuse.length >= size ? reuse : new Uint8Array(size);
  data.fill(0, 0, size);
  for (const bucket of buckets) bucket.length = 0;
  let ceiling = 0;
  for (let z = 0; z < depth; z++)
    for (let x = 0; x < width; x++) {
      let light = 15;
      for (let y = height - 1; y >= 0; y--) {
        const id = get(x + x0, y, z + z0);
        if (IS_OPAQUE[id] && !IS_LEAFY[id]) {
          ceiling = Math.max(ceiling, y + 1);
          break;
        }
        // Only full-strength sky travels downward without loss. Once a
        // canopy/water attenuates it, ordinary air loses a level per step.
        if (IS_LEAFY[id] || isWater(id) || light < 15) {
          light = Math.max(0, light - 1);
          ceiling = Math.max(ceiling, y + 1);
        }
        data[y * plane + z * width + x] = light;
      }
    }
  // Only seed the frontier where a directly lit column meets darker space.
  // Empty sky above the highest blocker is already uniform, needs no BFS.
  for (let y = 0; y <= Math.min(height - 1, ceiling); y++)
    for (let z = 0; z < depth; z++)
      for (let x = 0; x < width; x++) {
        const i = y * plane + z * width + x,
          level = data[i];
        if (level <= 1) continue;
        if (
          (x > 0 && data[i - 1] < level - 1) ||
          (x + 1 < width && data[i + 1] < level - 1) ||
          (z > 0 && data[i - width] < level - 1) ||
          (z + 1 < depth && data[i + width] < level - 1)
        )
          buckets[level].push(i);
      }
  for (let level = 15; level > 1; level--)
    for (let qi = 0; qi < buckets[level].length; qi++) {
      const i = buckets[level][qi];
      if (data[i] !== level) continue;
      const y = Math.floor(i / plane),
        rem = i - y * plane,
        z = Math.floor(rem / width),
        x = rem - z * width;
      for (let direction = 0; direction < 6; direction++) {
        let nx = x,
          ny = y,
          nz = z;
        if (direction === 0) nx++;
        else if (direction === 1) nx--;
        else if (direction === 2) ny++;
        else if (direction === 3) ny--;
        else if (direction === 4) nz++;
        else nz--;
        if (
          nx < 0 ||
          nx >= width ||
          nz < 0 ||
          nz >= depth ||
          ny < 0 ||
          ny >= height
        )
          continue;
        const ni = ny * plane + nz * width + nx,
          next = level - 1;
        if (data[ni] >= next) continue;
        const id = get(nx + x0, ny, nz + z0);
        if (IS_OPAQUE[id] && !IS_LEAFY[id]) continue;
        data[ni] = next;
        buckets[next].push(ni);
      }
    }
  return { data, width, depth, height, x0, z0 };
}
export function skyLevel(
  field: SkyField,
  x: number,
  y: number,
  z: number
): number {
  if (y >= field.height) return 15;
  const lx = x - field.x0,
    lz = z - field.z0;
  if (y < 0 || lx < 0 || lz < 0 || lx >= field.width || lz >= field.depth)
    return 0;
  return field.data[(y * field.depth + lz) * field.width + lx];
}
