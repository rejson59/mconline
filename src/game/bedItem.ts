import * as THREE from "three";
import { JAVA_BED_TEXTURE } from "./art/javaRefinements.generated";
import { decodePng } from "./art/miniPng";
let bedImage: ReturnType<typeof decodePng> | null = null,
  bedCanvas: HTMLCanvasElement | null = null,
  bedTexture: THREE.DataTexture | null = null;
function image() {
  return (bedImage ??= decodePng(JAVA_BED_TEXTURE));
}
/** A separate texture: the 256px terrain atlas has NO spare 64px square. */
export function createBedItemMaterial() {
  if (!bedTexture) {
    const i = image();
    bedTexture = new THREE.DataTexture(i.data, i.width, i.height);
    bedTexture.colorSpace = THREE.SRGBColorSpace;
    bedTexture.magFilter = bedTexture.minFilter = THREE.NearestFilter;
    bedTexture.needsUpdate = true;
  }
  return new THREE.MeshBasicMaterial({ map: bedTexture, vertexColors: true });
}

// Java BedModel: two 16×16×6 mattress pieces and four 3px legs.
export const BED_ITEM_PARTS = [
  { box: [0, 3, 0, 16, 9, 16], uv: [0, 0] },
  { box: [0, 3, 16, 16, 9, 32], uv: [0, 22] },
  { box: [0, 0, 0, 3, 3, 3], uv: [50, 0] },
  { box: [13, 0, 0, 16, 3, 3], uv: [50, 6] },
  { box: [0, 0, 29, 3, 3, 32], uv: [50, 12] },
  { box: [13, 0, 29, 16, 3, 32], uv: [50, 18] },
];
export function bedItemFaces() {
  const faces: { points: number[][]; uv: number[]; shade: number }[] = [];
  for (const {
    box: [x0, y0, z0, x1, y1, z1],
    uv: [u, v],
  } of BED_ITEM_PARTS) {
    const leg = y1 === 3,
      w = x1 - x0,
      h = y1 - y0,
      d = z1 - z0;
    const rects = leg
      ? [
          [u + d + w, v + d, d, h],
          [u, v + d, d, h],
          [u + d, v, w, d],
          [u + d + w, v, w, d],
          [u + d, v + d, w, h],
          [u + d + w + d, v + d, w, h],
        ]
      : [
          [u, v + 6, 6, 16],
          [u + 22, v + 6, 6, 16],
          [u + 6, v + 6, 16, 16],
          [u + 28, v + 6, 16, 16],
          [u + 6, v, 16, 6],
          [u + 6, v + 22 - 6, 16, 6],
        ];
    const points = [
      [
        [x1, y1, z1],
        [x1, y1, z0],
        [x1, y0, z1],
        [x1, y0, z0],
      ],
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z0],
        [x0, y0, z1],
      ],
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
      ],
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x0, y0, z0],
        [x1, y0, z0],
      ],
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x0, y0, z1],
        [x1, y0, z1],
      ],
      [
        [x1, y1, z0],
        [x0, y1, z0],
        [x1, y0, z0],
        [x0, y0, z0],
      ],
    ];
    points.forEach((p, i) =>
      faces.push({
        points: p,
        uv: rects[i],
        shade: [0.65, 0.65, 1, 0.5, 0.8, 0.8][i],
      }),
    );
  }
  return faces;
}
export function bedItemGeometry(): THREE.BufferGeometry {
  const pos: number[] = [],
    uv: number[] = [],
    colors: number[] = [];
  for (const face of bedItemFaces())
    for (const i of [0, 2, 1, 2, 3, 1]) {
      const p = face.points[i];
      pos.push(p[0] / 16 - 0.5, p[1] / 16 - 9 / 32, p[2] / 16 - 1);
      const [u, v, w, h] = face.uv;
      uv.push((u + (i % 2) * w) / 64, (v + (i >= 2 ? h : 0)) / 64);
      colors.push(face.shade ** 2, face.shade ** 2, face.shade ** 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
export function drawBedIcon(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement,
) {
  if (!bedCanvas) {
    const i = image();
    bedCanvas = document.createElement("canvas");
    bedCanvas.width = i.width;
    bedCanvas.height = i.height;
    const c = bedCanvas.getContext("2d")!,
      data = c.createImageData(i.width, i.height);
    data.data.set(i.data);
    c.putImageData(data, 0, 0);
  }
  atlas = bedCanvas;
  const x = 0,
    y = 0;
  const project = (p: number[]) => [
    24 + (p[0] - 8) * 1.35 - (p[2] - 16) * 0.65,
    25 + (p[0] - 8) * 0.65 + (p[2] - 16) * 0.34 - p[1] * 1.6,
  ];
  // Each cuboid is painted back to front; only the three visible sides.
  const faces = bedItemFaces().filter((_, i) => [0, 2, 4].includes(i % 6));
  faces.sort(
    (a, b) =>
      a.points.reduce((n, p) => n + p[0] + p[2], 0) -
      b.points.reduce((n, p) => n + p[0] + p[2], 0),
  );
  for (const f of faces) {
    const [p, q, r] = f.points.map(project),
      [u, v, w, h] = f.uv;
    ctx.setTransform(
      (q[0] - p[0]) / w,
      (q[1] - p[1]) / w,
      (r[0] - p[0]) / h,
      (r[1] - p[1]) / h,
      p[0],
      p[1],
    );
    ctx.drawImage(atlas, x + u, y + v, w, h, 0, 0, w, h);
    if (f.shade < 1) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(0,0,0,${1 - f.shade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }
  }
}
