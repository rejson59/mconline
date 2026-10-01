import { B } from './blocks';
import { CH, CS, SEA } from './constants';

/** Versioned cave lattice. v6 keeps its RC1 geometry for saved worlds; v7
 * gives chambers climbable exits without changing the surface biomes/rivers. */
export const CAVE_CELL = 96;
export interface CaveNode { x: number; y: number; z: number; lake: boolean }
const hash = (x: number, z: number, salt: number, seed: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt + seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function caveNode(seed: number, gx: number, gz: number): CaveNode {
  return {
    x: gx * CAVE_CELL + 48 + Math.floor(hash(gx, gz, 31, seed) * 17) - 8,
    z: gz * CAVE_CELL + 48 + Math.floor(hash(gx, gz, 32, seed) * 17) - 8,
    y: 27 + Math.floor(hash(gx, gz, 33, seed) * 12),
    lake: hash(gx, gz, 34, seed) < 0.36,
  };
}

export type CaveSurface = (x: number, z: number) => number;
/** Mouth at the end of a walkable uphill corridor. Reject sea floors,
 * flooded valleys, steep mountains and village foundations. */
export function caveEntrance(seed: number, gx: number, gz: number, surface: CaveSurface,
  occupied: (x: number, z: number) => boolean = () => false, version: 6 | 7 = 7): CaveNode | null {
  const node = caveNode(seed, gx, gz);
  // v7's longer incline stays below a one-block step per body width even
  // after the flat transition from the chamber. Preserve v6's old mouth.
  const x = node.x + (version >= 7 ? 120 : 72), z = node.z + (version >= 7 ? 36 : 24);
  const h = surface(x, z);
  if (h < SEA + 5 || h > 82 || occupied(x, z)) return null;
  for (let i = 0; i <= 12; i++) {
    const xx = Math.round(node.x + (x - node.x) * i / 12);
    const zz = Math.round(node.z + (z - node.z) * i / 12);
    // v7: check the *whole* ramp, not just its mouth. v6 must preserve
    // the exact cave geometry already saved by early 2.8 candidates.
    if (surface(xx, zz) < SEA + 4 || (version >= 7 && occupied(xx, zz))) return null;
  }
  // Corridor floor is y-3. In v6 it stopped two blocks below the surface;
  // v7 ends level with the land so players can step out without digging.
  return { x, y: h + (version >= 7 ? 3 : 1), z, lake: false };
}

/** Writes directly into an already filled chunk: no neighbour generation or
 * cross-chunk writes. Each chunk recomputes the same global path segments. */
export function carveCaveNetwork(data: Uint16Array, cx: number, cz: number, seed: number,
  surface: CaveSurface, occupied?: (x: number, z: number) => boolean, version: 6 | 7 = 7): void {
  const ox = cx * CS, oz = cz * CS;
  const idx = (x: number, y: number, z: number) => (y * CS + z) * CS + x;
  const put = (x: number, y: number, z: number, id: number) => {
    if (x < ox || x >= ox + CS || z < oz || z >= oz + CS || y < 7 || y >= CH - 3) return;
    const i = idx(x - ox, y, z - oz);
    if (data[i] !== B.BEDROCK) data[i] = id;
  };
  const near = (a: CaveNode, b: CaveNode, radius: number) =>
    Math.max(a.x, b.x) + radius >= ox && Math.min(a.x, b.x) - radius < ox + CS &&
    Math.max(a.z, b.z) + radius >= oz && Math.min(a.z, b.z) - radius < oz + CS;
  const corridor = (a: CaveNode, b: CaveNode, flatStart = 0) => {
    if (!near(a, b, 3)) return;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    // Half-block sampling ensures adjoining chunks carve exactly the same
    // ramp, including its floor and two-block headroom at the seam.
    for (let i = 0, n = Math.ceil(length * 2); i <= n; i++) {
      const t = i / n;
      const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      if (px < ox - 3 || px > ox + CS + 2 || pz < oz - 3 || pz > oz + CS + 2) continue;
      // Chamber floors remain flat out to radius 9. If the uphill ramp
      // rises *inside* that room, its end becomes a 3–5 block vertical lip.
      // Begin the climb beyond the chamber edge in v7 only.
      const climb = flatStart ? Math.max(0, (t * length - flatStart) / (length - flatStart)) : t;
      const py = a.y + (b.y - a.y) * climb;
      for (let x = Math.floor(px - 2.5); x <= Math.ceil(px + 2.5); x++)
        for (let z = Math.floor(pz - 2.5); z <= Math.ceil(pz + 2.5); z++) {
          if ((x - px) ** 2 + (z - pz) ** 2 > 5.29) continue;
          for (let y = Math.floor(py - 2); y <= Math.ceil(py + 2); y++) put(x, y, z, B.AIR);
        }
    }
  };
  const chamber = (p: CaveNode) => {
    if (!near(p, p, 10)) return;
    for (let x = p.x - 9; x <= p.x + 9; x++) for (let z = p.z - 9; z <= p.z + 9; z++) {
      const r2 = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (r2 > 81) continue;
      const half = Math.max(2, Math.floor(5 * Math.sqrt(1 - r2 / 100)));
      // The dry room has a FLAT floor at the same height as its passages.
      // A deep spherical floor stranded the player behind a three-block lip.
      for (let y = p.y - 2; y <= p.y + half; y++) put(x, y, z, B.AIR);
      if (p.lake && r2 <= 25) {
        // The shallow pool is recessed into the floor, not suspended above it.
        for (let y = p.y - 5; y <= p.y - 3; y++) put(x, y, z, B.WATER);
        put(x, p.y - 6, z, B.CLAY);
      }
    }
  };
  for (let gx = Math.floor((ox - 120) / CAVE_CELL); gx <= Math.floor((ox + CS + 120) / CAVE_CELL); gx++)
    for (let gz = Math.floor((oz - 120) / CAVE_CELL); gz <= Math.floor((oz + CS + 120) / CAVE_CELL); gz++) {
      const a = caveNode(seed, gx, gz);
      if (near(a, a, 10)) chamber(a);
      corridor(a, caveNode(seed, gx + 1, gz));
      corridor(a, caveNode(seed, gx, gz + 1));
      // Most cells have a dry surface exit. The connected graph still reaches
      // land if a particular mouth is underwater or under a village.
      if (near(a, { ...a, x: a.x + (version >= 7 ? 120 : 72), z: a.z + (version >= 7 ? 36 : 24) }, 3)) {
        const mouth = caveEntrance(seed, gx, gz, surface, occupied, version);
        if (mouth) corridor(a, mouth, version >= 7 ? 12 : 0);
      }
    }
}

/** Trees grow after the cave pass. Only clear the vegetation that would block
 * the final steps into daylight; do not recarve stone, player edits or villages. */
export function clearCaveExitVegetation(data: Uint16Array, cx: number, cz: number, seed: number,
  surface: CaveSurface, occupied: (x: number, z: number) => boolean): void {
  const ox = cx * CS, oz = cz * CS;
  const vegetation = new Set<number>([
    B.LOG, B.BIRCH_LOG, B.ACACIA_LOG, B.SPRUCE_LOG,
    B.LEAVES, B.BIRCH_LEAVES, B.ACACIA_LEAVES, B.JUNGLE_LEAVES, B.SPRUCE_LEAVES,
    B.TALLGRASS, B.FLOWER_RED, B.FLOWER_YELLOW, B.FLOWER_BLUE, B.DEAD_SHRUB,
  ]);
  for (let gx = Math.floor((ox - 120) / CAVE_CELL); gx <= Math.floor((ox + CS + 120) / CAVE_CELL); gx++)
    for (let gz = Math.floor((oz - 120) / CAVE_CELL); gz <= Math.floor((oz + CS + 120) / CAVE_CELL); gz++) {
      const node = caveNode(seed, gx, gz);
      if (node.x > ox + CS + 3 || node.x + 120 < ox - 3 ||
        node.z > oz + CS + 3 || node.z + 36 < oz - 3) continue;
      const mouth = caveEntrance(seed, gx, gz, surface, occupied, 7);
      if (!mouth) continue;
      const length = Math.hypot(mouth.x - node.x, mouth.z - node.z);
      for (let t = 0.84; t <= 1.001; t += 0.005) {
        const px = node.x + (mouth.x - node.x) * t;
        const pz = node.z + (mouth.z - node.z) * t;
        if (px < ox - 3 || px > ox + CS + 2 || pz < oz - 3 || pz > oz + CS + 2) continue;
        const py = node.y + (mouth.y - node.y) * Math.max(0, (t * length - 12) / (length - 12));
        for (let x = Math.floor(px - 2.5); x <= Math.ceil(px + 2.5); x++)
          for (let z = Math.floor(pz - 2.5); z <= Math.ceil(pz + 2.5); z++) {
            if ((x - px) ** 2 + (z - pz) ** 2 > 5.29 || x < ox || x >= ox + CS || z < oz || z >= oz + CS) continue;
            for (let y = Math.floor(py - 2); y <= Math.ceil(py + 2); y++) {
              if (y < 7 || y >= CH - 3) continue;
              const i = (y * CS + z - oz) * CS + x - ox;
              if (vegetation.has(data[i])) data[i] = B.AIR;
            }
          }
      }
    }
}
