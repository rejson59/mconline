import assert from "node:assert/strict";
import * as THREE from "three";
import { World, Chunk, CS, CH } from "../src/game/world";
import { B } from "../src/game/blocks";
import { lightLevel } from "../src/game/lightMap";
import { EntityLighting } from "../src/game/entityLighting";
import { HeldLightField } from "../src/game/heldLightField";
import { Mob, type MobType } from "../src/game/mobs";
import { ArmorVisual } from "../src/game/armorVisual";
import { I } from "../src/game/items";
import {
  meshSnapshot,
  snapshotMesh,
  replyTransfers,
} from "../src/game/meshProtocol";
import { AsyncMesher, type MeshWorker } from "../src/game/asyncMesher";
let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log("PASS", name);
}
function world() {
  const w = new World(445, true);
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) w.getChunk(x, z);
  return w;
}
function build(w: World) {
  const geos = w.buildMesh(w.getChunk(0, 0));
  geos.forEach((g) => g.dispose());
}
const w = world();
const seal = (id: number) => {
  for (let y = 66; y <= 73; y++)
    for (let z = 2; z <= 10; z++)
      for (let x = 2; x <= 10; x++)
        if (y === 66 || y === 73 || x === 2 || x === 10 || z === 2 || z === 10)
          w.setBlock(x, y, z, id);
};
test("unmeshed and unloaded samples fail closed without generation", () => {
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
  const n = w.chunks.size;
  assert.deepEqual(w.sampleLightAt(1000, 70, 1000), { sky: 0, block: 0 });
  assert.equal(w.chunks.size, n);
});
test("samples reuse exact mesher light levels, packed in 32 KiB", () => {
  build(w);
  assert.equal(w.getChunk(0, 0).sampledLight!.data.length, CS * CS * CH);
  assert.equal(w.sampleLightAt(5, 70, 5).sky, 1);
});
test("sealed room has no skylight; placed torch lights its interior", () => {
  seal(B.STONE);
  build(w);
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
  w.setBlock(6, 70, 5, B.TORCH);
  build(w);
  assert.equal(w.sampleLightAt(5, 70, 5).block, lightLevel(13));
});
test("opaque wall prevents placed block light leaking from outside", () => {
  w.setBlock(6, 70, 5, B.AIR);
  w.setBlock(1, 70, 5, B.TORCH);
  build(w);
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
});
test("lateral skylight and torch enter an opened aperture", () => {
  w.setBlock(2, 70, 5, B.AIR);
  build(w);
  const light = w.sampleLightAt(5, 70, 5);
  assert.ok(light.sky > 0);
  assert.ok(light.block > 0);
  w.setBlock(2, 70, 5, B.STONE);
  build(w);
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
});
test("nearby edits invalidate immediately, even before meshing completes", () => {
  w.setBlock(5, 73, 5, B.AIR);
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
  build(w);
  assert.ok(w.sampleLightAt(5, 70, 5).sky > 0);
  w.setBlock(16, 70, 5, B.GLASS);
  assert.deepEqual(w.sampleLightAt(5, 70, 5), { sky: 0, block: 0 });
  build(w);
});
test("distant halo revision queues a repair for the sampled centre", () => {
  build(w);
  w.dirty.clear();
  w.setBlock(31, 80, 6, B.STONE);
  assert.ok(!w.dirty.has("0,0"));
  assert.equal(w.sampleLightAt(5, 80, 5).sky, 0);
  assert.ok(w.dirty.has("0,0"));
  build(w);
  assert.equal(w.sampleLightAt(5, 80, 5).sky, 1);
  for (const stamp of w.getChunk(0, 0).sampledLight!.neighbours)
    assert.ok(
      !("chunk" in stamp),
      "stamp must not retain unloaded chunk graph",
    );
});
test("replacement and unload of halo chunks invalidate cached sky", () => {
  const c = w.getChunk(1, 0);
  w.chunks.set("1,0", new Chunk(1, 0));
  assert.equal(w.sampleLightAt(5, 70, 5).sky, 0);
  w.chunks.set("1,0", c);
  build(w);
  assert.ok(w.sampleLightAt(5, 70, 5).sky > 0);
  w.releaseChunk(1, 0);
  assert.equal(w.sampleLightAt(5, 70, 5).sky, 0);
  w.chunks.set("1,0", c);
  build(w);
});
test("released centre retains no sample through world lookup", () => {
  const c = w.releaseChunk(0, 0)!;
  assert.equal(w.sampleLightAt(5, 70, 5).sky, 0);
  w.chunks.set("0,0", c);
});
test("negative coordinates and chunk seam sample correct cells", () => {
  const g = w.buildMesh(w.getChunk(-1, 0));
  g.forEach((g) => g.dispose());
  assert.equal(w.sampleLightAt(-0.1, 80, 5).sky, 1);
  assert.equal(w.sampleLightAt(0, 80, 5).sky, 1);
  for (const p of [
    [NaN, 70, 0],
    [0, -1, 0],
    [0, CH, 0],
    [Infinity, 70, 0],
  ])
    assert.equal(w.sampleLightAt(...(p as [number, number, number])).sky, 0);
});
test("worker samples exactly match sync in flat, natural, nether and city worlds", () => {
  for (const world of [
    w,
    new World(100),
    new World(100, false, true),
    new World(100, false, false, true),
  ]) {
    const { snapshot } = snapshotMesh(world, 0, 0);
    build(world);
    const reply = meshSnapshot(snapshot, 1),
      expected = world.getChunk(0, 0).sampledLight!.data.slice();
    const received = structuredClone(reply, {
      transfer: replyTransfers(reply),
    });
    assert.equal(reply.sampledLight.byteLength, 0);
    assert.deepEqual(received.sampledLight, expected);
    assert.equal(
      world.getChunk(0, 0).sampledLight!.data.byteLength,
      CS * CS * CH,
    );
  }
});
class Port implements MeshWorker {
  onmessage: MeshWorker["onmessage"] = null;
  onerror: MeshWorker["onerror"] = null;
  onmessageerror: MeshWorker["onmessageerror"] = null;
  message!: {
    id: number;
    snapshot: ReturnType<typeof snapshotMesh>["snapshot"];
  };
  postMessage(message: unknown, transfer: ArrayBuffer[]) {
    this.message = structuredClone(message, {
      transfer,
    }) as typeof this.message;
  }
  terminate() {}
  reply() {
    const r = meshSnapshot(this.message.snapshot, this.message.id);
    this.onmessage?.({
      data: structuredClone(r, { transfer: replyTransfers(r) }),
    } as MessageEvent);
  }
}
test("async publication installs light; stale response cannot relight edited room", () => {
  const world = worldForAsync(),
    port = new Port(),
    q = new AsyncMesher(() => port);
  const publish = (_c: Chunk, geos: THREE.BufferGeometry[]) =>
    geos.forEach((g) => g.dispose());
  q.submit(world, 0, 0, publish);
  port.reply();
  assert.equal(world.sampleLightAt(5, 80, 5).sky, 1);
  q.submit(world, 0, 0, publish);
  world.setBlock(5, 90, 5, B.STONE);
  port.reply();
  assert.equal(world.sampleLightAt(5, 80, 5).sky, 0);
  assert.equal(q.report().discarded, 1);
  q.submit(world, 0, 0, publish);
  port.reply();
  assert.ok(world.getChunk(0, 0).sampledLight);
  q.dispose();
});
function worldForAsync() {
  return world();
}
test("malformed/missing light payload fails worker closed before geometry publication", () => {
  for (const data of [
    undefined,
    new Uint8Array(1),
    new Float32Array(CS * CS * CH),
  ]) {
    const w = world(),
      port = new Port(),
      q = new AsyncMesher(() => port);
    let publications = 0;
    q.submit(w, 0, 0, () => {
      publications++;
    });
    const r = meshSnapshot(port.message.snapshot, port.message.id);
    port.onmessage?.({ data: { ...r, sampledLight: data } } as MessageEvent);
    assert.equal(publications, 0);
    assert.equal(q.available, false);
    assert.equal(w.getChunk(0, 0).sampledLight, undefined);
    q.dispose();
  }
});
const opts = {
  day: { value: 1 },
  brightness: { value: 0 },
  held: { pos: new THREE.Vector3(), strength: 0 },
  field: new HeldLightField(),
  remotes: Array.from({ length: 4 }, () => new THREE.Vector4()),
  sun: { dir: new THREE.Vector3(0, 1, 0), power: 1 },
};
const lighting = new EntityLighting(opts);
function shader(mat: THREE.Material) {
  const lib = (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial
    ? THREE.ShaderLib.lambert
    : THREE.ShaderLib.basic;
  const s = {
    uniforms: {} as Record<string, { value: any }>,
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  };
  mat.onBeforeCompile(s as never, {} as never);
  return s;
}
test("Lambert and Basic shaders use voxel light instead of global light, keep emissive", () => {
  const root = new THREE.Group(),
    a = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshLambertMaterial({ emissive: 0x770000 }),
    ),
    b = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  root.add(a, b);
  lighting.update(w, root, 5, 80, 5);
  const sa = shader(a.material),
    sb = shader(b.material);
  assert.ok(!sa.fragmentShader.includes("#include <lights_fragment_begin>"));
  assert.ok(
    sa.fragmentShader.includes(
      "diffuseColor.rgb * entityLightColor() + totalEmissiveRadiance",
    ),
  );
  assert.ok(
    sb.fragmentShader.includes("diffuseColor.rgb * entityLightColor()"),
  );
  assert.equal(sa.uniforms.uHeldField.value, opts.field.texture);
  assert.equal(a.material.emissive.getHex(), 0x770000);
});
test("entity sample updates without recompilation; per-entity materials stay independent", () => {
  const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const shared = new THREE.MeshLambertMaterial({ map });
  shared.userData.borrowedMap = true;
  const a = new THREE.Group(),
    b = new THREE.Group();
  a.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  b.add(mesh);
  lighting.update(w, a, 5, 80, 5);
  lighting.update(w, b, 1000, 80, 1000);
  assert.notEqual(mesh.material, shared);
  assert.equal(mesh.material.map, map);
  assert.equal(mesh.material.userData.borrowedMap, true);
  const sa = shader(shared),
    sb = shader(mesh.material);
  assert.equal(sa.uniforms.uEntityLight.value.x, 1);
  assert.equal(sb.uniforms.uEntityLight.value.x, 0);
  const version = shared.version;
  lighting.update(w, a, 1000, 80, 1000);
  assert.equal(shared.version, version);
  assert.equal(sa.uniforms.uEntityLight.value.x, 0);
});
test("late held-item replacement and equipment inherit light; sprites stay unchanged", () => {
  const root = new THREE.Group(),
    head = new THREE.Group(),
    body = new THREE.Group(),
    armL = new THREE.Mesh(),
    armR = new THREE.Mesh(),
    legL = new THREE.Mesh(),
    legR = new THREE.Mesh();
  root.add(head, body, armL, armR, legL, legR);
  const sprite = new THREE.Sprite();
  root.add(sprite);
  const oldSprite = sprite.material.onBeforeCompile;
  const armor = new ArmorVisual({ head, body, armL, armR, legL, legR });
  lighting.update(w, root, 5, 80, 5);
  armor.update([I.IRON_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS]);
  const held = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  armR.add(held);
  lighting.update(w, root, 5, 80, 5);
  assert.equal(held.material.userData.voxelEntityLighting, true);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh)
      assert.equal(
        (o as THREE.Mesh).material instanceof Array
          ? true
          : ((o as THREE.Mesh).material as THREE.Material).userData
              .voxelEntityLighting,
        true,
      );
  });
  assert.equal(sprite.material.onBeforeCompile, oldSprite);
  armor.update([I.DIAMOND_HELMET]);
  lighting.update(w, root, 5, 80, 5);
});
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
  "golem",
  "enderman",
  "slime",
  "ghast",
];
for (const type of types)
  test("all model materials and replacement paths: " + type, () => {
    const mob = new Mob(type, 5, 70, 5);
    lighting.update(w, mob.group, 5, 70 + mob.body.h * 0.5, 5);
    if (type === "wolf") mob.tame();
    if (type === "sheep") {
      mob.shear();
      mob.regrowWool();
    }
    lighting.update(w, mob.group, 5, 70, 5);
    let meshes = 0;
    mob.group.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      meshes++;
      for (const m of Array.isArray((o as THREE.Mesh).material)
        ? ((o as THREE.Mesh).material as THREE.Material[])
        : [(o as THREE.Mesh).material as THREE.Material]) {
        assert.equal(m.userData.voxelEntityLighting, true);
        assert.ok(shader(m).fragmentShader.includes("entityLightColor()"));
      }
    });
    assert.ok(meshes > 0);
    mob.setTint(true);
    mob.setFlash(true);
    mob.dispose();
  });
opts.field.dispose();
console.log(`Entity lighting: ${checks} groups PASS`);
