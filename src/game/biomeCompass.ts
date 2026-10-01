import type { Biome, World } from './world';
import { MAP_BIOMES } from './discoveryMap';

export const COMPASS_RANGE = 1024;
export const COMPASS_STEP = 32;
export const BIOME_TARGETS: Biome[] = MAP_BIOMES.filter((b) => b !== 'Nether');
export interface BiomeLocation { x: number; y: number; z: number; distance: number }

/** Approximate nearest sample within a fixed radius. Ordered once, not per
 * click. This reads the seed's analytic surface only (no chunk loads or mods).
 * advance() caps noise calls per animation frame on slow devices. */
const OFFSETS: [number, number, number][] = [];
for (let dx = -COMPASS_RANGE / COMPASS_STEP; dx <= COMPASS_RANGE / COMPASS_STEP; dx++) {
  for (let dz = -COMPASS_RANGE / COMPASS_STEP; dz <= COMPASS_RANGE / COMPASS_STEP; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 <= (COMPASS_RANGE / COMPASS_STEP) ** 2) OFFSETS.push([dx, dz, d2]);
  }
}
OFFSETS.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);

export class BiomeSearch {
  checked = 0;
  readonly total = OFFSETS.length;
  done = false;
  result: BiomeLocation | null = null;

  constructor(private world: World, private x: number, private z: number, private biome: Biome) {
    if (world.isNether || !BIOME_TARGETS.includes(biome) || !Number.isFinite(x) || !Number.isFinite(z)) this.done = true;
  }

  advance(budget = 96): boolean {
    if (this.done) return true;
    let left = Math.max(0, Math.min(256, Math.floor(budget)));
    while (left-- > 0 && this.checked < this.total) {
      const [dx, dz] = OFFSETS[this.checked++];
      const x = Math.floor(this.x + dx * COMPASS_STEP);
      const z = Math.floor(this.z + dz * COMPASS_STEP);
      const s = this.world.surface(x, z);
      if (s.biome !== this.biome) continue;
      this.result = { x, y: Math.max(s.h, 62) + 1, z, distance: Math.round(Math.hypot(x - this.x, z - this.z)) };
      this.done = true;
      return true;
    }
    if (this.checked >= this.total) this.done = true;
    return this.done;
  }
}
