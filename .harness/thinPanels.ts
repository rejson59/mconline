import assert from "node:assert/strict";
import * as THREE from "three";
import {
  B,
  collisionBoxes,
  collisionBoxesAt,
  selectionBoxesAt,
  isTrapOpen,
  trapIdFor,
  trapFacing,
  CREATIVE_BLOCKS,
} from "../src/game/blocks";
import { World, Chunk } from "../src/game/world";
import { Game } from "../src/game/engine";
import { stepBody, type Body } from "../src/game/physics";
import { Inventory } from "../src/game/inventory";
import { blockDrops, I } from "../src/game/items";
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";
let checks = 0,
  failures = 0;
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (error) {
    failures++;
    console.error(name, error);
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
}
function fixture() {
  const w = new World(433, true);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      w.chunks.set(World.key(x, z), new Chunk(x, z));
  return w;
}
const ids = [B.TRAP, B.TRAP_N, B.TRAP_E, B.TRAP_S, B.TRAP_W];
const expected = [
  [0, 13 / 16, 0, 1, 1, 1],
  [0, 0, 0, 1, 1, 3 / 16],
  [13 / 16, 0, 0, 1, 1, 1],
  [0, 0, 13 / 16, 1, 1, 1],
  [0, 0, 0, 3 / 16, 1, 1],
];
for (let index = 0; index < ids.length; index++) {
  const id = ids[index],
    box = expected[index],
    axis = box[3] - box[0] < 0.5 ? 0 : box[4] - box[1] < 0.5 ? 1 : 2;
  test(`trap ${id}: exact legacy model, real physical panel and same renderer/worker bounds`, () => {
    const w = fixture();
    w.setBlock(5, 100, 5, id);
    assert.deepEqual([...collisionBoxes(id)!], box);
    assert.equal(
      selectionBoxesAt(w, 5, 100, 5),
      collisionBoxesAt(w, 5, 100, 5),
    );
    const geometries = w.buildMesh(w.getChunk(0, 0));
    const p = geometries[0].getAttribute("position");
    assert.equal(p.count, 24);
    for (let a = 0; a < 3; a++) {
      const values = Array.from({ length: p.count }, (_, i) =>
        a === 0 ? p.getX(i) : a === 1 ? p.getY(i) : p.getZ(i),
      );
      const origin = a === 1 ? 100 : 5;
      near(Math.min(...values), origin + box[a]);
      near(Math.max(...values), origin + box[a + 3]);
    }
    const { snapshot } = snapshotMesh(w, 0, 0),
      worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
    assert.deepEqual(meshFingerprint(worker), meshFingerprint(geometries));
    for (const g of [...worker, ...geometries]) g.dispose();
  });
  for (const direction of [-1, 1])
    test(`trap ${id}: fast movement stops on panel, direction ${direction}`, () => {
      const w = fixture();
      w.setBlock(5, 100, 5, id);
      const b: Body = {
        pos: new THREE.Vector3(5.5, 100.5, 5.5),
        vel: new THREE.Vector3(),
        w: 0.1,
        h: 0.1,
        onGround: false,
        hitWall: false,
      };
      const origin = axis === 1 ? 100 : 5;
      b.pos.setComponent(axis, origin + (direction > 0 ? -1 : 2));
      b.vel.setComponent(axis, direction * 40);
      stepBody(w, b, 0.1);
      const contact =
        direction > 0
          ? origin + box[axis] - (axis === 1 ? b.h : b.w / 2)
          : origin + box[axis + 3] + (axis === 1 ? 0 : b.w / 2);
      near(b.pos.getComponent(axis), contact);
    });
  test(`trap ${id}: empty part of voxel is targetable through; actual panel stops ray`, () => {
    const w = fixture();
    w.setBlock(5, 100, 5, id);
    const origin = [5.5, 100.5, 5.5],
      dir = [0, 0, 0];
    origin[axis] = axis === 1 ? 99 : 4;
    dir[axis] = 1;
    const hit = w.raycast(
      ...(origin as [number, number, number]),
      ...(dir as [number, number, number]),
      3,
    )!;
    assert.equal(hit.id, id);
    near(hit.dist, 1 + box[axis]);
    const tangent = axis === 0 ? 2 : 0;
    const gap = [5.5, 100.5, 5.5],
      across = [0, 0, 0];
    gap[tangent] = 4;
    across[tangent] = 1;
    for (const solidOnly of [false, true])
      assert.equal(
        w.raycast(
          ...(gap as [number, number, number]),
          ...(across as [number, number, number]),
          3,
          { solidOnly },
        ),
        null,
      );
  });
}
for (const base of [
  B.DOOR_N,
  B.DOOR_ON,
  B.DOOR_UN,
  B.DOOR_UON,
  B.DOOR_RN,
  B.DOOR_ORN,
  B.DOOR_URN,
  B.DOOR_UORN,
])
  for (let f = 0; f < 4; f++) {
    const id = base + f;
    test(`door ${id}: normal target ray and outline use the thin panel, not voxel`, () => {
      const w = fixture();
      w.setBlock(5, 100, 5, id);
      const box = collisionBoxes(id)!,
        axis = box[3] - box[0] < 0.5 ? 0 : 2,
        tangent = axis === 0 ? 2 : 0;
      const origin = [5.5, 100.5, 5.5],
        dir = [0, 0, 0];
      origin[axis] = 4;
      dir[axis] = 1;
      const hit = w.raycast(
        ...(origin as [number, number, number]),
        ...(dir as [number, number, number]),
        3,
      )!;
      assert.equal(hit.id, id);
      near(hit.dist, 1 + box[axis]);
      const gap = [5.5, 100.5, 5.5],
        across = [0, 0, 0];
      gap[tangent] = 4;
      across[tangent] = 1;
      assert.equal(
        w.raycast(
          ...(gap as [number, number, number]),
          ...(across as [number, number, number]),
          3,
        ),
        null,
      );
      const g = Object.assign(Object.create(Game.prototype), {
        world: w,
        selection: new THREE.LineSegments(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial(),
        ),
        crackMesh: new THREE.Mesh(
          new THREE.BufferGeometry(),
          new THREE.MeshBasicMaterial(),
        ),
      });
      g.updateBuildingTarget(id, 5, 100, 5);
      g.selection.geometry.computeBoundingBox();
      const bounds = g.selection.geometry.boundingBox;
      near(
        bounds.max.getComponent(axis) - bounds.min.getComponent(axis),
        (3 / 16) * 1.004,
      );
      for (const mesh of [g.selection, g.crackMesh]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    });
  }
test("trap selection and crack overlay follow open/close and restore cube afterwards", () => {
  const w = fixture(),
    g = Object.assign(Object.create(Game.prototype), {
      world: w,
      selection: new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial(),
      ),
      crackMesh: new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial(),
      ),
    });
  for (const id of ids) {
    w.setBlock(5, 100, 5, id);
    g.updateBuildingTarget(id, 5, 100, 5);
    g.crackMesh.geometry.computeBoundingBox();
    const b = g.crackMesh.geometry.boundingBox,
      expectedBox = expected[ids.indexOf(id)];
    for (let a = 0; a < 3; a++)
      near(
        b.max.getComponent(a) - b.min.getComponent(a),
        (expectedBox[a + 3] - expectedBox[a]) * 1.006,
      );
    const old = g.crackMesh.geometry;
    g.updateBuildingTarget(id, 5, 100, 5);
    assert.equal(g.crackMesh.geometry, old);
  }
  g.updateBuildingTarget(B.STONE, 5, 100, 5);
  g.selection.geometry.computeBoundingBox();
  near(
    g.selection.geometry.boundingBox.max.x -
      g.selection.geometry.boundingBox.min.x,
    1.004,
  );
  for (const mesh of [g.selection, g.crackMesh]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
function useGame(w: World) {
  const inventory = new Inventory();
  let consumed = 0;
  const g: any = Object.assign(Object.create(Game.prototype), {
    world: w,
    inventory,
    selected: 0,
    mode: "creative",
    keys: new Set(),
    mobs: [],
    growables: new Map(),
    yaw: 0,
    body: { pos: new THREE.Vector3(1000, 100, 1000), w: 0.6, h: 1.8 },
    target: null,
    raycastTarget: () => g.target,
    findMobTarget: () => ({ mob: null }),
    lookDir: () => new THREE.Vector3(0, 0, 1),
    eyePos: () => new THREE.Vector3(5.5, 100.25, 5.5),
    consumeSelected() {
      consumed++;
    },
    fallGravity() {},
    onBlockChanged() {},
    message() {},
    updateHand() {},
    emitHud() {},
    unlock() {},
  });
  return { g, inventory, count: () => consumed };
}
test("toggle via real use is one press, no consumed item, protection respected", () => {
  const w = fixture(),
    { g, count } = useGame(w);
  w.setBlock(5, 100, 5, B.TRAP);
  g.target = { x: 5, y: 100, z: 5, id: B.TRAP, nx: 0, ny: 1, nz: 0 };
  g.mouseRight = true;
  g.tryUse();
  assert.ok(isTrapOpen(w.getBlock(5, 100, 5)));
  assert.equal(g.mouseRight, false);
  assert.equal(count(), 0);
  const id = w.getBlock(5, 100, 5);
  g.target.id = id;
  g.mouseRight = true;
  g.tryUse();
  const closed = trapIdFor(trapFacing(id), true);
  assert.equal(w.getBlock(5, 100, 5), closed);
  g.net = { public: true, canEdit: () => false };
  g.tryUse();
  assert.equal(w.getBlock(5, 100, 5), closed);
});
test("side placement permits gap, blocks panel/body intersection and spends nothing on refusal", () => {
  const w = fixture(),
    { g, inventory, count } = useGame(w);
  w.setBlock(4, 100, 5, B.STONE);
  inventory.slots[0] = { id: B.TRAP, count: 8 };
  g.target = { x: 4, y: 100, z: 5, id: B.STONE, nx: 1, ny: 0, nz: 0 };
  g.body.pos.set(5.95, 100.3, 5.5);
  g.body.w = 0.1;
  g.tryUse(); // new wall placement is a closed lower panel
  assert.equal(w.getBlock(5, 100, 5), trapIdFor(3, false));
  assert.equal(count(), 1);
  w.setBlock(5, 100, 5, B.AIR);
  g.body.pos.y = 100.1;
  g.tryUse();
  assert.equal(w.getBlock(5, 100, 5), B.AIR);
  assert.equal(count(), 1);
});
for (const [nx, nz, id] of [
  [0, 1, B.TRAP_N],
  [-1, 0, B.TRAP_E],
  [0, -1, B.TRAP_S],
  [1, 0, B.TRAP_W],
])
  test(`placement ${id}: live mob, dead mob and protected plots`, () => {
    const w = fixture(),
      { g, inventory, count } = useGame(w);
    w.setBlock(5 - nx, 100, 5 - nz, B.STONE);
    inventory.slots[0] = { id: B.TRAP, count: 8 };
    g.target = { x: 5 - nx, y: 100, z: 5 - nz, id: B.STONE, nx, ny: 0, nz };
    const box = expected[ids.indexOf(id as (typeof ids)[number])];
    g.mobs = [
      {
        dead: false,
        body: {
          pos: new THREE.Vector3(
            5 + (box[0] + box[3]) / 2,
            100.05,
            5 + (box[2] + box[5]) / 2,
          ),
          w: 0.1,
          h: 0.1,
        },
      },
    ];
    g.tryUse();
    assert.equal(w.getBlock(5, 100, 5), B.AIR);
    assert.equal(count(), 0);
    g.mobs[0].dead = true;
    g.tryUse();
    assert.equal(w.getBlock(5, 100, 5), trapIdFor(id - B.TRAP_N, false));
    assert.equal(count(), 1);
    w.setBlock(5, 100, 5, B.AIR);
    g.net = {
      public: true,
      canEdit: (x: number, z: number) => x !== 5 || z !== 5,
    };
    g.tryUse();
    assert.equal(w.getBlock(5, 100, 5), B.AIR);
    assert.equal(count(), 1);
  });
test("closed floor placement validates the actual lower panel, not full voxel", () => {
  const w = fixture(),
    { g, inventory, count } = useGame(w);
  w.setBlock(5, 100, 5, B.STONE);
  inventory.slots[0] = { id: B.TRAP, count: 8 };
  g.target = { x: 5, y: 100, z: 5, id: B.STONE, nx: 0, ny: 1, nz: 0 };
  g.body = { pos: new THREE.Vector3(5.5, 101.2, 5.5), w: 0.1, h: 0.1 };
  g.tryUse();
  assert.equal(w.getBlock(5, 101, 5), trapIdFor(2, false));
  assert.equal(count(), 1);
  w.setBlock(5, 101, 5, B.AIR);
  g.body.pos.y = 101.1;
  g.tryUse();
  assert.equal(w.getBlock(5, 101, 5), B.AIR);
  assert.equal(count(), 1);
});
test("underside placement now creates an upper panel", () => {
  const w = fixture(),
    { g, inventory, count } = useGame(w);
  w.setBlock(5, 100, 5, B.STONE);
  inventory.slots[0] = { id: B.TRAP, count: 8 };
  g.target = { x: 5, y: 100, z: 5, id: B.STONE, nx: 0, ny: -1, nz: 0 };
  g.tryUse();
  assert.equal(w.getBlock(5, 99, 5), trapIdFor(2, true));
  assert.equal(count(), 1);
});
test("all five legacy IDs/drop identity/save values remain stable", () => {
  assert.deepEqual(ids, [68, 69, 70, 71, 72]);
  assert.equal(
    CREATIVE_BLOCKS.filter((id) => ids.includes(id as (typeof ids)[number]))
      .length,
    1,
  );
  const w = fixture();
  ids.forEach((id, i) => {
    w.setBlock(5 + i, 100, 5, id);
    assert.deepEqual(blockDrops(id, I.IRON_AXE), [{ id: B.TRAP, count: 1 }]);
  });
  const restored = new World(433, true);
  restored.loadMods(w.serializeMods());
  ids.forEach((id, i) => assert.equal(restored.getBlock(5 + i, 100, 5), id));
});
console.log(`Thin panels: ${checks} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
