import * as THREE from "three";
import { officialItemPixels } from "./packArt";
import { decodePng } from "./art/miniPng";
/** Java generated-item silhouette: front/back and opaque-pixel perimeter, 1px thick. */
export function spriteItemGeometry(
  id: number,
  icon?: string,
): THREE.BufferGeometry {
  let rgba: Uint8Array | Uint8ClampedArray | null = officialItemPixels(id),
    size = 16;
  if (!rgba && icon?.startsWith("data:image/png;base64,"))
    try {
      const img = decodePng(icon.slice(icon.indexOf(",") + 1));
      if (img.width === img.height) {
        rgba = img.data;
        size = img.width;
      }
    } catch {
      /* rectangular fallback, still transparent front */
    }
  return spritePixelsGeometry(rgba, size);
}

/** Shared geometry builder for item icons and cross-plant atlas silhouettes. */
export function spritePixelsGeometry(
  rgba: Uint8Array | Uint8ClampedArray | null,
  size = 16,
): THREE.BufferGeometry {
  const positions: number[] = [],
    uvs: number[] = [];
  const face = (p: number[][], u: number[][]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      positions.push(...p[i]);
      uvs.push(...u[i]);
    }
  };
  const z = 1 / 32;
  face(
    [
      [-0.5, -0.5, z],
      [0.5, -0.5, z],
      [0.5, 0.5, z],
      [-0.5, 0.5, z],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
  face(
    [
      [0.5, -0.5, -z],
      [-0.5, -0.5, -z],
      [-0.5, 0.5, -z],
      [0.5, 0.5, -z],
    ],
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  );
  const opaque = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < size &&
    y < size &&
    (!rgba || rgba[(y * size + x) * 4 + 3] >= 32);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (opaque(x, y)) {
        const x0 = x / size - 0.5,
          x1 = (x + 1) / size - 0.5,
          y1 = 0.5 - y / size,
          y0 = 0.5 - (y + 1) / size,
          u = (x + 0.5) / size,
          v = 1 - (y + 0.5) / size,
          tex = [
            [u, v],
            [u, v],
            [u, v],
            [u, v],
          ];
        if (!opaque(x - 1, y))
          face(
            [
              [x0, y0, -z],
              [x0, y0, z],
              [x0, y1, z],
              [x0, y1, -z],
            ],
            tex,
          );
        if (!opaque(x + 1, y))
          face(
            [
              [x1, y0, z],
              [x1, y0, -z],
              [x1, y1, -z],
              [x1, y1, z],
            ],
            tex,
          );
        if (!opaque(x, y - 1))
          face(
            [
              [x0, y1, z],
              [x1, y1, z],
              [x1, y1, -z],
              [x0, y1, -z],
            ],
            tex,
          );
        if (!opaque(x, y + 1))
          face(
            [
              [x0, y0, -z],
              [x1, y0, -z],
              [x1, y0, z],
              [x0, y0, z],
            ],
            tex,
          );
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
