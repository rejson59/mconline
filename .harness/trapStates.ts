import assert from "node:assert/strict";
import * as THREE from "three";
import {
  B,
  BLOCKS,
  IS_SOLID,
  IS_OPAQUE,
  IS_LEAFY,
  OCCLUDES,
  CULLS,
  LAYER,
  RENDER,
  EMIT,
  CREATIVE_BLOCKS,
  collisionBoxes,
  isTrap,
  isTrapOpen,
  isTrapTop,
  trapFacing,
  trapIdFor,
  buildingItem,
} from "../src/game/blocks";
import { World, Chunk } from "../src/game/world";
import { Game } from "../src/game/engine";
import { Inventory } from "../src/game/inventory";
import { blockDrops, fuelSeconds, I } from "../src/game/items";
import { stepBody, type Body } from "../src/game/physics";
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";
let checks = 0;
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (e) {
    console.error(name);
    throw e;
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
}
function world() {
  const w = new World(434, true);
  for (let cx = -1; cx <= 1; cx++)
    for (let cz = -1; cz <= 1; cz++)
      w.chunks.set(World.key(cx, cz), new Chunk(cx, cz));
  return w;
}
function game(w: World) {
  const inventory = new Inventory();
  let spent = 0,
    changes = 0;
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
    lookDir: () => new THREE.Vector3(0, 0, -1),
    eyePos: () => new THREE.Vector3(5.5, 100.25, 5.5),
    consumeSelected() {
      spent++;
    },
    onBlockChanged() {
      changes++;
    },
    fallGravity() {},
    message() {},
    emitHud() {},
    updateHand() {},
    unlock() {},
  });
  return { g, inventory, spent: () => spent, changes: () => changes };
}
const wings = [
  [0, 0, 0, 1, 1, 3 / 16],
  [13 / 16, 0, 0, 1, 1, 1],
  [0, 0, 13 / 16, 1, 1, 1],
  [0, 0, 0, 3 / 16, 1, 1],
];
const modern = Array.from({ length: 16 }, (_, i) => 503 + i);
for (let state = 0; state < 16; state++) {
  const id = 503 + state,
    f = state % 4,
    top = !!(state & 4),
    open = !!(state & 8),
    box = open
      ? wings[f]
      : top
        ? [0, 13 / 16, 0, 1, 1, 1]
        : [0, 0, 0, 1, 3 / 16, 1];
  test(`state ${id}: decode, registry (including IDs >511), canonical inventory/drop/fuel`, () => {
    assert.equal(trapIdFor(f, top, open), id);
    assert.ok(isTrap(id));
    assert.equal(trapFacing(id), f);
    assert.equal(isTrapTop(id), top);
    assert.equal(isTrapOpen(id), open);
    assert.deepEqual([...collisionBoxes(id)!], box);
    assert.equal(IS_SOLID[id], 1);
    for (const table of [
      IS_OPAQUE,
      IS_LEAFY,
      OCCLUDES,
      CULLS,
      LAYER,
      RENDER,
      EMIT,
    ])
      assert.equal(table[id], 0);
    assert.ok(BLOCKS[id]);
    assert.ok(!CREATIVE_BLOCKS.includes(id));
    assert.equal(buildingItem(id), B.TRAP);
    assert.deepEqual(blockDrops(id, I.IRON_AXE), [{ id: B.TRAP, count: 1 }]);
    assert.deepEqual(blockDrops(id, I.IRON_AXE, { silk: true }), [
      { id: B.TRAP, count: 1 },
    ]);
    assert.equal(fuelSeconds(id), 15);
  });
  test(`state ${id}: shared rendered/worker bounds match physical shape`, () => {
    const w = world();
    w.setBlock(5, 100, 5, id);
    const direct = w.buildMesh(w.getChunk(0, 0)),
      { snapshot } = snapshotMesh(w, 0, 0),
      worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
    assert.deepEqual(meshFingerprint(worker), meshFingerprint(direct));
    const p = direct[0].getAttribute("position");
    assert.equal(p.count, 24);
    for (let axis = 0; axis < 3; axis++) {
      const values = Array.from({ length: p.count }, (_, i) =>
          p.getComponent(i, axis),
        ),
        base = axis === 1 ? 100 : 5;
      near(Math.min(...values), base + box[axis]);
      near(Math.max(...values), base + box[axis + 3]);
    }
    for (const g of [...direct, ...worker]) g.dispose();
  });
  test(`state ${id}: fast collision both ways, real surface ray and exact outline`, () => {
    const w = world();
    w.setBlock(5, 100, 5, id);
    const axis = open ? (f % 2 ? 0 : 2) : 1,
      base = axis === 1 ? 100 : 5;
    for (const sign of [-1, 1]) {
      const b: Body = {
        pos: new THREE.Vector3(5.5, 100.5, 5.5),
        vel: new THREE.Vector3(),
        w: 0.1,
        h: 0.1,
        onGround: false,
        hitWall: false,
      };
      b.pos.setComponent(axis, base + (sign > 0 ? -1 : 2));
      b.vel.setComponent(axis, 40 * sign);
      stepBody(w, b, 0.1);
      near(
        b.pos.getComponent(axis),
        sign > 0
          ? base + box[axis] - (axis === 1 ? b.h : b.w / 2)
          : base + box[axis + 3] + (axis === 1 ? 0 : b.w / 2),
      );
    }
    const origin: [number, number, number] = [5.5, 100.5, 5.5],
      direction: [number, number, number] = [0, 0, 0];
    origin[axis] = base - 1;
    direction[axis] = 1;
    for (const solidOnly of [false, true]) {
      const hit = w.raycast(...origin, ...direction, 3, { solidOnly })!;
      assert.equal(hit.id, id);
      near(hit.dist, 1 + box[axis]);
    }
    const { g } = game(w);
    g.selection = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial(),
    );
    g.crackMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    g.updateBuildingTarget(id, 5, 100, 5);
    for (const [mesh, scale] of [
      [g.selection, 1.004],
      [g.crackMesh, 1.006],
    ] as const) {
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox;
      for (let a = 0; a < 3; a++)
        near(
          b.max.getComponent(a) - b.min.getComponent(a),
          (box[a + 3] - box[a]) * scale,
        );
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
  test(`state ${id}: repeated real-use cycles keep half/facing despite changing hit/view`, () => {
    const w = world(),
      { g, inventory, spent, changes } = game(w);
    inventory.slots[0] = { id: B.TRAP, count: 8 };
    w.setBlock(5, 100, 5, id);
    for (let n = 1; n <= 8; n++) {
      g.target = {
        x: 5,
        y: 100,
        z: 5,
        id: w.getBlock(5, 100, 5),
        nx: n % 2 ? 1 : -1,
        ny: 0,
        nz: 0,
      };
      g.yaw = n;
      g.mouseRight = true;
      g.tryUse();
      assert.equal(w.getBlock(5, 100, 5), 503 + (state ^ ((n % 2) * 8)));
      assert.equal(g.mouseRight, false);
    }
    assert.equal(changes(), 8);
    assert.equal(spent(), 0);
    g.target.id = w.getBlock(5, 100, 5);
    g.net = { public: true, canEdit: () => false };
    g.tryUse();
    assert.equal(changes(), 8);
    assert.equal(w.getBlock(5, 100, 5), id);
    // Creative pick-block reuses the canonical item, never leaks a hidden state.
    g.net = null;
    inventory.slots[8] = { id: B.TRAP, count: 1 };
    g.pickBlock();
    assert.equal(g.selected, 0); // current canonical item already in slot 0
    inventory.slots.fill(null);
    g.pickBlock();
    assert.deepEqual(inventory.slots[0], { id: B.TRAP, count: 64 });
  });
}
for (let face = 0; face < 4; face++)
  for (const hitY of [0.1, 0.5, 0.500001, 0.9]) {
    const [nx, nz] = [
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 0],
      ][face],
      top = hitY > 0.5;
    test(`wall placement face ${face}, local height ${hitY}: closed, correct half and collision preflight`, () => {
      const w = world(),
        { g, inventory, spent } = game(w);
      w.setBlock(5 - nx, 100, 5 - nz, B.STONE);
      inventory.slots[0] = { id: B.TRAP, count: 8 };
      g.target = {
        x: 5 - nx,
        y: 100,
        z: 5 - nz,
        id: B.STONE,
        nx,
        ny: 0,
        nz,
        dist: 0,
      };
      g.eyePos = () => new THREE.Vector3(5.5, 100 + hitY, 5.5);
      g.tryUse();
      assert.equal(w.getBlock(5, 100, 5), trapIdFor(face, top));
      assert.equal(spent(), 1);
      w.setBlock(5, 100, 5, B.AIR);
      g.body = {
        pos: new THREE.Vector3(5.5, 100 + (top ? 0.85 : 0.05), 5.5),
        w: 0.1,
        h: 0.1,
      };
      g.tryUse();
      assert.equal(w.getBlock(5, 100, 5), B.AIR);
      assert.equal(spent(), 1);
    });
  }
for (let face = 0; face < 4; face++)
  for (const ny of [-1, 1])
    test(`floor/ceiling placement ${face}/${ny}: look direction persists`, () => {
      const w = world(),
        { g, inventory, spent } = game(w),
        [dx, dz] = [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ][face];
      inventory.slots[0] = { id: B.TRAP, count: 2 };
      w.setBlock(5, 100, 5, B.STONE);
      g.target = { x: 5, y: 100, z: 5, id: B.STONE, nx: 0, ny, nz: 0 };
      g.lookDir = () => new THREE.Vector3(dx, 0, dz);
      g.tryUse();
      assert.equal(w.getBlock(5, 100 + ny, 5), trapIdFor(face, ny < 0));
      assert.equal(spent(), 1);
    });
for (const id of [B.TRAP, B.TRAP_N, B.TRAP_E, B.TRAP_S, B.TRAP_W, ...modern])
  test(`support removal ${id}: no dependent trap destruction`, () => {
    const w = world(),
      { g } = game(w);
    w.setBlock(5, 100, 5, B.STONE);
    w.setBlock(5, 101, 5, id);
    w.setBlock(6, 100, 5, id);
    assert.ok(g.breakBlock(5, 100, 5, true));
    assert.equal(w.getBlock(5, 100, 5), B.AIR);
    assert.equal(w.getBlock(5, 101, 5), id);
    assert.equal(w.getBlock(6, 100, 5), id);
  });
test("all old/new states survive save/load at signed chunk boundaries without automatic remapping", () => {
  const w = world(),
    ids = [68, 69, 70, 71, 72, ...modern];
  ids.forEach((id, i) => w.setBlock(i - 10, 100, i % 2 ? 15 : 16, id));
  const mods = w.serializeMods(),
    restored = new World(434, true);
  restored.loadMods(mods);
  assert.deepEqual(restored.serializeMods(), mods);
  ids.forEach((id, i) =>
    assert.equal(restored.getBlock(i - 10, 100, i % 2 ? 15 : 16), id),
  );
  assert.deepEqual(
    modern,
    [
      503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517,
      518,
    ],
  );
});
for (let face = 0; face < 4; face++)
  test(`legacy wing ${69 + face}: first use adopts upper half without losing edge`, () => {
    const w = world(),
      { g } = game(w);
    w.setBlock(5, 100, 5, 69 + face);
    g.toggleTrap(5, 100, 5, 0, 0);
    assert.equal(w.getBlock(5, 100, 5), trapIdFor(face, true));
    g.toggleTrap(5, 100, 5, 1, 0);
    assert.equal(w.getBlock(5, 100, 5), trapIdFor(face, true, true));
  });
console.log(`Trap states: ${checks} groups passed`);
