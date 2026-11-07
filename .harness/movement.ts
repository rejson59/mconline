import assert from 'node:assert/strict';
import * as THREE from 'three';
import { B, T, collisionBoxes, tileFor } from '../src/game/blocks';
import { stepBody, bodyFits, type Body } from '../src/game/physics';
import { World, Chunk } from '../src/game/world';
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
} from '../src/game/meshProtocol';
import { meshFingerprint } from './meshFingerprint';
import { isOfficialTile, officialBlockAtlas } from '../src/game/packArt';

let checks = 0,
  failures = 0;
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (error) {
    failures++;
    console.error('FAIL: ' + name, error);
  }
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
}
function scene(blocks: [number, number, number, number][]) {
  const map = new Map(blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  const world = {
    peekBlock: (x: number, y: number, z: number) =>
      map.get(`${x},${y},${z}`) ?? B.AIR,
    hasChunk: () => true,
  } as unknown as World;
  return { world, map };
}
function body(x: number, y: number, z: number, w = 0.6, h = 1.8): Body {
  return {
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    w,
    h,
    onGround: false,
    hitWall: false,
  };
}

// Exact face contacts, not voxel-boundary clipping or accumulated frame rounding.
for (const id of [
  B.CHEST,
  B.CACTUS,
  B.DOOR_N,
  B.DOOR_ON,
  B.DOOR_RN,
  B.DOOR_ORN,
]) {
  const boxes = collisionBoxes(id)!;
  for (const axis of [0, 2] as const)
    for (const direction of [-1, 1]) {
      test(`partial shape ${id}, axis ${axis}, direction ${direction}: contact at actual face`, () => {
        const { world } = scene([[0, 1, 0, id]]),
          b = body(0.5, 1, 0.5, 0.1);
        const lo = boxes[axis],
          hi = boxes[axis + 3];
        const other = axis === 0 ? 2 : 0;
        b.pos.setComponent(other, (boxes[other] + boxes[other + 3]) / 2);
        b.pos.setComponent(axis, direction > 0 ? -0.3 : 1.3);
        b.vel.setComponent(axis, direction * 3);
        stepBody(world, b, 0.6);
        near(
          b.pos.getComponent(axis),
          direction > 0 ? lo - b.w / 2 : hi + b.w / 2,
        );
        assert.equal(b.hitWall, true);
        assert.equal(
          bodyFits(world, b.pos.x, b.pos.y, b.pos.z, b.w, b.h),
          true,
        );
      });
    }
}
for (const direction of [-1, 1])
  test(`thin pane cannot be crossed at high speed ${direction}`, () => {
    const { world } = scene([[0, 1, 0, B.GLASS_PANE]]),
      b = body(direction > 0 ? -0.3 : 1.3, 1, 0.2, 0.1);
    b.vel.x = direction * 25;
    stepBody(world, b, 0.2);
    near(b.pos.x, direction > 0 ? 7 / 16 - 0.05 : 9 / 16 + 0.05);
    assert.equal(b.hitWall, true);
  });
for (const x of [0, -16, 15])
  test(`fence upper half blocks movement across row/chunk boundary x=${x}`, () => {
    const { world } = scene([[x, 0, 0, B.FENCE]]),
      b = body(x - 0.5, 1.1, 0.5);
    assert.equal(bodyFits(world, x + 0.5, 1.1, 0.5, b.w, b.h), false);
    b.vel.x = 5;
    stepBody(world, b, 0.3);
    near(b.pos.x, x + 6 / 16 - b.w / 2);
    assert.equal(b.hitWall, true);
  });
test('landing stays on the upper half of a fence instead of dropping through', () => {
  const { world } = scene([[0, 0, 0, B.FENCE]]),
    b = body(0.5, 3, 0.5);
  for (let i = 0; i < 180; i++) {
    b.vel.y -= 22 / 60;
    stepBody(world, b, 1 / 60);
  }
  near(b.pos.y, 1.5);
  assert.equal(b.onGround, true);
});
for (const [id, height] of [
  [B.STONE, 1],
  [B.OAK_SLAB, 0.5],
  [B.OAK_SLAB_TOP, 1],
  [B.PATH, 15 / 16],
  [B.FARMLAND, 15 / 16],
  [B.CHEST, 14 / 16],
  [B.BED, 9 / 16],
] as const) {
  test(`stable landing and removed support ${id}`, () => {
    const { world, map } = scene([[0, 0, 0, id]]),
      b = body(0.5, 3, 0.5);
    for (let i = 0; i < 180; i++) {
      b.vel.y -= 22 / 60;
      stepBody(world, b, 1 / 60);
    }
    near(b.pos.y, height);
    assert.equal(b.onGround, true);
    map.clear();
    b.vel.y = -2;
    stepBody(world, b, 0.1);
    assert.ok(b.pos.y < height);
    assert.equal(b.onGround, false);
  });
}
test('open door leaves its empty portion passable', () => {
  const { world } = scene([[0, 1, 0, B.DOOR_ON]]),
    b = body(0.5, 1, -0.3, 0.1);
  b.vel.z = 3;
  stepBody(world, b, 0.6);
  near(b.pos.z, 1.5);
  assert.equal(b.hitWall, false);
});
test('head contact at underside of a top slab', () => {
  const { world } = scene([[0, 3, 0, B.OAK_SLAB_TOP]]),
    b = body(0.5, 1, 0.5);
  b.vel.y = 10;
  stepBody(world, b, 0.2);
  near(b.pos.y, 3.5 - b.h);
  assert.equal(b.vel.y, 0);
});
test('step up onto half slab without jumping; full wall still blocks', () => {
  for (const [id, expectedY] of [
    [B.OAK_SLAB, 1.5],
    [B.STONE, 1],
  ] as const) {
    const { world } = scene([
      [-1, 0, 0, B.STONE],
      [0, 0, 0, B.STONE],
      [1, 0, 0, B.STONE],
      [1, 1, 0, id],
    ]);
    const b = body(0.5, 1, 0.5);
    b.onGround = true;
    b.vel.set(3, -1, 0);
    stepBody(world, b, 0.3);
    near(b.pos.y, expectedY);
    assert.equal(b.hitWall, id === B.STONE);
  }
});
test('low ceiling prevents stepping through a slab', () => {
  const { world } = scene([
    [0, 0, 0, B.STONE],
    [1, 0, 0, B.STONE],
    [1, 1, 0, B.OAK_SLAB],
    [0, 3, 0, B.STONE],
    [1, 3, 0, B.STONE],
  ]);
  const b = body(0.5, 1, 0.5);
  b.onGround = true;
  b.vel.set(3, -1, 0);
  stepBody(world, b, 0.3);
  near(b.pos.y, 1);
  assert.equal(b.hitWall, true);
});
test('sub-millimetre endpoint overlap still clips wide bodies at a wall', () => {
  const { world } = scene([[7, 1, 6, B.STONE]]),
    b = body(6, 1, 6.5, 1.4, 0.9);
  b.vel.x = 0.300282296791846;
  stepBody(world, b, 1);
  near(b.pos.x, 6.3);
  assert.equal(b.hitWall, true);
});
test('sneaking keeps the body on the edge', () => {
  const { world } = scene([[0, 0, 0, B.STONE]]),
    b = body(0.5, 1, 0.5);
  b.onGround = true;
  b.vel.set(4, -1, 0);
  stepBody(world, b, 0.5, true);
  assert.ok(b.pos.x < 1.3);
  assert.equal(b.onGround, true);
});
test('fence post uses opaque plank material, not a cut-out fence sprite', () => {
  assert.equal(tileFor(B.FENCE, 0), T.planks);
  assert.equal(isOfficialTile(tileFor(B.FENCE, 0)), true);
  const atlas = officialBlockAtlas()!,
    tile = tileFor(B.FENCE, 0);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const offset =
        ((Math.floor(tile / 16) * 16 + y) * atlas.width +
          (tile % 16) * 16 +
          x) *
        4;
      assert.equal(atlas.data[offset + 3], 255);
    }
});
test('fence mesh and worker use the same opaque plank UVs', () => {
  const world = new World(431, true);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      world.chunks.set(World.key(x, z), new Chunk(x, z));
  world.setBlock(8, 1, 8, B.FENCE);
  const geometries = world.buildMesh(world.getChunk(0, 0));
  const geometry = geometries[1],
    positions = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv');
  assert.equal(positions.count, 24);
  for (let i = 0; i < positions.count; i++) {
    assert.ok(
      positions.getX(i) >= 8 + 6 / 16 && positions.getX(i) <= 8 + 10 / 16,
    );
    assert.ok(
      positions.getZ(i) >= 8 + 6 / 16 && positions.getZ(i) <= 8 + 10 / 16,
    );
    assert.equal(Math.floor(uv.getX(i) * 16), T.planks % 16);
    assert.equal(Math.floor((1 - uv.getY(i)) * 16), Math.floor(T.planks / 16));
  }
  const { snapshot } = snapshotMesh(world, 0, 0);
  const worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
  assert.deepEqual(meshFingerprint(worker), meshFingerprint(geometries));
  for (const g of [...worker, ...geometries]) g.dispose();
});
console.log(`Movement: ${checks} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
