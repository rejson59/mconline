/** Half-block building shapes, independent of world, renderer and block IDs. */
export type StairShape =
  | 'straight'
  | 'outer_left'
  | 'outer_right'
  | 'inner_left'
  | 'inner_right';
export interface StairState {
  facing: number;
  top: boolean;
}
export const STAIR_DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
/** Java's front-corner / back-corner rule, including the side continuation guard.
 * Materials may differ, but the half must match. Never changes neighbour states. */
export function stairShape(
  get: (x: number, y: number, z: number) => StairState | null,
  x: number,
  y: number,
  z: number,
  state: StairState
): StairShape {
  const f = state.facing,
    [dx, dz] = STAIR_DIRECTIONS[f];
  const continuation = (direction: number) => {
    const [sx, sz] = STAIR_DIRECTIONS[direction],
      n = get(x + sx, y, z + sz);
    return n?.facing === f && n.top === state.top;
  };
  const front = get(x + dx, y, z + dz);
  if (
    front &&
    front.top === state.top &&
    front.facing % 2 !== f % 2 &&
    !continuation((front.facing + 2) % 4)
  )
    return front.facing === (f + 3) % 4 ? 'outer_left' : 'outer_right';
  const back = get(x - dx, y, z - dz);
  if (
    back &&
    back.top === state.top &&
    back.facing % 2 !== f % 2 &&
    !continuation(back.facing)
  )
    return back.facing === (f + 3) % 4 ? 'inner_left' : 'inner_right';
  return 'straight';
}
const boxCache = new Map<string, Float32Array>();
export function stairBoxes(
  facing: number,
  top = false,
  shape: StairShape = 'straight'
): Float32Array {
  const key = `${facing}/${top}/${shape}`,
    cached = boxCache.get(key);
  if (cached) return cached;
  const boxes: number[] = [0, top ? 0.5 : 0, 0, 1, top ? 1 : 0.5, 1];
  const [dx, dz] = STAIR_DIRECTIONS[facing];
  const turn = shape.endsWith('left') ? (facing + 3) % 4 : (facing + 1) % 4;
  const [sx, sz] = STAIR_DIRECTIONS[turn];
  for (let z = 0; z < 2; z++)
    for (let x = 0; x < 2; x++) {
      const a = (x - 0.5) * dx + (z - 0.5) * dz > 0,
        b = (x - 0.5) * sx + (z - 0.5) * sz > 0;
      const filled = shape.startsWith('outer')
        ? a && b
        : shape.startsWith('inner')
          ? a || b
          : a;
      if (filled)
        boxes.push(
          x / 2,
          top ? 0 : 0.5,
          z / 2,
          (x + 1) / 2,
          top ? 0.5 : 1,
          (z + 1) / 2
        );
    }
  // Join adjacent quarter-cells into disjoint half/quarter boxes.
  for (let a = 6; a < boxes.length; a += 6)
    for (let b = a + 6; b < boxes.length; b += 6)
      for (const dim of [0, 2]) {
        if (
          ![0, 1, 2].every(
            (d) =>
              d === dim ||
              (boxes[a + d] === boxes[b + d] &&
                boxes[a + d + 3] === boxes[b + d + 3])
          )
        )
          continue;
        if (
          boxes[a + dim + 3] !== boxes[b + dim] &&
          boxes[b + dim + 3] !== boxes[a + dim]
        )
          continue;
        boxes[a + dim] = Math.min(boxes[a + dim], boxes[b + dim]);
        boxes[a + dim + 3] = Math.max(boxes[a + dim + 3], boxes[b + dim + 3]);
        boxes.splice(b, 6);
        b -= 6;
        break;
      }
  const result = new Float32Array(boxes);
  boxCache.set(key, result);
  return result;
}
export interface BuildingFace {
  face: number;
  points: number[][];
}
const corners = [
  [
    [0, 1, 0],
    [0, 0, 0],
    [0, 1, 1],
    [0, 0, 1],
  ],
  [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [1, 0, 0],
  ],
  [
    [1, 0, 1],
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 1],
    [0, 1, 0],
    [1, 1, 0],
  ],
  [
    [1, 0, 0],
    [0, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ],
];
const directions = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];
const faceCache = new Map<number, BuildingFace[]>();
/** Visible boundary only; merge coplanar half-grid rectangles. No hidden box
 * overlap, stretched brickwork, z-fighting or duplicated internal surfaces. */
export function buildingFaces(boxes: Float32Array): BuildingFace[] {
  let mask = 0;
  for (let y = 0; y < 2; y++)
    for (let z = 0; z < 2; z++)
      for (let x = 0; x < 2; x++)
        for (let i = 0; i < boxes.length; i += 6) {
          if (
            (x + 0.5) / 2 > boxes[i] &&
            (x + 0.5) / 2 < boxes[i + 3] &&
            (y + 0.5) / 2 > boxes[i + 1] &&
            (y + 0.5) / 2 < boxes[i + 4] &&
            (z + 0.5) / 2 > boxes[i + 2] &&
            (z + 0.5) / 2 < boxes[i + 5]
          )
            mask |= 1 << (y * 4 + z * 2 + x);
        }
  const cached = faceCache.get(mask);
  if (cached) return cached;
  const filled = (x: number, y: number, z: number) =>
    x >= 0 &&
    x < 2 &&
    y >= 0 &&
    y < 2 &&
    z >= 0 &&
    z < 2 &&
    !!(mask & (1 << (y * 4 + z * 2 + x)));
  const faces: BuildingFace[] = [];
  for (let f = 0; f < 6; f++) {
    const [dx, dy, dz] = directions[f],
      axis = Math.floor(f / 2),
      rects: number[][] = [];
    for (let y = 0; y < 2; y++)
      for (let z = 0; z < 2; z++)
        for (let x = 0; x < 2; x++) {
          if (!filled(x, y, z) || filled(x + dx, y + dy, z + dz)) continue;
          const r = [
            x / 2,
            y / 2,
            z / 2,
            (x + 1) / 2,
            (y + 1) / 2,
            (z + 1) / 2,
          ];
          r[axis] = r[axis + 3] = f % 2 ? r[axis + 3] : r[axis];
          rects.push(r);
        }
    let changed = true;
    while (changed) {
      changed = false;
      merge: for (let a = 0; a < rects.length; a++)
        for (let b = a + 1; b < rects.length; b++)
          for (let dim = 0; dim < 3; dim++) {
            if (dim === axis) continue;
            const ra = rects[a],
              rb = rects[b];
            if (
              ![0, 1, 2].every(
                (d) => d === dim || (ra[d] === rb[d] && ra[d + 3] === rb[d + 3])
              )
            )
              continue;
            if (ra[dim + 3] !== rb[dim] && rb[dim + 3] !== ra[dim]) continue;
            ra[dim] = Math.min(ra[dim], rb[dim]);
            ra[dim + 3] = Math.max(ra[dim + 3], rb[dim + 3]);
            rects.splice(b, 1);
            changed = true;
            break merge;
          }
    }
    for (const r of rects)
      faces.push({
        face: f,
        points: corners[f].map((p) =>
          p.map((v, d) => r[d] + v * (r[d + 3] - r[d]))
        ),
      });
  }
  faceCache.set(mask, faces);
  return faces;
}
export function buildingUV(
  face: number,
  x: number,
  y: number,
  z: number
): [number, number] {
  switch (face) {
    case 0:
      return [z, y];
    case 1:
      return [1 - z, y];
    case 2:
      return [x, 1 - z];
    case 3:
      return [1 - x, z];
    case 4:
      return [1 - x, y];
    default:
      return [x, y];
  }
}
/** The normal points OUT of the clicked face. Side clicks use the actual hit height. */
export function upperHalf(normalY: number, hitY: number): boolean {
  return normalY < 0 || (normalY === 0 && hitY > 0.5);
}
