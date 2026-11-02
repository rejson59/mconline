import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game/engine";
import { World } from "../src/game/world";
import { B } from "../src/game/blocks";
import { AsyncMesher, type MeshWorker } from "../src/game/asyncMesher";
import {
  currentMesh,
  snapshotMesh,
  snapshotTransfers,
  meshSnapshot,
  replyTransfers,
  unpackGeometry,
  type MeshSnapshot,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";

let checks = 0;
function check(name: string, condition: unknown) {
  assert.ok(condition, name);
  checks++;
}
function equal(name: string, a: unknown, b: unknown) {
  assert.deepStrictEqual(a, b, name);
  checks++;
}
class Port implements MeshWorker {
  onmessage: MeshWorker["onmessage"] = null;
  onerror: MeshWorker["onerror"] = null;
  onmessageerror: MeshWorker["onmessageerror"] = null;
  message!: { id: number; snapshot: MeshSnapshot };
  terminated = false;
  postMessage(message: unknown, transfer: ArrayBuffer[]) {
    this.message = structuredClone(message, {
      transfer,
    }) as typeof this.message;
  }
  terminate() {
    this.terminated = true;
  }
  reply() {
    const reply = meshSnapshot(this.message.snapshot, this.message.id);
    this.onmessage?.({
      data: structuredClone(reply, { transfer: replyTransfers(reply) }),
    } as MessageEvent);
  }
}

for (const [name, world] of [
  ["terrain", new World(12345)],
  ["nether", new World(12345, false, true)],
  ["flat", new World(12345, true)],
  ["models", new World(9876, true)],
  ["city", new World(20261101, false, false, true)],
] as const) {
  if (name === "models")
    for (const [i, id] of [
      B.TORCH,
      B.WATER,
      B.LAVA,
      B.CHEST,
      B.GLASS_PANE,
      B.RAIL,
      B.OAK_SLAB,
      B.OAK_STAIRS_N,
      B.LEAVES,
    ].entries())
      world.setBlock(i + 2, 65, 6, id);
  const { stamp, snapshot } = snapshotMesh(world, 0, 0);
  const c = world.getChunk(0, 0);
  const original = c.data.slice();
  const expected = world.buildMesh(c);
  const copy = structuredClone(snapshot, {
    transfer: snapshotTransfers(snapshot),
  });
  check(
    "snapshot copies are transferred, not retained " + name,
    snapshot.chunks.every((c) => c.data.byteLength === 0),
  );
  equal(
    "live collision/save data is not detached or changed " + name,
    c.data,
    original,
  );
  const result = meshSnapshot(copy, 5);
  const transferred = structuredClone(result, {
    transfer: replyTransfers(result),
  });
  const actual = transferred.geometries.map(unpackGeometry);
  equal(
    "worker geometry is exactly synchronous geometry " + name,
    meshFingerprint(actual),
    meshFingerprint(expected),
  );
  check("valid snapshot survives transport " + name, currentMesh(stamp));
  for (let i = 0; i < expected.length; i++)
    if (expected[i].getAttribute("position")) {
      expected[i].computeBoundingSphere();
      equal(
        "worker prepares exact frustum bounds " + name + "/" + i,
        actual[i].boundingSphere,
        expected[i].boundingSphere,
      );
    }
  for (const g of [...actual, ...expected]) g.dispose();
}
{
  // Double chest crossing a chunk seam, animated lid, torch light.
  const w = new World(420, true);
  w.setBlock(15, 65, 6, B.CHEST);
  w.setBlock(16, 65, 6, B.CHEST);
  w.setBlock(15, 66, 5, B.TORCH);
  w.hiddenChestLids.add("15,65,6");
  const { snapshot, stamp } = snapshotMesh(w, 0, 0);
  const expected = w.buildMesh(w.getChunk(0, 0));
  const reply = meshSnapshot(snapshot, 1),
    actual = reply.geometries.map(unpackGeometry);
  equal(
    "paired chest and hidden lid preserve geometry",
    meshFingerprint(actual),
    meshFingerprint(expected),
  );
  equal(
    "chest lighting returned for animated lids",
    reply.lights,
    w.chunkChestLights(0, 0),
  );
  check(
    "chest light is finite",
    reply.lights.every(
      ([, v]) => Number.isFinite(v.sky) && Number.isFinite(v.blk),
    ),
  );
  w.hiddenChestLids.clear();
  check(
    "lid changes without a block revision invalidate reply",
    !currentMesh(stamp),
  );
  for (const g of [...actual, ...expected]) g.dispose();
  const next = snapshotMesh(w, 0, 0);
  w.setBlock(16, 70, 3, B.GLOWSTONE);
  check("neighbour light changes invalidate reply", !currentMesh(next.stamp));
  const last = snapshotMesh(w, 0, 0);
  w.releaseChunk(0, 0);
  w.getChunk(0, 0);
  check(
    "unloaded and recreated chunk cannot receive old geometry",
    !currentMesh(last.stamp),
  );
}
{
  const w = new World(420, true),
    ports: Port[] = [];
  const queue = new AsyncMesher(() => {
    const p = new Port();
    ports.push(p);
    return p;
  });
  let publications = 0;
  const publish = (_c: unknown, geometries: THREE.BufferGeometry[]) => {
    publications++;
    for (const g of geometries) g.dispose();
  };
  check("first job accepted", queue.submit(w, 0, 0, publish));
  check("one job is busy", queue.busy);
  check("second job cannot grow a queue", !queue.submit(w, 1, 0, publish));
  equal("only one worker created", ports.length, 1);
  ports[0].reply();
  equal("fresh result publishes once", publications, 1);
  check("worker is ready again", !queue.busy);
  equal("completion diagnostics", queue.report().completed, 1);
  for (let i = 0; i < 3; i++) {
    check("new edit job accepted " + i, queue.submit(w, 0, 0, publish));
    w.setBlock(3, 70, 3, i % 2 ? B.GLASS : B.STONE);
    ports[0].reply();
    equal("stale result never publishes " + i, publications, 1);
    check("stale edit is not lost " + i, w.dirty.has("0,0"));
  }
  equal("discard diagnostics", queue.report().discarded, 3);
  check(
    "constant editing gets one synchronous repair instead of starvation",
    !queue.submit(w, 0, 0, publish) && queue.available && !queue.busy,
  );
  check("async works again after repair", queue.submit(w, 0, 0, publish));
  const oldCallback = ports[0].onmessage;
  queue.cancel();
  check("cancel terminates worker", ports[0].terminated);
  check(
    "dimension cancellation preserves pending dirty work",
    w.dirty.has("0,0"),
  );
  const other = new World(420, false, true);
  queue.submit(other, 0, 0, publish);
  oldCallback?.({
    data: { id: ports[0].message.id, error: true },
  } as MessageEvent);
  check(
    "late old-dimension response cannot kill new job",
    queue.available && queue.busy,
  );
  ports[1].reply();
  equal("new dimension result publishes", publications, 2);
  queue.submit(other, 0, 0, publish);
  queue.dispose();
  check(
    "dispose releases worker and timer",
    ports[1].terminated && !queue.busy,
  );
  check(
    "disposed game never starts another worker",
    !queue.submit(w, 0, 0, publish),
  );
}
{
  const w = new World(420, true),
    port = new Port(),
    queue = new AsyncMesher(() => port);
  const g = Object.assign(Object.create(Game.prototype), {
    world: w,
    meshWorker: queue,
    scene: new THREE.Scene(),
    materials: [0, 1, 2].map(() => new THREE.MeshBasicMaterial()),
    body: { pos: new THREE.Vector3(1, 65, 1) },
    fps: 60,
    fpsCap: 60,
    loadingProgress: 0,
    governor: { profile: { chunkScale: 1 } },
    gfx: { chunkBudgetMs: 12, chunksPerFrame: 3 },
    drawDistance: 2,
    renderDistance: 2,
    unloadTimer: 2,
    chunkOrder: [],
    offsets: [[1, 0]],
    refreshChunkOrder() {},
    meshRetry: new Map(),
  }) as any;
  g.buildChunk(0, 0);
  g.updateChunks(0.016);
  check(
    "engine does not mark queued work as built",
    !w.getChunk(1, 0).built && g.loadingProgress === 0 && queue.busy,
  );
  port.reply();
  g.updateChunks(0.016);
  check(
    "engine progresses only after a valid result",
    w.getChunk(1, 0).built && g.loadingProgress === 1,
  );
  const old = w.getChunk(0, 0).meshes;
  let disposed = 0;
  old[0].geometry.addEventListener("dispose", () => disposed++);
  w.setBlock(4, 64, 4, B.STONE);
  g.updateChunks(0.016);
  equal("in-flight edit retains the old floor", w.getChunk(0, 0).meshes, old);
  w.setBlock(4, 65, 4, B.GLASS);
  port.reply();
  check(
    "stale reply never disposes the old floor",
    disposed === 0 && w.getChunk(0, 0).meshes === old,
  );
  g.updateChunks(0.016);
  port.reply();
  check(
    "accepted replacement disposes the previous mesh once",
    disposed === 1 && w.getChunk(0, 0).meshes !== old,
  );
  check("collision data remains solid while asynchronous", w.isSolid(4, 64, 4));
  // A distant in-flight job cannot delay the first visible floor after teleport.
  queue.submit(w, 0, 0, () => {
    throw Error("cancelled background publish");
  });
  g.body.pos.x = 321;
  g.updateChunks(0.016);
  check(
    "teleport cancels background meshing for a missing floor",
    port.terminated,
  );
  check(
    "floor under the player is built synchronously before streaming",
    w.getChunk(20, 0).built,
  );
  g.body.pos.x = 1;
  queue.dispose();
  const before = w.getChunk(0, 0).meshes,
    add = g.scene.add;
  g.scene.add = () => {
    throw Error("publish failed");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    check("failed publication reports failure", !g.buildChunk(0, 0));
  } finally {
    console.warn = warn;
    g.scene.add = add;
  }
  check(
    "failed publication preserves old mesh and schedules retry",
    w.getChunk(0, 0).meshes === before &&
      w.dirty.has("0,0") &&
      g.meshRetry.has("0,0"),
  );
  for (const c of w.chunks.values())
    for (const m of c.meshes) m.geometry.dispose();
  for (const m of g.materials) m.dispose();
}
for (const error of [
  "constructor",
  "post",
  "worker",
  "decode",
  "message",
  "timeout",
]) {
  const w = new World(421, true),
    port = new Port();
  const queue = new AsyncMesher(() => {
    if (error === "constructor") throw Error("CSP");
    if (error === "post")
      port.postMessage = () => {
        throw Error("transfer failed");
      };
    return port;
  }, 5);
  let published = false;
  queue.submit(w, 0, 0, () => {
    published = true;
  });
  if (error === "worker") port.onerror?.({ preventDefault() {} } as ErrorEvent);
  if (error === "decode")
    port.onmessage?.({
      data: { id: port.message.id, geometries: [], ms: 1 },
    } as MessageEvent);
  if (error === "message") port.onmessageerror?.({} as MessageEvent);
  if (error === "timeout")
    await new Promise((resolve) => setTimeout(resolve, 20));
  check(
    "safe fallback, no partial publish: " + error,
    !queue.available && !queue.busy && !published,
  );
  if (error !== "constructor")
    check("failed work requeued: " + error, w.dirty.has("0,0"));
  queue.dispose();
}
console.log(`${checks} meshing worker checks passed`);
