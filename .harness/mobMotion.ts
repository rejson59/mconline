import assert from "node:assert/strict";
import * as THREE from "three";
import { Mob, type MobType } from "../src/game/mobs";
import { Game } from "../src/game/engine";
import { World } from "../src/game/world";
import { B, collisionBoxesAt } from "../src/game/blocks";
import { bodyFits } from "../src/game/physics";
import {
  MobMotion,
  mobFits,
  recoverMob,
  mobNeighbours,
} from "../src/game/mobMotion";

let passed = 0,
  failed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  try {
    await run();
    passed++;
    console.log("PASS", name);
  } catch (error) {
    failed++;
    console.error("FAIL", name, error);
  }
}
function world() {
  const w = new World(441, true);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) w.getChunk(x, z);
  return w;
}
const types: MobType[] = [
  "pig",
  "cow",
  "sheep",
  "chicken",
  "wolf",
  "villager",
  "zombie",
  "skeleton",
  "creeper",
  "spider",
  "enderman",
  "golem",
  "slime",
  "ghast",
];
for (const type of types)
  await test(`${type}: large ticks, knockback and solid wall never overlap`, () => {
    const w = world(),
      m = new Mob(type, 8, 65, 8);
    for (let y = 65; y < 76; y++)
      for (let z = 2; z < 15; z++) w.setBlock(11, y, z, B.STONE);
    m.aiTimer = 100;
    for (let n = 0; n < 12; n++) {
      m.kbTime = 0.45;
      m.body.vel.set(14, 0, 0);
      m.update(
        0.35,
        w,
        new THREE.Vector3(20, 65, 8),
        () => {},
        () => {},
        true,
      );
      assert.ok(
        mobFits(w, m.body),
        `${type} inside wall at ${m.body.pos.toArray()}`,
      );
      assert.ok(m.body.pos.x + m.body.w / 2 <= 11 + 1e-6);
    }
    m.dispose();
  });
await test("network-sized ticks use bounded 30Hz physics, not a single gravity impulse", () => {
  const w = world(),
    m = new Mob("creeper", 8, 80, 8);
  m.isTnt = true;
  m.primeFuse = 10;
  m.update(
    0.4,
    w,
    m.body.pos,
    () => {},
    () => {},
    true,
  );
  assert.ok(Math.abs(m.body.pos.y - (80 - 25 * (0.4 / 12) ** 2 * 78)) < 1e-6);
  assert.ok(Math.abs(m.primeFuse - 9.6) < 1e-6);
  m.dispose();
});
for (const id of [B.STONE, B.FENCE, B.CHEST, B.TRAP, B.DOOR_N])
  await test(`embedded body recovers from actual collision shape ${id}`, () => {
    const w = world(),
      m = new Mob("chicken", 8.5, 65, 8.5);
    w.setBlock(8, 65, 8, id);
    const box = collisionBoxesAt(w, 8, 65, 8)!;
    m.body.pos.set(
      8 + (box[0] + box[3]) / 2,
      65 + (box[1] + box[4]) / 2 - m.body.h / 2,
      8 + (box[2] + box[5]) / 2,
    );
    const origin = m.body.pos.clone();
    assert.ok(
      !bodyFits(
        w,
        ...(m.body.pos.toArray() as [number, number, number]),
        m.body.w,
        m.body.h,
      ),
    );
    assert.ok(recoverMob(w, m.body));
    assert.ok(mobFits(w, m.body));
    assert.ok(m.body.pos.distanceTo(origin) <= 2);
    m.dispose();
  });
await test("completely encased entity stays bounded and cannot attack through recovery", () => {
  const w = world(),
    m = new Mob("zombie", 8.5, 65, 8.5);
  for (let x = 5; x <= 11; x++)
    for (let y = 64; y <= 70; y++)
      for (let z = 5; z <= 11; z++) w.setBlock(x, y, z, B.STONE);
  const before = m.body.pos.clone();
  let hits = 0;
  m.update(
    0.4,
    w,
    before,
    () => hits++,
    () => {},
    false,
  );
  assert.deepEqual(m.body.pos.toArray(), before.toArray());
  assert.equal(hits, 0);
  assert.equal(m.group.visible, false);
  m.dispose();
});
await test("unloaded terrain freezes instead of falling, generating terrain or spending fuse", () => {
  const w = new World(441, true),
    m = new Mob("creeper", 8, 65, 8);
  m.isTnt = true;
  m.primeFuse = 4;
  m.update(
    0.4,
    w,
    m.body.pos,
    () => {},
    () => {},
    false,
  );
  assert.equal(w.hasChunk(0, 0), false);
  assert.equal(m.body.pos.y, 65);
  assert.equal(m.primeFuse, 4);
  w.getChunk(0, 0);
  m.update(
    0.1,
    w,
    m.body.pos,
    () => {},
    () => {},
    false,
  );
  assert.ok(m.primeFuse < 4);
  m.dispose();
});
await test("enderman rejects a teleport destination inside a wall", () => {
  const w = world(),
    m = new Mob("enderman", 8.5, 65, 8.5),
    random = Math.random;
  for (let y = 65; y < 69; y++) w.setBlock(4, y, 4, B.STONE);
  m.aiTimer = 100;
  try {
    Math.random = () => 0;
    m.update(
      1 / 60,
      w,
      new THREE.Vector3(9, 65, 8.5),
      () => {},
      () => {},
      false,
    );
  } finally {
    Math.random = random;
  }
  assert.ok(m.body.pos.x > 8);
  assert.ok(mobFits(w, m.body));
  m.dispose();
});
await test("spawn rejects the whole body against adjacent walls and low ceilings", () => {
  const w = world(),
    g: any = Object.assign(Object.create(Game.prototype), {
      world: w,
      mobs: [],
      scene: new THREE.Scene(),
    });
  assert.ok(g.spawnMob("pig", 8.5, 65, 8.5));
  w.setBlock(9, 65, 8, B.STONE);
  assert.ok(
    g.spawnMob("golem", 8.5, 65, 8.5) === null,
    "Adjacent wall must reject the whole body",
  );
  w.setBlock(8, 67, 8, B.STONE);
  assert.ok(
    g.spawnMob("enderman", 8.5, 65, 8.5) === null,
    "Low ceiling must reject the whole body",
  );
  assert.equal(g.mobs.length, 1);
  g.mobs[0].dispose();
});
await test("shared 350ms targets move every frame without per-packet sprints or inventory writes", () => {
  const w = world(),
    m = new Mob("cow", 4.5, 65, 4.5),
    motion = new MobMotion();
  m.group.position.copy(m.body.pos);
  const distances: number[] = [];
  for (let frame = 0; frame < 126; frame++) {
    if (frame % 21 === 0) m.body.pos.x += 0.7;
    const before = m.group.position.x,
      body = m.body.pos.clone();
    motion.present(w, m.body, m.group, 0, 1 / 60);
    assert.deepEqual(m.body.pos.toArray(), body.toArray());
    distances.push(m.group.position.x - before);
    assert.ok(mobFits(w, { ...m.body, pos: m.group.position }));
  }
  assert.ok(Math.min(...distances) > 0.02);
  assert.ok(Math.max(...distances) < 0.04);
  m.dispose();
});
await test("visual interpolation sweeps corners rather than cutting through the wall", () => {
  const w = world(),
    m = new Mob("pig", 6.5, 65, 8.5),
    motion = new MobMotion();
  m.group.position.copy(m.body.pos);
  w.setBlock(7, 65, 7, B.STONE);
  w.setBlock(7, 66, 7, B.STONE);
  m.body.pos.set(8.5, 65, 6.5);
  for (let i = 0; i < 30; i++) {
    motion.present(w, m.body, m.group, 0, 1 / 60);
    assert.ok(mobFits(w, { ...m.body, pos: m.group.position }));
  }
  m.dispose();
});
await test("visual teleports snap only to clear loaded destinations and yaw uses shortest arc", () => {
  const w = world(),
    m = new Mob("pig", 4.5, 65, 4.5),
    motion = new MobMotion();
  m.group.position.copy(m.body.pos);
  m.group.rotation.y = Math.PI - 0.01;
  m.body.pos.x = 14.5;
  motion.present(w, m.body, m.group, -Math.PI + 0.01, 1 / 60);
  assert.equal(m.group.position.x, 14.5);
  assert.ok(m.group.rotation.y > 3);
  m.body.pos.set(50, 65, 50);
  m.group.visible = true;
  motion.present(w, m.body, m.group, 0, 1 / 60);
  assert.equal(m.group.visible, false);
  m.dispose();
});
await test("stale packets finish at the last target and feet stop, without extrapolation through blocks", () => {
  const w = world(),
    m = new Mob("pig", 4.5, 65, 4.5),
    motion = new MobMotion();
  m.group.position.copy(m.body.pos);
  m.body.pos.x += 0.7;
  let swing = 1;
  for (let i = 0; i < 120; i++)
    swing = motion.present(w, m.body, m.group, 0, 1 / 60);
  assert.ok(Math.abs(m.group.position.x - m.body.pos.x) < 1e-6);
  assert.equal(swing, 0);
  m.dispose();
});
await test("crowd grid includes overlapping neighbours across cell boundaries and excludes distant crowds", () => {
  const mobs = Array.from({ length: 400 }, (_, i) => ({
    body: {
      pos: new THREE.Vector3(i * 10, 65, 0),
      vel: new THREE.Vector3(),
      w: 1,
      h: 2,
      onGround: true,
      hitWall: false,
    },
    dead: false,
  }));
  mobs[0].body.pos.x = 3.9;
  mobs[1].body.pos.x = 4.1;
  const near = mobNeighbours(mobs);
  assert.ok(near(mobs[0]).includes(mobs[1]));
  const comparisons = mobs.reduce((n, m) => n + near(m).length, 0);
  assert.ok(comparisons < 2000, `${comparisons} vs 160000 all-pairs`);
});
await test("real shared simulation queues new physics but never teleports the existing visual", async () => {
  const w = world(),
    m = new Mob("pig", 8.5, 65, 8.5);
  m.netId = "mob";
  m.netRegion = "o:0:0";
  m.group.position.copy(m.body.pos);
  m.group.rotation.y = 0.2;
  const region = {
    d: "o",
    x: 0,
    z: 0,
    revision: 1,
    epoch: 1,
    owner: "owner",
    mobs: [m.snapshot()],
  };
  const g: any = Object.assign(Object.create(Game.prototype), {
    world: w,
    mobs: [m],
    scene: new THREE.Scene(),
    mobRegions: new Map(),
    mobUpdates: [],
    mobPollAt: performance.now() - 1000,
    mobTask: null,
    sharedDisposed: false,
    sharedBusy: false,
    body: { pos: new THREE.Vector3(8, 65, 8) },
    furnaces: new Map(),
    anvils: new Map(),
    brewings: new Map(),
    net: {
      id: "owner",
      sharedContainers: true,
      exchangeSharedMobs: async () => ({
        regions: [region],
        hits: [],
        edits: [],
      }),
    },
    canModify: () => true,
  });
  g.updateMobs = () => {
    m.body.pos.x++;
    m.group.position.copy(m.body.pos);
    m.group.rotation.y = 1;
  };
  g.pollSharedMobs();
  await g.mobTask;
  assert.equal(m.group.position.x, 8.5);
  assert.equal(m.group.rotation.y, 0.2);
  assert.equal(g.mobUpdates[0].mobs[0].pos[0], 9.5);
  m.dispose();
});
await test("culled mobs accumulate the actual variable frame time, not last dt times interval", () => {
  const w = world();
  w.getChunk(3, 0);
  const m = new Mob("cow", 60.5, 65, 4.5),
    ticks: number[] = [];
  m.group.position.copy(m.body.pos);
  m.soundTimer = 100;
  m.update = (dt: number) => {
    ticks.push(dt);
  };
  const g: any = Object.assign(Object.create(Game.prototype), {
    world: w,
    mobs: [m],
    scene: new THREE.Scene(),
    body: { pos: new THREE.Vector3(4.5, 65, 4.5) },
    mode: "creative",
    daylight: () => 0,
    entityDistance: 1,
    entityCulling: true,
    governor: { profile: { entityScale: 1 } },
    frameNo: 1,
    spawnTimer: 100,
  });
  g.updateMobs(0.01);
  g.frameNo = 2;
  g.updateMobs(0.09);
  assert.equal(ticks.length, 1);
  assert.ok(Math.abs(ticks[0] - 0.1) < 1e-9);
  m.dispose();
});
for (const fps of [20, 30, 60])
  await test(`500ms packet cadence adapts at ${fps} FPS without a pause on every packet`, () => {
    const w = world(),
      m = new Mob("pig", 4.5, 65, 4.5),
      motion = new MobMotion();
    m.group.position.copy(m.body.pos);
    const steps: number[] = [];
    for (let frame = 0; frame < fps * 3; frame++) {
      if (frame % (fps / 2) === 0) m.body.pos.x += 0.5;
      const before = m.group.position.x;
      motion.present(w, m.body, m.group, 0, 1 / fps);
      if (frame >= fps) steps.push(m.group.position.x - before);
    }
    assert.ok(Math.min(...steps) > 0.5 / fps);
    assert.ok(Math.max(...steps) < 1.5 / fps);
    m.dispose();
  });
console.log(`Mob motion: ${passed} groups passed, ${failed} failed`);
if (failed) process.exitCode = 1;
