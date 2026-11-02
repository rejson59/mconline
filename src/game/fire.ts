import { B, collisionBoxesAt, isFire, isWater } from "./blocks";
import { CH, CS } from "./constants";

export interface FireWorld {
  readonly isNether?: boolean;
  allowFluid?: (x: number, z: number, nx: number, nz: number) => boolean;
  canEdit?: (x: number, z: number) => boolean;
  peekBlock(x: number, y: number, z: number): number;
  hasChunk(cx: number, cz: number): boolean;
  setBlock(x: number, y: number, z: number, id: number): void;
}
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
export const FIRE_LIFETIME = 30;
export function soulSupport(id: number) {
  return id === B.SOUL_SAND || id === B.SOUL_SOIL;
}
export function fireSupported(
  world: FireWorld,
  x: number,
  y: number,
  z: number,
): boolean {
  if (y <= 0 || y >= CH) return false;
  const boxes = collisionBoxesAt(world, x, y - 1, z);
  if (!boxes) return false;
  for (let i = 0; i < boxes.length; i += 6)
    if (
      boxes[i] === 0 &&
      boxes[i + 2] === 0 &&
      boxes[i + 3] === 1 &&
      boxes[i + 4] === 1 &&
      boxes[i + 5] === 1
    )
      return true;
  return false;
}
export function lightFire(
  world: FireWorld,
  x: number,
  y: number,
  z: number,
): boolean {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(z) ||
    !world.hasChunk(Math.floor(x / CS), Math.floor(z / CS)) ||
    (world.canEdit && !world.canEdit(x, z)) ||
    world.peekBlock(x, y, z) !== B.AIR ||
    !fireSupported(world, x, y, z)
  )
    return false;
  const id = soulSupport(world.peekBlock(x, y - 1, z)) ? B.SOUL_FIRE : B.FIRE;
  world.setBlock(x, y, z, id);
  return world.peekBlock(x, y, z) === id;
}
/** Local loaded-world simulation. No spread or burning buildings. All writes use normal permissions/network notifications. */
export class FireSimulation {
  private cells = new Map<
    string,
    { x: number; y: number; z: number; born: number; id: number }
  >();
  private clock = 0;
  private elapsed = 0;
  constructor(private world: FireWorld) {}
  get size() {
    return this.cells.size;
  }
  changed(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`,
      id = this.world.peekBlock(x, y, z);
    if (!isFire(id)) {
      this.cells.delete(key);
      return;
    }
    if (this.cells.get(key)?.id !== id)
      this.cells.set(key, { x, y, z, born: this.clock, id });
  }
  release(cx: number, cz: number) {
    for (const [key, c] of this.cells)
      if (Math.floor(c.x / CS) === cx && Math.floor(c.z / CS) === cz)
        this.cells.delete(key);
  }
  tick(dt: number, budget = 16): number {
    if (
      !Number.isFinite(dt) ||
      dt <= 0 ||
      !Number.isFinite(budget) ||
      budget < 1
    )
      return 0;
    this.clock += Math.min(dt, 1);
    this.elapsed += Math.min(dt, 1);
    if (this.elapsed < 0.25) return 0;
    this.elapsed %= 0.25;
    const start = performance.now(),
      batch: string[] = [];
    let work = 0;
    for (const key of this.cells.keys()) {
      batch.push(key);
      if (batch.length >= Math.floor(budget)) break;
    }
    for (const key of batch) {
      if (work > 0 && performance.now() - start >= 2) break;
      const c = this.cells.get(key)!;
      this.cells.delete(key);
      work++;
      if (
        !this.world.hasChunk(Math.floor(c.x / CS), Math.floor(c.z / CS)) ||
        this.world.peekBlock(c.x, c.y, c.z) !== c.id
      )
        continue;
      this.cells.set(key, c); // Fair round-robin; never revisit a reinserted Map entry in this tick.
      const below = this.world.peekBlock(c.x, c.y - 1, c.z);
      const persistent =
        c.id === B.SOUL_FIRE ||
        below === B.NETHERRACK ||
        (this.world.isNether && below === B.BEDROCK);
      const wet = SIDES.some(
        ([dx, dz]) =>
          (!this.world.allowFluid ||
            this.world.allowFluid(c.x, c.z, c.x + dx, c.z + dz)) &&
          isWater(this.world.peekBlock(c.x + dx, c.y, c.z + dz)),
      );
      const invalid =
        !fireSupported(this.world, c.x, c.y, c.z) ||
        (c.id === B.SOUL_FIRE && !soulSupport(below));
      if (
        (invalid ||
          wet ||
          (!persistent && this.clock - c.born >= FIRE_LIFETIME)) &&
        (!this.world.canEdit || this.world.canEdit(c.x, c.z))
      ) {
        this.world.setBlock(c.x, c.y, c.z, B.AIR);
        if (!isFire(this.world.peekBlock(c.x, c.y, c.z)))
          this.cells.delete(key);
      }
    }
    return work;
  }
}
/** Shared floor model (four slanted planes), precomputed once, no per-vertex arrays during meshing. */
export const FIRE_QUADS = (() => {
  const out: number[][][] = [];
  for (const axis of ["x", "z"])
    for (const side of [-1, 1]) {
      const angle = (side * Math.PI) / 8,
        co = Math.cos(angle),
        si = Math.sin(angle);
      const points =
        axis === "x"
          ? [
              [0, 0, 0.5 + side * 0.05],
              [1, 0, 0.5 + side * 0.05],
              [0, 1.4, 0.5 + side * 0.05],
              [1, 1.4, 0.5 + side * 0.05],
            ]
          : [
              [0.5 + side * 0.05, 0, 0],
              [0.5 + side * 0.05, 0, 1],
              [0.5 + side * 0.05, 1.4, 0],
              [0.5 + side * 0.05, 1.4, 1],
            ];
      out.push(
        points.map(([x, y, z]) =>
          axis === "x"
            ? [
                x,
                0.5 + ((y - 0.5) * co - (z - 0.5) * si) / co,
                0.5 + ((y - 0.5) * si + (z - 0.5) * co) / co,
              ]
            : [
                0.5 + ((x - 0.5) * co - (y - 0.5) * si) / co,
                0.5 + ((x - 0.5) * si + (y - 0.5) * co) / co,
                z,
              ],
        ),
      );
    }
  return out;
})();
