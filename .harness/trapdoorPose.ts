import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { B } from "../src/game/blocks";
import { Game } from "../src/game/engine";
import { Inventory } from "../src/game/inventory";
import {
  TRAPDOOR_ITEM_DISPLAY,
  itemDisplayMatrix,
  trapdoorDisplayMatrix,
  applyTrapdoorDisplay,
} from "../src/game/trapdoorItem";
const root = ".harness/fixtures/java-trapdoor-item-26.3/";
const read = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      root + "assets/minecraft/models/block/" + name + ".json",
      "utf8",
    ),
  );
const inherited = { ...read("block").display, ...read("thin_block").display };
let passed = 0,
  failed = 0,
  positions = 0;
function test(name: string, run: () => void) {
  try {
    run();
    passed++;
  } catch (e) {
    failed++;
    if (failed < 4) console.error(name, e);
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 3e-6, `${a} != ${b}`);
}
// Independent scalar trig, not the production matrix or THREE Euler helpers.
function rotate(point: number[], angles: readonly number[]): number[] {
  let [x, y, z] = point;
  for (const axis of [2, 1, 0]) {
    const angle = (angles[axis] * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    if (axis === 2) [x, y] = [c * x - s * y, s * x + c * y];
    else if (axis === 1) [x, z] = [c * x + s * z, -s * x + c * z];
    else [y, z] = [c * y - s * z, s * y + c * z];
  }
  return [x, y, z];
}
function reference(point: number[], context: string, left = false): number[] {
  const key =
    context === "ground"
      ? "ground"
      : context + "_" + (left ? "lefthand" : "righthand");
  const d = inherited[key] ?? inherited[context + "_righthand"];
  const sign = left ? -1 : 1;
  const p = rotate(
    point.map((v, i) => v * d.scale[i]),
    [d.rotation[0], sign * d.rotation[1], sign * d.rotation[2]],
  );
  return p.map((v, i) => v + (d.translation[i] / 16) * (i === 0 ? sign : 1));
}
function checkMesh(
  mesh: THREE.Mesh,
  context: string,
  left = false,
  anchor = [0, 0, 0],
  angles = [0, 0, 0],
) {
  mesh.updateMatrix();
  const p = mesh.geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const point = [p.getX(i), p.getY(i), p.getZ(i)];
    const expected = rotate(reference(point, context, left), angles).map(
      (v, a) => v + anchor[a],
    );
    const actual = new THREE.Vector3(
      ...(point as [number, number, number]),
    ).applyMatrix4(mesh.matrix);
    [actual.x, actual.y, actual.z].forEach((v, a) => near(v, expected[a]));
    positions++;
  }
}
const material = () =>
  new THREE.MeshBasicMaterial({ alphaTest: 0.3, vertexColors: true });
function hands(id: number) {
  const inventory = new Inventory();
  inventory.slots[0] = { id, count: 8 };
  inventory.offhand = { id, count: 1 };
  return Object.assign(Object.create(Game.prototype), {
    inventory,
    selected: 0,
    handId: -999,
    offHandId: -999,
    hand: new THREE.Group(),
    offHand: new THREE.Group(),
    handMat: material(),
  }) as any;
}
function drops() {
  return Object.assign(Object.create(Game.prototype), {
    scene: new THREE.Scene(),
    drops: [],
    dropGeos: new Map(),
    dropMat: material(),
  }) as any;
}
const disposeHands = (g: any) => {
  g.handMesh?.geometry.dispose();
  g.offHandMesh?.geometry.dispose();
  g.handMat.dispose();
};
const disposeDrops = (g: any) => {
  for (const geo of g.dropGeos.values()) geo.dispose();
  g.dropMat.dispose();
};
for (const f of JSON.parse(fs.readFileSync(root + "manifest.json", "utf8"))
  .files)
  test("pinned display fixture " + f.path, () => {
    const bytes = fs.readFileSync(root + f.path);
    assert.equal(bytes.length, f.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), f.sha256);
  });
for (const key of [
  "ground",
  "firstperson_righthand",
  "firstperson_lefthand",
  "thirdperson_righthand",
] as const)
  test("resolved inherited display " + key, () =>
    assert.deepEqual(TRAPDOOR_ITEM_DISPLAY[key], inherited[key]),
  );
for (const context of ["firstperson", "thirdperson", "ground"] as const)
  for (const left of context === "ground" ? [false] : [false, true])
    test("independent display matrix " + context + "/" + left, () => {
      const matrix = trapdoorDisplayMatrix(context, left);
      for (const point of [
        [-0.5, -0.5, -0.5],
        [0.5, -5 / 16, 0.5],
        [0.17, -0.38, -0.22],
      ]) {
        const actual = new THREE.Vector3(
            ...(point as [number, number, number]),
          ).applyMatrix4(matrix),
          expected = reference(point, context, left);
        [actual.x, actual.y, actual.z].forEach((v, i) => near(v, expected[i]));
      }
      // A caller cannot mutate the cached display used by future meshes.
      matrix.identity();
      assert.notDeepEqual(
        matrix.elements,
        trapdoorDisplayMatrix(context, left).elements,
      );
    });
test("left-hand convention flips translation X and rotation Y/Z, never scale or geometry", () => {
  const display = {
      translation: [2, 3, 4],
      rotation: [17, 31, 23],
      scale: [0.3, 0.4, 0.5],
    },
    p = [0.1, 0.2, 0.3];
  for (const left of [false, true]) {
    const sign = left ? -1 : 1,
      actual = new THREE.Vector3(
        ...(p as [number, number, number]),
      ).applyMatrix4(itemDisplayMatrix(display, left));
    const expected = rotate(
      p.map((v, i) => v * display.scale[i]),
      [17, 31 * sign, 23 * sign],
    ).map((v, i) => v + (display.translation[i] / 16) * (i === 0 ? sign : 1));
    [actual.x, actual.y, actual.z].forEach((v, i) => near(v, expected[i]));
  }
});
const ids = [
  68,
  69,
  70,
  71,
  72,
  ...Array.from({ length: 16 }, (_, i) => 503 + i),
];
for (const id of ids) {
  test("real main/offhand display " + id, () => {
    const g = hands(id);
    try {
      g.updateHand();
      checkMesh(
        g.handMesh,
        "firstperson",
        false,
        [0.42, -0.32, -0.62],
        [(0.1 * 180) / Math.PI, 45 + (0.12 * 180) / Math.PI, 0],
      );
      checkMesh(
        g.offHandMesh,
        "firstperson",
        true,
        [-0.42, -0.32, -0.62],
        [(0.1 * 180) / Math.PI, -45 - (0.12 * 180) / Math.PI, 0],
      );
      assert.equal(g.inventory.slots[0].count, 8);
      assert.equal(g.inventory.offhand.count, 1);
      const original = g.handMesh,
        matrix = g.handMesh.matrix.clone();
      g.updateHand();
      assert.equal(g.handMesh, original);
      g.handMesh.updateMatrix();
      assert.deepEqual(g.handMesh.matrix.elements, matrix.elements);
    } finally {
      disposeHands(g);
    }
  });
  test("real ground display and unchanged payload " + id, () => {
    const g = drops();
    try {
      const shared = {
        uid: "synthetic",
        owner: "synthetic",
        d: "o",
        stack: { id, count: 2 },
        pos: [1, 65, 2],
        vel: [0, 0, 0],
        created: 1,
        expires: 9999999999999,
      };
      g.spawnDrop(
        id,
        2,
        1,
        65,
        2,
        undefined,
        0,
        0,
        0,
        undefined,
        undefined,
        shared,
        2,
      );
      const d = g.drops[0];
      checkMesh(d.mesh, "ground", false, [1, 65, 2]);
      assert.deepEqual(d.pos.toArray(), [1, 65, 2]);
      assert.deepEqual(d.vel.toArray(), [0, 0, 0]);
      assert.equal(d.shared, shared);
      assert.equal(d.pickupDelay, 2);
      assert.equal(d.count, 2);
    } finally {
      disposeDrops(g);
    }
  });
  test("real remote avatar uses thin third-person model " + id, () => {
    const base = material(),
      g: any = Object.assign(Object.create(Game.prototype), { handMat: base });
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      material(),
    );
    hand.position.set(0.375, 0.82, -0.26);
    const a: any = { held: id, heldId: 0, hand };
    try {
      g.updateRemoteHeld(a);
      checkMesh(hand, "thirdperson", false, [0.375, 0.82, -0.26]);
      assert.notEqual(hand.material, base);
      assert.ok((hand.material as THREE.Material).alphaTest > 0);
      assert.equal(hand.geometry.getAttribute("position").count, 24);
      const geo = hand.geometry,
        matrix = hand.matrix.clone();
      g.updateRemoteHeld(a);
      assert.equal(hand.geometry, geo);
      hand.updateMatrix();
      assert.deepEqual(hand.matrix.elements, matrix.elements);
    } finally {
      hand.geometry.dispose();
      (hand.material as THREE.Material).dispose();
      base.dispose();
    }
  });
}
test("display is composed after a rotated camera/arm anchor", () => {
  const o = new THREE.Object3D();
  o.position.set(2, 3, 4);
  o.rotation.set(0.2, 0.7, -0.1);
  o.updateMatrix();
  const anchor = o.matrix.clone(),
    expected = anchor.multiply(trapdoorDisplayMatrix("firstperson"));
  applyTrapdoorDisplay(o, "firstperson");
  o.updateMatrix();
  o.matrix.elements.forEach((v, i) => near(v, expected.elements[i]));
});
test("remote switching disposes owned resources, restores placeholder and never disposes shared hand material", () => {
  const base = material();
  let baseDisposals = 0,
    geoDisposals = 0,
    matDisposals = 0;
  base.addEventListener("dispose", () => baseDisposals++);
  const g: any = Object.assign(Object.create(Game.prototype), {
      handMat: base,
    }),
    hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), material());
  hand.position.set(0.35, 0.82, -0.26);
  hand.geometry.addEventListener("dispose", () => geoDisposals++);
  hand.material.addEventListener("dispose", () => matDisposals++);
  const a: any = { held: B.TRAP, heldId: 0, hand };
  g.updateRemoteHeld(a);
  assert.equal(geoDisposals, 1);
  assert.equal(matDisposals, 1);
  a.held = 503;
  g.updateRemoteHeld(a);
  checkMesh(hand, "thirdperson", false, [0.35, 0.82, -0.26]);
  a.held = B.STONE;
  g.updateRemoteHeld(a);
  assert.deepEqual(hand.position.toArray(), [0.35, 0.82, -0.26]);
  assert.deepEqual(hand.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(hand.rotation.toArray().slice(0, 3), [0, 0, 0]);
  assert.equal(baseDisposals, 0);
  a.held = 0;
  g.updateRemoteHeld(a);
  assert.equal(hand.visible, false);
  hand.geometry.dispose();
  (hand.material as THREE.Material).dispose();
  base.dispose();
});
test("real avatar removal disposes owned textures but not the shared atlas", () => {
  const atlas = new THREE.Texture(),
    owned = new THREE.Texture(),
    base = material();
  base.map = atlas;
  let atlasDisposals = 0,
    ownedDisposals = 0,
    handDisposals = 0;
  atlas.addEventListener("dispose", () => atlasDisposals++);
  owned.addEventListener("dispose", () => ownedDisposals++);
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    material(),
  );
  hand.position.set(0.375, 0.82, -0.26);
  const a: any = { held: B.TRAP, heldId: 0, hand, group: new THREE.Group() },
    g: any = Object.assign(Object.create(Game.prototype), {
      atlasTex: atlas,
      handMat: base,
      remotes: new Map([["synthetic", a]]),
    });
  g.updateRemoteHeld(a);
  assert.equal((hand.material as THREE.MeshBasicMaterial).map, atlas);
  (hand.material as THREE.Material).addEventListener(
    "dispose",
    () => handDisposals++,
  );
  a.group.add(
    hand,
    new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ map: owned }),
    ),
  );
  g.dropRemote("synthetic");
  assert.equal(atlasDisposals, 0);
  assert.equal(ownedDisposals, 1);
  assert.equal(handDisposals, 1);
  assert.equal(g.remotes.size, 0);
  base.dispose();
  atlas.dispose();
});
test("other block hand/drop scale is unchanged", () => {
  const h = hands(B.STONE),
    d = drops();
  try {
    h.updateHand();
    near(h.handMesh.scale.x, 0.2);
    near(h.handMesh.position.y, -0.32);
    d.spawnDrop(B.STONE, 1, 1, 65, 1, undefined, 0, 0, 0);
    near(d.drops[0].mesh.scale.x, 0.28);
    near(d.drops[0].mesh.position.y, 65);
  } finally {
    disposeHands(h);
    disposeDrops(d);
  }
});
test("ground translation survives animation without affecting drop physics or pickup delay", () => {
  const g = drops();
  g.body = { pos: new THREE.Vector3(100, 65, 100) };
  g.world = { getBlock: () => 0, peekBlock: () => 0, isSolid: () => false };
  try {
    for (const id of [B.TRAP, B.STONE])
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
    g.updateDrops(0.1);
    const [trap, stone] = g.drops;
    assert.deepEqual(trap.pos.toArray(), stone.pos.toArray());
    assert.deepEqual(trap.vel.toArray(), stone.vel.toArray());
    near(trap.mesh.position.y - stone.mesh.position.y, 3 / 16);
    near(trap.mesh.scale.y, 0.25);
    assert.equal(trap.pickupDelay, 2);
    assert.equal(trap.count, 2);
  } finally {
    disposeDrops(g);
  }
});
console.log(
  `Trap poses: ${passed} groups passed, ${failed} failed, ${positions} transformed vertices compared`,
);
if (failed) process.exitCode = 1;
