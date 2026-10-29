import * as THREE from 'three';
import { armorSlotOf } from './armor';
import { I } from './items';

export const ARMOR_COLORS = ['#9c623b', '#d8e1e5', '#edca45', '#55d9d0'] as const;
export function armorColor(id: number): string {
  if ([I.LEATHER_HELMET, I.LEATHER_CHEST, I.LEATHER_LEGS, I.LEATHER_BOOTS].some(value => value === id)) return ARMOR_COLORS[0];
  if ([I.GOLD_HELMET, I.GOLD_CHEST, I.GOLD_LEGS, I.GOLD_BOOTS].some(value => value === id)) return ARMOR_COLORS[2];
  if ([I.DIAMOND_HELMET, I.DIAMOND_CHEST, I.DIAMOND_LEGS, I.DIAMOND_BOOTS].some(value => value === id)) return ARMOR_COLORS[3];
  return ARMOR_COLORS[1];
}
/** Equipment is deliberately just four known item IDs, never arbitrary meshes. */
export function armorIds(raw: unknown): number[] {
  return Array.from({ length: 4 }, (_, slot) => {
    const id = Array.isArray(raw) ? raw[slot] : undefined;
    return typeof id === 'number' && armorSlotOf(id) === slot ? id : 0;
  });
}

/** Shells are parented to the skin's joints, so walking/head animation stays in sync. */
export class ArmorVisual {
  ids = [0, 0, 0, 0];
  private pieces: THREE.Group[][] = [[], [], [], []];
  constructor(private joints: { head: THREE.Object3D; body: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D }) {}
  update(raw: unknown) {
    const ids = armorIds(raw);
    for (let slot = 0; slot < 4; slot++) {
      if (ids[slot] === this.ids[slot]) continue;
      for (const group of this.pieces[slot]) {
        group.removeFromParent();
        group.traverse(o => {
          if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
        });
      }
      this.pieces[slot] = [];
      if (!ids[slot]) continue;
      const color = armorColor(ids[slot]);
      const box = (parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number]) => {
        const group = new THREE.Group(); group.name = `armor:${slot}`;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshLambertMaterial({ color }));
        mesh.position.set(...pos); group.add(mesh); parent.add(group); this.pieces[slot].push(group);
      };
      const j = this.joints;
      if (slot === 0) {
        // Open face: a top, back and two side plates instead of hiding the skin.
        box(j.head, [0.58, 0.12, 0.58], [0, 0.51, 0]);
        box(j.head, [0.58, 0.43, 0.065], [0, 0.275, 0.255]);
        for (const x of [-0.265, 0.265]) box(j.head, [0.065, 0.43, 0.58], [x, 0.275, 0]);
      } else if (slot === 1) {
        box(j.body, [0.57, 0.68, 0.32], [0, 0.045, 0]);
        for (const arm of [j.armL, j.armR]) box(arm, [0.29, 0.38, 0.31], [0, 0.205, 0]);
      } else if (slot === 2) {
        box(j.body, [0.55, 0.18, 0.30], [0, -0.32, 0]);
        for (const leg of [j.legL, j.legR]) box(leg, [0.275, 0.49, 0.29], [0, 0.12, 0]);
      } else {
        for (const leg of [j.legL, j.legR]) box(leg, [0.29, 0.26, 0.33], [0, -0.255, -0.015]);
      }
    }
    this.ids = ids;
  }
}
