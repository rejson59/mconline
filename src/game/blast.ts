import { World } from "./world";
import { B } from "./blocks";
import { CS } from "./constants";

export type SightWorld = Pick<World, "peekBlock"> &
  Partial<Pick<World, "hasChunk">>;

/** Physical shapes, not opacity or half-block point sampling. No generation. */
export function clearSegment(
  world: SightWorld,
  sx: number,
  sy: number,
  sz: number,
  tx: number,
  ty: number,
  tz: number,
): boolean {
  if (![sx, sy, sz, tx, ty, tz].every(Number.isFinite)) return false;
  const dx = tx - sx,
    dy = ty - sy,
    dz = tz - sz,
    distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-8) return true;
  const view = {
    hasChunk: (x: number, z: number) =>
      world.hasChunk ? world.hasChunk(x, z) : true,
    peekBlock: (x: number, y: number, z: number) =>
      world.hasChunk && !world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))
        ? B.BEDROCK
        : world.peekBlock(x, y, z),
  };
  return (
    World.prototype.raycast.call(
      view,
      sx,
      sy,
      sz,
      dx / distance,
      dy / distance,
      dz / distance,
      distance,
      { solidOnly: true },
    ) === null
  );
}

/** Fraction of a receiver's body exposed BEFORE blocks are destroyed.
 * Bounded multi-ray sampling (<=125 rays/entity), not full Java explosion parity.
 * Sampling the whole body also distinguishes partial cover from a solid wall. */
export function blastExposure(
  world: SightWorld,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
): number {
  if (
    ![sx, sy, sz, x, y, z, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return 0;
  const nx = Math.min(5, Math.max(2, Math.ceil(width * 2 + 1))),
    ny = Math.min(5, Math.max(2, Math.ceil(height * 2 + 1)));
  let visible = 0;
  for (let ix = 0; ix < nx; ix++)
    for (let iy = 0; iy < ny; iy++)
      for (let iz = 0; iz < nx; iz++) {
        if (
          clearSegment(
            world,
            sx,
            sy,
            sz,
            x - width / 2 + (width * (ix + 0.5)) / nx,
            y + (height * (iy + 0.5)) / ny,
            z - width / 2 + (width * (iz + 0.5)) / nx,
          )
        )
          visible++;
      }
  return visible / (nx * ny * nx);
}
