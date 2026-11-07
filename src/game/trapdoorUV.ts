/** Oak trapdoor UV coordinates in source-image pixels (origin at top left).
 * Geometry/state IDs live elsewhere. Verified against the pinned non-orientable
 * template_trapdoor_* models, not template_orientable_trapdoor_*.
 * Closed direction/half and open half do not rotate the oak material.
 */
export type PanelUVs = readonly (readonly (readonly [number, number])[])[];
const cache: PanelUVs[] = [];
// Corner order of the existing box mesher: -x,+x,-y,+y,-z,+z.
export const PANEL_CORNERS = [
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
const normals = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];
/** `edge` is the project's open panel edge N/E/S/W, opposite Java FACING.
 * The reference open model starts at the south edge (Java north facing).
 * UVs rotate with the model: no uvlock and no per-frame allocation.
 */
export function trapdoorUVs(edge: number, open: boolean): PanelUVs {
  const key = open ? edge & 3 : 4;
  if (cache[key]) return cache[key];
  const turns = open ? (edge + 2) & 3 : 0;
  return (cache[key] = PANEL_CORNERS.map((quad, worldFace) =>
    quad.map((corner): readonly [number, number] => {
      let [x, y, z] = corner;
      let [nx, ny, nz] = normals[worldFace];
      // Inverse blockstate Y rotation, in normalized box-corner coordinates.
      for (let r = 0; r < turns; r++) {
        [x, z] = [z, 1 - x];
        [nx, nz] = [nz, -nx];
      }
      const face = normals.findIndex(
        (n) => n[0] === nx && n[1] === ny && n[2] === nz,
      );
      if (open) {
        if (face < 2) return [16 - 3 * z, 16 * (1 - y)];
        if (face < 4) return [16 * x, 16 - 3 * z];
        return [16 * (face === 4 ? 1 - x : x), 16 * (1 - y)];
      }
      if (face === 0) return [16 * z, 13 + 3 * y];
      if (face === 1) return [16 * (1 - z), 13 + 3 * y];
      if (face === 2) return [16 * x, 16 * (1 - z)];
      if (face === 3) return [16 * x, 16 * z];
      return [16 * (face === 4 ? 1 - x : x), 13 + 3 * y];
    }),
  ));
}
