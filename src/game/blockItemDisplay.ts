import * as THREE from "three";
import { B, isTrap } from "./blocks";
import {
  applyTrapdoorDisplay,
  itemDisplayMatrix,
  TRAPDOOR_GROUND_OFFSET_Y,
  type TrapdoorDisplayContext,
} from "./trapdoorItem";

/** Each item/model chain is pinned in java-cube-display-26.3. Do not apply
 * these defaults indiscriminately to slabs, plants or special item models.
 */
export const CUBE_DISPLAY_IDS = [
  B.STONE,
  B.COBBLE,
  B.DIRT,
  B.PLANKS,
  B.SAND,
] as const;
const cubes = new Set<number>(CUBE_DISPLAY_IDS);
export const CUBE_ITEM_DISPLAY = {
  firstperson_righthand: {
    rotation: [0, 45, 0],
    translation: [0, 0, 0],
    scale: [0.4, 0.4, 0.4],
  },
  firstperson_lefthand: {
    rotation: [0, 225, 0],
    translation: [0, 0, 0],
    scale: [0.4, 0.4, 0.4],
  },
  thirdperson_righthand: {
    rotation: [75, 45, 0],
    translation: [0, 2.5, 0],
    scale: [0.375, 0.375, 0.375],
  },
  ground: {
    rotation: [0, 0, 0],
    translation: [0, 3, 0],
    scale: [0.25, 0.25, 0.25],
  },
} as const;
export function hasReferenceItemDisplay(id: number): boolean {
  return isTrap(id) || cubes.has(id);
}
const cache = new Map<string, THREE.Matrix4>();
export function applyReferenceItemDisplay(
  object: THREE.Object3D,
  id: number,
  context: TrapdoorDisplayContext,
  left = false,
): void {
  if (isTrap(id)) {
    applyTrapdoorDisplay(object, context, left);
    return;
  }
  if (!cubes.has(id)) return;
  const key = context + ":" + left;
  if (!cache.has(key)) {
    const display =
      context === "ground"
        ? CUBE_ITEM_DISPLAY.ground
        : context === "thirdperson"
          ? CUBE_ITEM_DISPLAY.thirdperson_righthand
          : left
            ? CUBE_ITEM_DISPLAY.firstperson_lefthand
            : CUBE_ITEM_DISPLAY.firstperson_righthand;
    cache.set(key, itemDisplayMatrix(display, context !== "ground" && left));
  }
  object.updateMatrix();
  object.matrix.multiply(cache.get(key)!);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
}
export function referenceGroundOffset(id: number): number {
  return hasReferenceItemDisplay(id) ? TRAPDOOR_GROUND_OFFSET_Y : 0;
}
