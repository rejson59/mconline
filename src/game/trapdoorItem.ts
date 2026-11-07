import * as THREE from "three";
import { PANEL_CORNERS, trapdoorUVs } from "./trapdoorUV";

// The 26.3 item definition selects oak_trapdoor_bottom, independently of the
// world block's direction/half/open state. No block registry or canvas at import.
const shades = [0.62, 0.62, 0.5, 1, 0.8, 0.8];
export const TRAPDOOR_ITEM_DISPLAY = {
  firstperson_righthand: {
    rotation: [0, 45, 0],
    translation: [0, 4.2, 0],
    scale: [0.4, 0.4, 0.4],
  },
  firstperson_lefthand: {
    rotation: [0, 225, 0],
    translation: [0, 4.2, 0],
    scale: [0.4, 0.4, 0.4],
  },
  thirdperson_righthand: {
    rotation: [75, 45, 0],
    translation: [0, 2.5, 2],
    scale: [0.375, 0.375, 0.375],
  },
  ground: {
    rotation: [0, 0, 0],
    translation: [0, 3, 0],
    scale: [0.25, 0.25, 0.25],
  },
  gui: {
    rotation: [30, 225, 0],
    translation: [0, 0, 0],
    scale: [0.625, 0.625, 0.625],
  },
} as const;
export type TrapdoorDisplayContext = "firstperson" | "thirdperson" | "ground";
type Display = {
  readonly rotation: readonly number[];
  readonly translation: readonly number[];
  readonly scale: readonly number[];
};
/** Java ItemTransform convention: translation pixels /16; only translation X
 * and rotation Y/Z change sign for the left hand, never mirror the geometry.
 * The missing thirdperson_lefthand display inherits the right-hand display.
 */
export function itemDisplayMatrix(
  display: Display,
  left = false,
): THREE.Matrix4 {
  const sign = left ? -1 : 1;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(
      (sign * display.translation[0]) / 16,
      display.translation[1] / 16,
      display.translation[2] / 16,
    ),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        (display.rotation[0] * Math.PI) / 180,
        (sign * display.rotation[1] * Math.PI) / 180,
        (sign * display.rotation[2] * Math.PI) / 180,
        "XYZ",
      ),
    ),
    new THREE.Vector3(...(display.scale as [number, number, number])),
  );
}
const displayCache = new Map<string, THREE.Matrix4>();
export function trapdoorDisplayMatrix(
  context: TrapdoorDisplayContext,
  left = false,
): THREE.Matrix4 {
  const key = context + ":" + left;
  if (!displayCache.has(key)) {
    const display =
      context === "ground"
        ? TRAPDOOR_ITEM_DISPLAY.ground
        : context === "thirdperson"
          ? TRAPDOOR_ITEM_DISPLAY.thirdperson_righthand
          : left
            ? TRAPDOOR_ITEM_DISPLAY.firstperson_lefthand
            : TRAPDOOR_ITEM_DISPLAY.firstperson_righthand;
    displayCache.set(
      key,
      itemDisplayMatrix(display, context !== "ground" && left),
    );
  }
  return displayCache.get(key)!.clone();
}
/** Compose after the existing camera/arm anchor, not before it. Swing and
 * camera animation belong to the parent group and are deliberately unchanged.
 */
export function applyTrapdoorDisplay(
  object: THREE.Object3D,
  context: TrapdoorDisplayContext,
  left = false,
): void {
  object.updateMatrix();
  object.matrix.multiply(trapdoorDisplayMatrix(context, left));
  object.matrix.decompose(object.position, object.quaternion, object.scale);
}
export const TRAPDOOR_GROUND_OFFSET_Y =
  TRAPDOOR_ITEM_DISPLAY.ground.translation[1] / 16;

const faces = PANEL_CORNERS.map((quad, face) => ({
  face,
  points: quad.map(([x, y, z]) => [x, (y * 3) / 16, z]),
  uv: trapdoorUVs(0, false)[face],
  shade: shades[face],
}));
export function trapdoorItemFaces() {
  return faces;
}
/** Unposed bottom model, centered about the block origin like Java item models.
 * Display transforms are applied by callers; geometry/UV stay canonical.
 */
export function trapdoorItemGeometry(
  mapUV: (u: number, v: number) => [number, number],
) {
  const pos: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (const f of faces) {
    const base = pos.length / 3;
    f.points.forEach((p, k) => {
      pos.push(p[0] - 0.5, p[1] - 0.5, p[2] - 0.5);
      uv.push(...mapUV(...f.uv[k]));
      colors.push(...Array(3).fill(f.shade ** 2));
    });
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
let guiFaces: ReturnType<typeof projectFaces> | null = null;
function projectFaces() {
  const display = TRAPDOOR_ITEM_DISPLAY.gui;
  const rotation = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(
      ...(display.rotation.map((v) => (v * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
      "XYZ",
    ),
  );
  const visible = faces.map((f) => {
    const vertices = f.points.map((p) =>
      new THREE.Vector3(p[0] - 0.5, p[1] - 0.5, p[2] - 0.5)
        .applyMatrix4(rotation)
        .multiplyScalar(display.scale[0]),
    );
    const normal = vertices[1]
      .clone()
      .sub(vertices[0])
      .cross(vertices[2].clone().sub(vertices[0]));
    return {
      ...f,
      visible: normal.z > 1e-8,
      depth: vertices.reduce((sum, v) => sum + v.z, 0) / 4,
      screen: vertices.map((v) => [24 + 48 * v.x, 24 - 48 * v.y]),
    };
  });
  return visible.filter((f) => f.visible).sort((a, b) => a.depth - b.depth);
}
/** GUI projection uses the inherited block/block display transform. Lighting
 * stays the project's simple face shading, not a native renderer parity claim.
 */
export function trapdoorIconFaces() {
  return (guiFaces ??= projectFaces());
}
/** Affine map from texture-image pixels to a projected face; preserves reversed
 * UV axes instead of sorting the rectangle and losing its orientation.
 */
export function iconFaceTransform(
  uv: readonly (readonly number[])[],
  screen: readonly number[][],
) {
  const [p, q, r] = screen,
    [u, v, w] = uv;
  const sx = q[0] - p[0],
    sy = q[1] - p[1],
    tx = r[0] - p[0],
    ty = r[1] - p[1];
  const ux = v[0] - u[0],
    uy = v[1] - u[1],
    vx = w[0] - u[0],
    vy = w[1] - u[1],
    det = ux * vy - vx * uy;
  const a = (sx * vy - tx * uy) / det,
    b = (sy * vy - ty * uy) / det,
    c = (ux * tx - vx * sx) / det,
    d = (ux * ty - vx * sy) / det;
  return [
    a,
    b,
    c,
    d,
    p[0] - a * u[0] - c * u[1],
    p[1] - b * u[0] - d * u[1],
  ] as const;
}
export function drawTrapdoorIcon(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement,
  tile: number,
) {
  const layer = document.createElement("canvas");
  layer.width = layer.height = 48;
  const paint = layer.getContext("2d")!;
  paint.imageSmoothingEnabled = false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    for (const f of trapdoorIconFaces()) {
      paint.setTransform(1, 0, 0, 1, 0, 0);
      paint.clearRect(0, 0, 48, 48);
      const xs = f.uv.map((p) => p[0]),
        ys = f.uv.map((p) => p[1]),
        x = Math.min(...xs),
        y = Math.min(...ys),
        w = Math.max(...xs) - x,
        h = Math.max(...ys) - y;
      paint.setTransform(...iconFaceTransform(f.uv, f.screen));
      paint.drawImage(
        atlas,
        (tile % 16) * 16 + x,
        Math.floor(tile / 16) * 16 + y,
        w,
        h,
        x,
        y,
        w,
        h,
      );
      // Shade on the isolated face only: holes must not darken earlier faces.
      paint.globalCompositeOperation = "source-atop";
      paint.fillStyle = `rgba(0,0,0,${1 - f.shade})`;
      paint.fillRect(x, y, w, h);
      paint.globalCompositeOperation = "source-over";
      ctx.drawImage(layer, 0, 0);
    }
  } finally {
    ctx.restore();
  }
}
