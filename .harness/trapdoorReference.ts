import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
const root = path.resolve(".harness/fixtures/java-trapdoor-26.3");
const load = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
// Independent reference interpreter: use the actual parent chain, per-face
// rectangles, Java face corner order and blockstate model rotation. The runtime
// UV helper is deliberately not imported. Corner order corroborated by the
// historical FaceInfo source; only coordinate facts are represented here.
const corners: Record<string, number[][]> = {
  down: [
    [0, 0, 1],
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
  ],
  up: [
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
  ],
  north: [
    [1, 1, 0],
    [1, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
  ],
  south: [
    [0, 1, 1],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  west: [
    [0, 1, 0],
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
  ],
  east: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 0],
    [1, 1, 0],
  ],
};
const normals: Record<string, number[]> = {
  west: [-1, 0, 0],
  east: [1, 0, 0],
  down: [0, -1, 0],
  up: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
};
const normalOrder = ["west", "east", "down", "up", "north", "south"];
function key(pos: number[], face: number) {
  return face + ":" + pos.map((n) => Math.round(n * 65536)).join(",");
}
export function trapdoorReference(id: number) {
  const legacy = id >= 68 && id <= 72;
  const state = id - 503,
    f = legacy ? (id === 68 ? 0 : id - 69) : state % 4,
    top = legacy || !!(state & 4),
    open = legacy ? id !== 68 : !!(state & 8);
  const javaFacing = ["south", "west", "north", "east"][f];
  const variant = load("assets/minecraft/blockstates/oak_trapdoor.json")
    .variants[
    `facing=${javaFacing},half=${top ? "top" : "bottom"},open=${open}`
  ];
  assert.ok(variant);
  assert.ok(!variant.uvlock);
  assert.ok(!variant.x);
  const resolve = (name: string): any => {
    const model = load(
      "assets/minecraft/models/" + name.replace(/^minecraft:/, "") + ".json",
    );
    return model.elements ? model : resolve(model.parent);
  };
  const model = resolve(variant.model),
    matrix = new THREE.Matrix4().makeRotationY(
      (-(variant.y ?? 0) * Math.PI) / 180,
    );
  const out = new Map<string, [number, number]>(),
    box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const element of model.elements)
    for (const [face, definition] of Object.entries(element.faces) as [
      string,
      any,
    ][]) {
      assert.equal(definition.rotation ?? 0, 0);
      const normal = new THREE.Vector3(
        ...(normals[face] as [number, number, number]),
      ).applyMatrix4(matrix);
      const worldFace = normalOrder.findIndex((n) =>
        normals[n].every((v, i) => Math.abs(v - normal.getComponent(i)) < 1e-6),
      );
      assert.ok(worldFace >= 0);
      const r = definition.uv,
        uvs = [
          [r[0], r[1]],
          [r[0], r[3]],
          [r[2], r[3]],
          [r[2], r[1]],
        ];
      corners[face].forEach((c, k) => {
        const pos = new THREE.Vector3(
          ...(c.map(
            (v, i) =>
              (element.from[i] + v * (element.to[i] - element.from[i])) / 16,
          ) as [number, number, number]),
        );
        pos.subScalar(0.5).applyMatrix4(matrix).addScalar(0.5);
        for (let a = 0; a < 3; a++) {
          box[a] = Math.min(box[a], pos.getComponent(a));
          box[a + 3] = Math.max(box[a + 3], pos.getComponent(a));
        }
        out.set(key(pos.toArray(), worldFace), uvs[k] as [number, number]);
      });
    }
  return { out, box };
}
