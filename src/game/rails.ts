/** Persist only an isolated rail's preferred axis. Connections are derived
 * deterministically from block positions, so saves/network need no side table. */
import { B, isRail } from './blocks';
export type RailShape =
  | 'north_south'
  | 'east_west'
  | 'ascending_east'
  | 'ascending_west'
  | 'ascending_north'
  | 'ascending_south'
  | 'south_east'
  | 'south_west'
  | 'north_west'
  | 'north_east';
export type BlockReader = (x: number, y: number, z: number) => number;
export function railBase(id: number): number {
  return id === B.RAIL_EW
    ? B.RAIL
    : id === B.POWERED_RAIL_EW
      ? B.POWERED_RAIL
      : id === B.DETECTOR_RAIL_EW
        ? B.DETECTOR_RAIL
        : id;
}
export function railPlacement(id: number, dx: number, dz: number): number {
  const base = railBase(id);
  if (Math.abs(dx) <= Math.abs(dz)) return base;
  return base === B.RAIL
    ? B.RAIL_EW
    : base === B.POWERED_RAIL
      ? B.POWERED_RAIL_EW
      : base === B.DETECTOR_RAIL
        ? B.DETECTOR_RAIL_EW
        : id;
}
export function railShape(
  get: BlockReader,
  x: number,
  y: number,
  z: number
): RailShape {
  const id = get(x, y, z),
    flat = (dx: number, dz: number) => isRail(get(x + dx, y, z + dz));
  // Higher rails connect only if the lower rail's headroom is clear.
  const up = (dx: number, dz: number) =>
    get(x, y + 1, z) === B.AIR && isRail(get(x + dx, y + 1, z + dz));
  const linked = (dx: number, dz: number) =>
    flat(dx, dz) ||
    up(dx, dz) ||
    (get(x + dx, y, z + dz) === B.AIR && isRail(get(x + dx, y - 1, z + dz)));
  const n = linked(0, -1),
    s = linked(0, 1),
    e = linked(1, 0),
    w = linked(-1, 0);
  const ns = n || s,
    ew = e || w,
    preferEW =
      id === B.RAIL_EW || id === B.POWERED_RAIL_EW || id === B.DETECTOR_RAIL_EW;
  let shape: RailShape =
    ns && !ew
      ? 'north_south'
      : ew && !ns
        ? 'east_west'
        : preferEW
          ? 'east_west'
          : 'north_south';
  // Powered/detector rails cannot bend, matching Java's straight-rail block.
  if (railBase(id) === B.RAIL) {
    if (s && e && !n && !w) shape = 'south_east';
    if (s && w && !n && !e) shape = 'south_west';
    if (n && w && !s && !e) shape = 'north_west';
    if (n && e && !s && !w) shape = 'north_east';
  }
  if (shape === 'east_west') {
    if (up(1, 0)) shape = 'ascending_east';
    else if (up(-1, 0)) shape = 'ascending_west';
  }
  if (shape === 'north_south') {
    if (up(0, -1)) shape = 'ascending_north';
    else if (up(0, 1)) shape = 'ascending_south';
  }
  return shape;
}
/** UV convention: rail.png runs north/south; rail_corner.png joins south/east.
 * Return UV and height at a world-local corner, preserving square pixels. */
export function railCorner(
  shape: RailShape,
  x: number,
  z: number
): { u: number; v: number; height: number; curved: boolean } {
  const turn =
    shape === 'south_west'
      ? 1
      : shape === 'north_west'
        ? 2
        : shape === 'north_east'
          ? 3
          : 0;
  let u = x,
    v = 1 - z;
  for (let i = 0; i < turn; i++) [u, v] = [1 - v, u];
  const ew =
    shape === 'east_west' ||
    shape === 'ascending_east' ||
    shape === 'ascending_west';
  if (ew) [u, v] = [1 - v, u];
  const rise =
    shape === 'ascending_east'
      ? x
      : shape === 'ascending_west'
        ? 1 - x
        : shape === 'ascending_north'
          ? 1 - z
          : shape === 'ascending_south'
            ? z
            : 0;
  return {
    u,
    v,
    height: 1 / 16 + rise,
    curved:
      shape === 'south_east' ||
      shape === 'south_west' ||
      shape === 'north_west' ||
      shape === 'north_east',
  };
}
