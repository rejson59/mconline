import { B, isWater, waterHeight, waterLevel } from './blocks';
import { CH, CS } from './constants';

interface WaterWorld {
  allowFluid?: (x: number, z: number, nx: number, nz: number) => boolean;
  peekBlock(x: number, y: number, z: number): number;
  hasChunk(cx: number, cz: number): boolean;
  setBlock(x: number, y: number, z: number, id: number, notify?: boolean): void;
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const fallsInto = (id: number) => id === B.AIR || (isWater(id) && id !== B.WATER);

/** A derived fluid simulation: only sources/player edits go over the network.
 * Every client reconstructs flow from those inputs. Flow IDs persist in offline
 * saves too; they are never promoted into new sources or collected by buckets. */
export class WaterSimulation {
  private pending = new Map<string, [number, number, number]>();
  private elapsed = 0;
  constructor(private world: WaterWorld) {}
  get size() { return this.pending.size; }
  private enqueue(x: number, y: number, z: number) {
    if (y < 0 || y >= CH || !this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) return;
    this.pending.set(`${x},${y},${z}`, [x, y, z]);
  }
  changed(x: number, y: number, z: number, previous = B.AIR as number) {
    const w = this.world;
    if (!isWater(previous) && !isWater(w.peekBlock(x, y, z)) &&
        !isWater(w.peekBlock(x, y + 1, z)) && !isWater(w.peekBlock(x, y - 1, z)) &&
        !SIDES.some(([dx, dz]) => isWater(w.peekBlock(x + dx, y, z + dz)))) return;
    this.enqueue(x, y, z); this.enqueue(x, y - 1, z); this.enqueue(x, y + 1, z);
    for (const [dx, dz] of SIDES) this.enqueue(x + dx, y, z + dz);
  }
  /** Called for loaded chunk water and its seam, never generates terrain. */
  wake(x: number, y: number, z: number) {
    // A submerged ocean source has no outgoing work. Saved flows always need
    // revalidation; a newly loaded seam can expose an old source's outlet.
    if (this.world.peekBlock(x, y, z) === B.WATER &&
        !fallsInto(this.world.peekBlock(x, y - 1, z)) &&
        !SIDES.some(([dx, dz]) => fallsInto(this.world.peekBlock(x + dx, y, z + dz)))) return;
    this.changed(x, y, z, B.WATER);
  }
  tick(dt: number, budget = 256): number {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(budget) || budget <= 0) return 0;
    this.elapsed += Math.min(dt, 1);
    if (this.elapsed < 0.2) return 0;
    this.elapsed %= 0.2;
    const batch: [number, number, number][] = [];
    for (const [key, pos] of this.pending) {
      this.pending.delete(key); batch.push(pos);
      if (batch.length >= budget) break;
    }
    // Read one snapshot before applying changes: a tick advances one wave.
    const changes: [number, number, number, number][] = [];
    for (const [x, y, z] of batch) {
      if (!this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) continue;
      const old = this.world.peekBlock(x, y, z);
      if (old !== B.AIR && !isWater(old)) continue;
      if (old === B.WATER) continue; // Explicit/generated sources never decay.
      let next = B.AIR as number;
      if (isWater(this.world.peekBlock(x, y + 1, z))) next = B.WATER_FALL;
      else {
        let best = 8;
        for (const [dx, dz] of SIDES) {
          if (this.world.allowFluid && !this.world.allowFluid(x, z, x + dx, z + dz)) continue;
          const id = this.world.peekBlock(x + dx, y, z + dz);
          if (!isWater(id) || fallsInto(this.world.peekBlock(x + dx, y - 1, z + dz))) continue;
          best = Math.min(best, waterLevel(id) + 1);
        }
        if (best <= 7) next = B.WATER_FLOW_1 + best - 1;
      }
      if (old !== next) changes.push([x, y, z, next]);
    }
    for (const [x, y, z, id] of changes) this.world.setBlock(x, y, z, id, false);
    return changes.length;
  }
}

export function submerged(world: Pick<WaterWorld, 'peekBlock'>, x: number, y: number, z: number): boolean {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
  const id = world.peekBlock(bx, by, bz);
  return isWater(id) && (isWater(world.peekBlock(bx, by + 1, bz)) || y - by < waterHeight(id));
}

/** Horizontal current follows lower fluid levels. Falling columns also pull down. */
export function waterCurrent(world: Pick<WaterWorld, 'peekBlock'>, x: number, y: number, z: number): [number, number, number] {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  const id = world.peekBlock(x, y, z);
  if (!isWater(id)) return [0, 0, 0];
  let vx = 0, vz = 0;
  for (const [dx, dz] of SIDES) {
    const other = world.peekBlock(x + dx, y, z + dz);
    const difference = other === B.AIR ? 8 - waterLevel(id) : isWater(other) ? waterLevel(other) - waterLevel(id) : 0;
    if (difference > 0) { vx += dx * difference; vz += dz * difference; }
  }
  const length = Math.hypot(vx, vz) || 1;
  return [vx / length, id === B.WATER_FALL ? -0.5 : 0, vz / length];
}
