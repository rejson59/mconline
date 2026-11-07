import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  B,
  collisionBoxesAt,
  selectionBoxesAt,
  fenceMask,
  stairsId,
} from '../src/game/blocks';
import { fenceBoxes, fullSide } from '../src/game/fenceShapes';
import { World, Chunk } from '../src/game/world';
import { Game } from '../src/game/engine';
import { stepBody, bodyFits, type Body } from '../src/game/physics';
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
  currentMesh,
} from '../src/game/meshProtocol';
import { buildingFaces } from '../src/game/buildingShapes';
import { Inventory } from '../src/game/inventory';
import { meshFingerprint } from './meshFingerprint';

let checks = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    checks++;
  } catch (error) {
    console.error(name);
    throw error;
  }
}
function fixture() {
  const world = new World(432, true);
  for (let x = -2; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      world.chunks.set(World.key(x, z), new Chunk(x, z));
  return world;
}
function body(x: number, y: number, z: number, w = 0.1, h = 0.8): Body {
  return {
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    w,
    h,
    onGround: false,
    hitWall: false,
  };
}
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
for (let mask = 0; mask < 16; mask++) {
  test(`mask ${mask}: independent expected post/arms, physics height and outline height`, () => {
    const expected = [6 / 16, 0, 6 / 16, 10 / 16, 1.5, 10 / 16];
    if (mask & 1) expected.push(6 / 16, 0, 0, 10 / 16, 1.5, 6 / 16);
    if (mask & 2) expected.push(10 / 16, 0, 6 / 16, 1, 1.5, 10 / 16);
    if (mask & 4) expected.push(6 / 16, 0, 10 / 16, 10 / 16, 1.5, 1);
    if (mask & 8) expected.push(0, 0, 6 / 16, 6 / 16, 1.5, 10 / 16);
    assert.deepEqual([...fenceBoxes(mask)], expected);
    assert.equal(fenceBoxes(mask), fenceBoxes(mask));
    const outline = expected.map((n, i) => (i % 6 === 4 ? 1 : n));
    assert.deepEqual([...fenceBoxes(mask, false)], outline);
    assert.equal(fenceBoxes(mask, false), fenceBoxes(mask, false));
  });
  test(`mask ${mask}: outline has exact exposed union area and outward winding`, () => {
    const boxes = fenceBoxes(mask, false),
      faces = buildingFaces(boxes);
    let area = 0;
    for (const f of faces) {
      const [a, b, c] = f.points
        .slice(0, 3)
        .map((p) => new THREE.Vector3(...p));
      const normal = b.sub(a).cross(c.sub(a));
      area += normal.length();
      assert.ok(
        normal.getComponent(Math.floor(f.face / 2)) * (f.face % 2 ? 1 : -1) > 0,
      );
    }
    const arms = directions.filter((_, i) => mask & (1 << i)).length;
    assert.equal(area, 1.125 + arms * 0.9375);
    assert.equal(buildingFaces(boxes), faces);
  });
  test(`mask ${mask}: neighbour changes drive both collision and rendered rails`, () => {
    const w = fixture(),
      x = 15,
      y = 4,
      z = 8;
    w.setBlock(x, y, z, B.FENCE);
    for (let i = 0; i < 4; i++)
      if (mask & (1 << i))
        w.setBlock(x + directions[i][0], y, z + directions[i][1], B.STONE);
    assert.equal(
      fenceMask((a, b, c) => w.peekBlock(a, b, c), x, y, z),
      mask,
    );
    assert.equal(collisionBoxesAt(w, x, y, z), fenceBoxes(mask));
    assert.equal(selectionBoxesAt(w, x, y, z), fenceBoxes(mask, false));
    const geos = w.buildMesh(w.getChunk(0, 0));
    // Only fence vertices are in the cutout layer. Stone neighbours are opaque.
    assert.equal(
      geos[1].getAttribute('position').count,
      24 * (1 + 2 * directions.filter((_, i) => mask & (1 << i)).length),
    );
    const { snapshot } = snapshotMesh(w, 0, 0),
      worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
    assert.deepEqual(meshFingerprint(worker), meshFingerprint(geos));
    for (const g of [...geos, ...worker]) g.dispose();
  });
}
for (const id of [B.STONE, B.GLASS, B.ICE, B.FENCE])
  test(`all four sides connect to ${id}`, () => {
    const w = fixture();
    w.setBlock(0, 4, 0, B.FENCE);
    for (const [dx, dz] of directions) w.setBlock(dx, 4, dz, id);
    assert.equal(collisionBoxesAt(w, 0, 4, 0), fenceBoxes(15));
  });
for (const id of [
  B.AIR,
  B.LEAVES,
  B.PUMPKIN,
  B.OAK_SLAB,
  B.OAK_SLAB_TOP,
  B.CHEST,
  B.DOOR_N,
  B.GLASS_PANE,
  B.ANVIL,
  B.WATER,
])
  test(`no spurious connection to partial/exception block ${id}`, () => {
    const w = fixture();
    w.setBlock(0, 4, 0, B.FENCE);
    for (const [dx, dz] of directions) w.setBlock(dx, 4, dz, id);
    assert.equal(collisionBoxesAt(w, 0, 4, 0), fenceBoxes(0));
  });
for (let side = 0; side < 4; side++)
  for (const top of [false, true])
    test(`stair full back face only, side ${side}, upper=${top}`, () => {
      const w = fixture();
      w.setBlock(0, 4, 0, B.FENCE);
      const [dx, dz] = directions[side];
      // High half of a straight stair is its facing half. It must face the fence.
      w.setBlock(dx, 4, dz, stairsId(B.OAK_STAIRS_N, (side + 2) % 4, top));
      assert.equal(collisionBoxesAt(w, 0, 4, 0), fenceBoxes(1 << side));
      w.setBlock(dx, 4, dz, stairsId(B.OAK_STAIRS_N, side, top));
      assert.equal(collisionBoxesAt(w, 0, 4, 0), fenceBoxes(0));
    });
test('face union rejects gaps, not just bounding box size', () => {
  const two = new Float32Array([0, 0, 0, 1, 0.4, 1, 0, 0.6, 0, 1, 1, 1]);
  for (let s = 0; s < 4; s++) assert.equal(fullSide(two, s), false);
  for (let s = 0; s < 4; s++)
    assert.equal(fullSide(new Float32Array([0, 0, 0, 1, 1, 1]), s), true);
});
for (const x of [15, -17])
  test(`cross-chunk changes, stale worker protection and save/reload x=${x}`, () => {
    const w = fixture(),
      y = 100,
      z = 8;
    w.setBlock(x, y, z, B.FENCE);
    const { stamp } = snapshotMesh(w, Math.floor(x / 16), 0);
    w.dirty.clear();
    w.setBlock(x + 1, y, z, B.FENCE);
    assert.equal(collisionBoxesAt(w, x, y, z), fenceBoxes(2));
    assert.equal(collisionBoxesAt(w, x + 1, y, z), fenceBoxes(8));
    assert.equal(currentMesh(stamp), false);
    assert.ok(w.dirty.has(World.key(Math.floor(x / 16), 0)));
    assert.ok(w.dirty.has(World.key(Math.floor((x + 1) / 16), 0)));
    const restored = new World(432, true);
    restored.loadMods(w.serializeMods());
    restored.getChunk(Math.floor(x / 16), 0);
    restored.getChunk(Math.floor((x + 1) / 16), 0);
    assert.equal(restored.getBlock(x, y, z), B.FENCE);
    assert.equal(collisionBoxesAt(restored, x, y, z), fenceBoxes(2));
    w.setBlock(x + 1, y, z, B.AIR);
    assert.equal(collisionBoxesAt(w, x, y, z), fenceBoxes(0));
  });
test('unloaded chunk sentinel never creates a false arm or generates a chunk', () => {
  let forbiddenReads = 0;
  const w = {
    hasChunk: (cx: number) => cx === 0,
    peekBlock: (x: number) => {
      if (x > 15) forbiddenReads++;
      return x === 15 ? B.FENCE : B.STONE;
    },
  };
  assert.equal(collisionBoxesAt(w, 15, 4, 8), fenceBoxes(13));
  assert.equal(selectionBoxesAt(w, 15, 4, 8), fenceBoxes(13, false));
  assert.equal(forbiddenReads, 0);
});
test('body can pass beside the isolated post, but not through its upper half', () => {
  const w = fixture();
  w.setBlock(0, 4, 0, B.FENCE);
  const b = body(-0.3, 4, 0.15);
  b.vel.x = 3;
  stepBody(w, b, 0.6);
  assert.ok(b.pos.x > 1);
  assert.equal(b.hitWall, false);
  assert.equal(bodyFits(w, 0.5, 5.1, 0.5, 0.1, 0.8), false);
  assert.equal(bodyFits(w, 0.15, 5.1, 0.15, 0.1, 0.8), true);
});
test('target ray uses outline, combat ray uses 1.5-high collision, neither hits empty corners', () => {
  const w = fixture();
  w.setBlock(0, 4, 0, B.FENCE);
  assert.equal(w.raycast(-1, 4.5, 0.15, 1, 0, 0, 2.5), null);
  assert.equal(
    w.raycast(-1, 4.5, 0.15, 1, 0, 0, 2.5, { solidOnly: true }),
    null,
  );
  const hit = w.raycast(-1, 4.5, 0.5, 1, 0, 0, 2.5)!;
  assert.equal(hit.id, B.FENCE);
  assert.equal(hit.nx, -1);
  assert.equal(hit.dist, 1 + 6 / 16);
  assert.equal(w.raycast(-1, 5.2, 0.5, 1, 0, 0, 2.5), null);
  assert.equal(
    w.raycast(-1, 5.2, 0.5, 1, 0, 0, 2.5, { solidOnly: true })?.id,
    B.FENCE,
  );
  w.setBlock(1, 4, 0, B.STONE);
  assert.equal(w.raycast(-1, 4.5, 0.15, 1, 0, 0, 3)?.id, B.STONE);
});
test('outline and break overlay update with neighbours, remain one block tall', () => {
  const w = fixture();
  w.setBlock(0, 4, 0, B.FENCE);
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
  g.updateBuildingTarget(B.FENCE, 0, 4, 0);
  g.selection.geometry.computeBoundingBox();
  let box = g.selection.geometry.boundingBox;
  assert.ok(Math.abs(box.max.x - box.min.x - 0.25 * 1.004) < 1e-6);
  assert.ok(Math.abs(box.max.y - box.min.y - 1.004) < 1e-6);
  const old = g.crackMesh.geometry;
  g.updateBuildingTarget(B.FENCE, 0, 4, 0);
  assert.equal(g.crackMesh.geometry, old);
  w.setBlock(1, 4, 0, B.FENCE);
  g.updateBuildingTarget(B.FENCE, 0, 4, 0);
  assert.notEqual(g.crackMesh.geometry, old);
  g.selection.geometry.computeBoundingBox();
  box = g.selection.geometry.boundingBox;
  assert.ok(Math.abs(box.max.x - box.min.x - 0.625 * 1.004) < 1e-6);
  for (const mesh of [g.selection, g.crackMesh]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
test('placement permits empty corner but protects player/live mobs and new neighbouring arms', () => {
  const w = fixture();
  w.setBlock(0, 4, 0, B.FENCE);
  const b = body(0.9, 4, 0.5, 0.1),
    g = Object.assign(Object.create(Game.prototype), {
      world: w,
      body: b,
      mobs: [],
    });
  assert.equal(g.canPlaceBuilding(B.FENCE, 1, 4, 0), false); // new arm in OLD fence cell
  assert.equal(g.canPlaceBuilding(B.STONE, 1, 4, 0), false);
  b.pos.set(1.15, 4, 0.15);
  assert.equal(g.canPlaceBuilding(B.FENCE, 1, 4, 0), true);
  b.pos.set(1.5, 4, 0.5);
  assert.equal(g.canPlaceBuilding(B.FENCE, 1, 4, 0), false);
  b.pos.set(100, 4, 100);
  g.mobs = [{ dead: false, body: body(0.9, 4, 0.5) }];
  assert.equal(g.canPlaceBuilding(B.FENCE, 1, 4, 0), false);
  g.mobs[0].dead = true;
  assert.equal(g.canPlaceBuilding(B.FENCE, 1, 4, 0), true);
});
test('real use/placement protects neighbour arms, spends nothing on rejection and respects plots', () => {
  const w = fixture(),
    inventory = new Inventory();
  let consumed = 0;
  w.setBlock(0, 4, 0, B.FENCE);
  w.setBlock(1, 3, 0, B.STONE);
  const g = Object.assign(Object.create(Game.prototype), {
    world: w,
    inventory,
    selected: 0,
    mode: 'creative',
    keys: new Set(),
    mobs: [],
    growables: new Map(),
    body: body(1.15, 4, 0.15),
    raycastTarget: () => ({
      x: 1,
      y: 3,
      z: 0,
      id: B.STONE,
      nx: 0,
      ny: 1,
      nz: 0,
      dist: 1,
    }),
    findMobTarget: () => ({ mob: null }),
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
  inventory.slots[0] = { id: B.FENCE, count: 8 };
  g.tryUse();
  assert.equal(w.getBlock(1, 4, 0), B.FENCE);
  assert.equal(consumed, 1);
  w.setBlock(1, 4, 0, B.AIR);
  g.body.pos.set(0.9, 4, 0.5);
  g.tryUse();
  assert.equal(w.getBlock(1, 4, 0), B.AIR);
  assert.equal(consumed, 1);
  g.body.pos.set(100, 4, 100);
  g.net = { public: true, canEdit: () => false };
  g.tryUse();
  assert.equal(w.getBlock(1, 4, 0), B.AIR);
  assert.equal(consumed, 1);
});
console.log(`Fences: ${checks} groups passed`);
