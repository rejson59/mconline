import assert from "node:assert/strict";
import * as THREE from "three";
import { World, Chunk, CH } from "../src/game/world";
import { B } from "../src/game/blocks";
import { HeldLightField, type FieldSource } from "../src/game/heldLightField";
import { patchChunkMaterial } from "../src/game/lighting";
import { Game } from "../src/game/engine";
import { Inventory } from "../src/game/inventory";
let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  console.log("PASS", name);
}
function empty() {
  const w = new World(444, true);
  for (let z = -2; z <= 2; z++)
    for (let x = -2; x <= 2; x++)
      w.chunks.set(World.key(x, z), new Chunk(x, z));
  return w;
}
const s: FieldSource = { x: -2.5, y: 70.5, z: -0.5, strength: 0.72 };
const w = empty(),
  f = new HeldLightField();
const sample = (x: number, y = 70, z = -1) => f.sample(0, s, x, y, z);
check("fixed small atlas, byte budget and nearest filtering", () => {
  assert.equal(f.data.length, 145 * 841);
  assert.equal(f.texture.minFilter, THREE.NearestFilter);
});
check("air propagation and finite range", () => {
  f.update(w, [s]);
  assert.equal(sample(-3), 1);
  assert.ok(sample(-2) > sample(1));
  assert.equal(sample(12), 0);
});
check("no generation and no allocations of chunks", () => {
  assert.equal(w.chunks.size, 25);
});
const wall = (id: number) => {
  for (let y = 56; y <= 84; y++)
    for (let z = -15; z <= 13; z++) w.setBlock(0, y, z, id);
};
check(
  "full opaque wall blocks the other room at negative chunk boundary",
  () => {
    wall(B.STONE);
    f.update(w, [s]);
    assert.equal(sample(1), 0);
    assert.ok(sample(-1) > 0);
  },
);
check("front face receives light on air side; wall cell does not", () => {
  assert.ok(sample(-0.02) > 0);
  assert.equal(sample(0.02), 0);
});
check("edit opens an aperture without moving the source", () => {
  w.setBlock(0, 70, -1, B.AIR);
  assert.equal(f.update(w, [s]), true);
  assert.ok(sample(1) > 0);
});
check("light bends around a corner but loses levels along its path", () => {
  assert.ok(sample(1, 72) > 0);
  assert.ok(sample(1, 72) < sample(1));
});
check("sealing the aperture removes light immediately", () => {
  w.setBlock(0, 70, -1, B.STONE);
  f.update(w, [s]);
  assert.equal(sample(1), 0);
});
check("glass transmits light while opaque stone does not", () => {
  w.setBlock(0, 70, -1, B.GLASS);
  f.update(w, [s]);
  assert.ok(sample(1) > 0);
});
check("water attenuates more than air", () => {
  w.setBlock(0, 70, -1, B.AIR);
  f.update(w, [s]);
  const air = sample(1);
  w.setBlock(0, 70, -1, B.WATER);
  f.update(w, [s]);
  assert.ok(sample(1) < air && sample(1) > 0);
});
check("stationary sources and flicker never rebuild volumes", () => {
  const n = f.builds;
  for (let i = 0; i < 100; i++)
    f.update(w, [{ ...s, strength: i / 500 + 0.5 }]);
  assert.equal(f.builds, n);
});
check("movement within a cell reuses field; crossing cell rebuilds", () => {
  const n = f.builds;
  f.update(w, [{ ...s, x: -2.1 }]);
  assert.equal(f.builds, n);
  f.update(w, [{ ...s, x: -1.9 }]);
  assert.equal(f.builds, n + 1);
  f.update(w, [s]);
});
check("unload fails closed without generating replacement chunks", () => {
  const key = World.key(-1, -1);
  w.chunks.delete(key);
  f.update(w, [s]);
  assert.equal(sample(-3), 0);
  assert.equal(w.chunks.size, 24);
  w.chunks.set(key, new Chunk(-1, -1));
  f.update(w, [s]);
  assert.equal(sample(-3), 1);
});
check("replacement chunk with same revision invalidates cache", () => {
  const key = World.key(-1, -1),
    previous = w.chunks.get(key)!;
  const replacement = new Chunk(-1, -1);
  replacement.data.fill(B.STONE);
  replacement.revision = previous.revision;
  w.chunks.set(key, replacement);
  f.update(w, [s]);
  assert.equal(sample(-3), 0);
  w.chunks.set(key, previous);
  f.update(w, [s]);
  assert.equal(sample(-3), 1);
});
check(
  "all five slots are independent and source reorder leaves no ghost",
  () => {
    wall(B.STONE);
    const right = { ...s, x: 2.5 };
    f.update(w, [s, right, s, right, s]);
    assert.equal(f.sample(1, right, -1, 70, -1), 0);
    assert.ok(f.sample(1, right, 1, 70, -1) > 0);
    f.update(w, [right]);
    assert.ok(f.sample(0, right, 1, 70, -1) > 0);
    assert.equal(f.sample(1, right, 1, 70, -1), 0);
  },
);
check(
  "inactive or invalid source clears texture including stale remote slots",
  () => {
    for (const x of [
      NaN,
      Infinity,
      -Infinity,
      1e100,
      Number.MAX_SAFE_INTEGER,
    ]) {
      f.update(w, [s]);
      f.update(w, [{ ...s, x }]);
      assert.ok(f.data.every((v) => v === 0));
    }
    f.update(w, [s]);
    f.update(w, [{ ...s, strength: NaN }]);
    assert.ok(f.data.every((v) => v === 0));
    f.update(w, [s]);
    f.update(w, [{ ...s, strength: 0 }]);
    assert.ok(f.data.every((v) => v === 0));
  },
);
check("out-of-height sources fail closed", () => {
  f.update(w, [{ ...s, y: CH + 1 }]);
  assert.ok(f.data.every((v) => v === 0));
});
check("unrelated distant edits do not invalidate local fields", () => {
  f.update(w, [s]);
  const n = f.builds;
  w.setBlock(32, 70, 32, B.STONE);
  f.update(w, [s]);
  assert.equal(f.builds, n);
});
check(
  "terrain, cutouts and water compile with shared atlas and air-side lookup",
  () => {
    for (const opts of [{}, { water: true }, { fire: true }]) {
      const mat = new THREE.MeshBasicMaterial();
      patchChunkMaterial(mat, { value: 0 }, { ...opts, heldField: f.texture });
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader: "#include <common>\n#include <color_fragment>",
      };
      mat.onBeforeCompile(shader as never, {} as never);
      assert.equal(shader.uniforms.uHeldField.value, f.texture);
      assert.ok(shader.fragmentShader.includes("faceNormal(vFace) * 0.02"));
      assert.ok(shader.fragmentShader.includes("float(i + 1)"));
      assert.ok(mat.customProgramCacheKey().startsWith("voxel-held-"));
      mat.dispose();
    }
  },
);
check(
  "actual engine held/offhand and remote selection update the volume",
  () => {
    const g = Object.assign(Object.create(Game.prototype), {
      inventory: new Inventory(),
      selected: 0,
      selectedStack: () => ({ id: B.TORCH, count: 1 }),
      world: w,
      camera: { position: new THREE.Vector3(s.x, s.y, s.z) },
      heldLight: { pos: new THREE.Vector3(), strength: 0 },
      heldField: f,
      materials: [],
      remoteLights: Array.from({ length: 4 }, () => new THREE.Vector4()),
      remotes: new Map(),
    });
    g.updateHeldLight();
    assert.ok(f.sample(0, s, -3, 70, -1) > 0);
    g.selectedStack = () => null;
    g.updateHeldLight();
    assert.ok(f.data.every((v) => v === 0));
    g.inventory.offhand = { id: B.TORCH, count: 1 };
    g.updateHeldLight();
    assert.ok(f.sample(0, s, -3, 70, -1) > 0);
    const group = new THREE.Group();
    group.position.set(2.5, 69, -0.5);
    g.remotes.set("peer", {
      group,
      held: B.TORCH,
      offhand: 0,
      seen: performance.now(),
    });
    g.updateHeldLight();
    assert.ok(f.sample(1, { ...s, x: 2.5, y: 70.45 }, 2, 70, -1) > 0);
    g.remotes.clear();
    g.updateHeldLight();
    assert.equal(f.sample(1, { ...s, x: 2.5 }, 2, 70, -1), 0);
  },
);
check("bounded five-source cold build and stationary cache benchmark", () => {
  const start = performance.now();
  const field = new HeldLightField(),
    world = empty();
  const sources = Array.from({ length: 5 }, (_, i) => ({ ...s, x: i - 3.5 }));
  field.update(world, sources);
  const coldMs = performance.now() - start,
    cached = performance.now();
  for (let i = 0; i < 1000; i++) field.update(world, sources);
  console.log(
    JSON.stringify({
      coldMs,
      cached1000Ms: performance.now() - cached,
      builds: field.builds,
      atlasBytes: field.data.byteLength,
    }),
  );
  assert.equal(field.builds, 5);
  field.dispose();
});
f.dispose();
console.log(`Held lighting: ${checks} groups PASS`);
