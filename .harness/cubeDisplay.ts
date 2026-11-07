import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { Game } from "../src/game/engine";
import { Inventory } from "../src/game/inventory";
import { B } from "../src/game/blocks";
import {
  CUBE_ITEM_DISPLAY,
  CUBE_DISPLAY_IDS,
  hasReferenceItemDisplay,
} from "../src/game/blockItemDisplay";
const root = ".harness/fixtures/java-cube-display-26.3/";
const read = (p: string) => JSON.parse(fs.readFileSync(root + p, "utf8"));
const manifest = read("manifest.json"),
  base = JSON.parse(
    fs.readFileSync(
      ".harness/fixtures/java-trapdoor-item-26.3/assets/minecraft/models/block/block.json",
      "utf8",
    ),
  ).display;
let checks = 0,
  vertices = 0;
const test = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log("✓ " + name);
};
function near(x: number, y: number) {
  assert.ok(Math.abs(x - y) < 3e-6, `${x} != ${y}`);
}
function rotate(point: number[], angles: number[]) {
  let [x, y, z] = point;
  for (const a of [2, 1, 0]) {
    const c = Math.cos((angles[a] * Math.PI) / 180),
      s = Math.sin((angles[a] * Math.PI) / 180);
    if (a === 2) [x, y] = [c * x - s * y, s * x + c * y];
    else if (a === 1) [x, z] = [c * x + s * z, -s * x + c * z];
    else [y, z] = [c * y - s * z, s * y + c * z];
  }
  return [x, y, z];
}
function inspect(
  mesh: THREE.Mesh,
  key: string,
  anchor: number[],
  angles = [0, 0, 0],
  left = false,
) {
  mesh.updateMatrix();
  const d = base[key],
    sign = left ? -1 : 1,
    p = mesh.geometry.getAttribute("position");
  assert.equal(p.count, 24);
  for (let a = 0; a < 3; a++)
    assert.deepEqual(
      [
        ...new Set(
          Array.from({ length: p.count }, (_, i) => p.getComponent(i, a)),
        ),
      ].sort(),
      [-0.5, 0.5],
    );
  for (let i = 0; i < p.count; i++) {
    const point = [p.getX(i), p.getY(i), p.getZ(i)];
    let expected = rotate(
      point.map((v, a) => v * d.scale[a]),
      [d.rotation[0], sign * d.rotation[1], sign * d.rotation[2]],
    );
    expected = expected.map(
      (v, a) => v + (d.translation[a] / 16) * (a === 0 ? sign : 1),
    );
    expected = rotate(expected, angles).map((v, a) => v + anchor[a]);
    const actual = new THREE.Vector3(
      ...(point as [number, number, number]),
    ).applyMatrix4(mesh.matrix);
    [actual.x, actual.y, actual.z].forEach((v, a) => near(v, expected[a]));
    vertices++;
  }
}
for (const f of manifest.files)
  test("pinned cube display fixture " + f.path, () => {
    const b = fs.readFileSync(root + f.path);
    assert.equal(b.length, f.bytes);
    assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256);
  });
for (const key of [
  "firstperson_righthand",
  "firstperson_lefthand",
  "thirdperson_righthand",
  "ground",
] as const)
  test("cube display inherited from original block " + key, () =>
    assert.deepEqual(CUBE_ITEM_DISPLAY[key], base[key]),
  );
const names = ["stone", "cobblestone", "dirt", "oak_planks", "sand"];
for (let n = 0; n < names.length; n++) {
  const name = names[n],
    id = CUBE_DISPLAY_IDS[n];
  test(name + " item binding and complete model-parent chain", () => {
    assert.equal(
      read("assets/minecraft/items/" + name + ".json").model.model,
      "minecraft:block/" + name,
    );
    assert.equal(
      read("assets/minecraft/models/block/" + name + ".json").parent,
      "minecraft:block/cube_all",
    );
    assert.equal(
      read("assets/minecraft/models/block/cube_all.json").parent,
      "block/cube",
    );
    assert.equal(
      read("assets/minecraft/models/block/cube.json").parent,
      "block/block",
    );
    assert.ok(hasReferenceItemDisplay(id));
  });
  test(name + " actual main/offhand model display", () => {
    const inventory = new Inventory();
    inventory.slots[0] = { id, count: 4 };
    inventory.offhand = { id, count: 1 };
    const g: any = Object.assign(Object.create(Game.prototype), {
      inventory,
      selected: 0,
      handId: -999,
      offHandId: -999,
      hand: new THREE.Group(),
      offHand: new THREE.Group(),
      handMat: new THREE.MeshBasicMaterial(),
    });
    try {
      g.updateHand();
      inspect(
        g.handMesh,
        "firstperson_righthand",
        [0.42, -0.32, -0.62],
        [(0.1 * 180) / Math.PI, 45 + (0.12 * 180) / Math.PI, 0],
      );
      inspect(
        g.offHandMesh,
        "firstperson_lefthand",
        [-0.42, -0.32, -0.62],
        [(0.1 * 180) / Math.PI, -45 - (0.12 * 180) / Math.PI, 0],
        true,
      );
      assert.equal(inventory.slots[0]!.count, 4);
    } finally {
      g.handMesh.geometry.dispose();
      g.offHandMesh.geometry.dispose();
      g.handMat.dispose();
    }
  });
  test(
    name + " actual ground display survives animation without physics changes",
    () => {
      const g: any = Object.assign(Object.create(Game.prototype), {
        scene: new THREE.Scene(),
        drops: [],
        dropGeos: new Map(),
        dropMat: new THREE.MeshBasicMaterial(),
        body: { pos: new THREE.Vector3(100, 65, 100) },
        world: { getBlock: () => 0, peekBlock: () => 0, isSolid: () => false },
      });
      try {
        g.spawnDrop(
          id,
          2,
          1,
          65,
          1,
          undefined,
          0,
          0,
          0,
          undefined,
          undefined,
          undefined,
          2,
        );
        inspect(g.drops[0].mesh, "ground", [1, 65, 1]);
        g.updateDrops(0.1);
        const d = g.drops[0];
        near(
          d.mesh.position.y - d.pos.y,
          0.12 + Math.sin(d.age * 3) * 0.06 + 3 / 16,
        );
        assert.equal(d.pickupDelay, 2);
        assert.equal(d.count, 2);
      } finally {
        for (const geo of g.dropGeos.values()) geo.dispose();
        g.dropMat.dispose();
      }
    },
  );
  test(name + " actual remote held model replaces placeholder", () => {
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshBasicMaterial(),
    );
    hand.position.set(0.375, 0.82, -0.26);
    const g: any = Object.assign(Object.create(Game.prototype), {
        handMat: new THREE.MeshBasicMaterial({ vertexColors: true }),
      }),
      a: any = { held: id, heldId: 0, hand };
    try {
      g.updateRemoteHeld(a);
      inspect(hand, "thirdperson_righthand", [0.375, 0.82, -0.26]);
      assert.equal(hand.visible, true);
      a.held = B.GLASS;
      g.updateRemoteHeld(a);
      near(hand.scale.x, 1);
      near(hand.position.y, 0.82);
    } finally {
      hand.geometry.dispose();
      (hand.material as THREE.Material).dispose();
      g.handMat.dispose();
    }
  });
}
test("unverified/special models never get cube defaults implicitly", () => {
  for (const id of [B.GLASS, B.GRASS, B.TORCH, B.CHEST, B.WATER, -1, 0, 65535])
    assert.equal(hasReferenceItemDisplay(id), false);
});
console.log(
  `Cube display: ${checks} groups passed, ${vertices} transformed vertices compared`,
);
