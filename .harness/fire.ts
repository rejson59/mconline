import assert from "node:assert/strict";
import * as THREE from "three";
import {
  B,
  T,
  BLOCKS,
  CREATIVE_BLOCKS,
  EMIT,
  IS_SOLID,
  RENDER,
  collisionBoxes,
} from "../src/game/blocks";
import { FireSimulation, lightFire, FIRE_LIFETIME } from "../src/game/fire";
import { tryLightPortalAt } from "../src/game/redstone";
import { World, Chunk } from "../src/game/world";
import { Game } from "../src/game/engine";
import {
  I,
  ITEMS,
  blockDrops,
  miningDurabilityCost,
  fuelSeconds,
} from "../src/game/items";
import { Inventory } from "../src/game/inventory";
import { patchChunkMaterial } from "../src/game/lighting";
import { applyJavaFireTextures } from "../src/game/packArt";
import {
  JAVA_FIRE_ANIMATIONS,
  JAVA_FIRE_TEXTURES,
} from "../src/game/art/javaFire.generated";
import { decodePng } from "../src/game/art/miniPng";
import {
  meshSnapshot,
  snapshotMesh,
  unpackGeometry,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";
let checks = 0;
function eq(name: string, a: unknown, b: unknown) {
  assert.deepStrictEqual(a, b, name);
  checks++;
}
function ok(name: string, value: unknown) {
  assert.ok(value, name);
  checks++;
}
class Grid {
  data = new Map<string, number>();
  writes: number[][] = [];
  canEdit = (x: number, _z: number) => x < 1000;
  allowFluid = (_x: number, _z: number, _nx: number, _nz: number) => true;
  hasChunk = (_cx: number, _cz: number) => true;
  isNether = false;
  peekBlock(x: number, y: number, z: number) {
    return this.data.get(`${x},${y},${z}`) ?? B.AIR;
  }
  getBlock(x: number, y: number, z: number) {
    return this.peekBlock(x, y, z);
  }
  setBlock(x: number, y: number, z: number, id: number) {
    if (!this.canEdit(x, z)) return;
    this.data.set(`${x},${y},${z}`, id);
    this.writes.push([x, y, z, id]);
  }
}
function frame(
  w: Grid,
  width = 2,
  height = 3,
  axis = "x",
  id: number = B.OBSIDIAN,
  ox = 0,
  oy = 10,
  oz = 0,
) {
  const at = (i: number, j: number, b: number) =>
    w.setBlock(
      ox + (axis === "x" ? i : 0),
      oy + j,
      oz + (axis === "z" ? i : 0),
      b,
    );
  for (let i = 0; i < width; i++) {
    at(i, -1, id);
    at(i, height, id);
  }
  for (let j = 0; j < height; j++) {
    at(-1, j, id);
    at(width, j, id);
  }
  w.writes = [];
}
// Real Game methods, no mocked tool result/durability/permissions. No WebGL renderer is needed.
function game(w: World | Grid, mode = "survival") {
  const g: any = Object.create(Game.prototype);
  Object.assign(g, {
    world: w,
    mode,
    ui: "playing",
    net: null,
    isInNether: false,
    inventory: new Inventory(),
    selected: 0,
    usingOffhand: false,
    keys: new Set(),
    messages: [] as string[],
    unlocks: [] as string[],
    swingT: 1,
    scene: new THREE.Scene(),
    tnts: [],
    tntGeo: new THREE.BoxGeometry(),
    atlasTex: null,
    body: { pos: new THREE.Vector3(4.5, 65, 4.5), w: 0.6, h: 1.8 },
    findMobTarget: () => ({ mob: null, dist: Infinity }),
    emitHud() {},
    updateHand() {},
    message(t: string) {
      this.messages.push(t);
    },
    unlock(t: string) {
      this.unlocks.push(t);
    },
  });
  g.inventory.slots[0] = { id: I.FLINT_STEEL, count: 1 };
  g.target = { x: 4, y: 64, z: 4, nx: 0, ny: 1, nz: 0, id: B.STONE, dist: 2 };
  g.raycastTarget = () => g.target;
  return g;
}
function floor(w: Grid, x = 4, y = 64, z = 4, id: number = B.STONE) {
  w.setBlock(x, y, z, id);
}
for (const support of [
  B.STONE,
  B.GLASS,
  B.NETHERRACK,
  B.SOUL_SAND,
  B.SOUL_SOIL,
  B.OAK_SLAB_TOP,
]) {
  const w = new Grid();
  floor(w, 4, 64, 4, support);
  ok("solid top supports fire " + support, lightFire(w, 4, 65, 4));
  eq(
    "correct flame variant " + support,
    w.peekBlock(4, 65, 4),
    support === B.SOUL_SAND || support === B.SOUL_SOIL ? B.SOUL_FIRE : B.FIRE,
  );
  eq("already burning is not successful", lightFire(w, 4, 65, 4), false);
}
for (const support of [
  B.AIR,
  B.WATER,
  B.LAVA,
  B.OAK_SLAB,
  B.CAMPFIRE,
  B.GLASS_PANE,
  B.TORCH,
]) {
  const w = new Grid();
  floor(w, 4, 64, 4, support);
  eq(
    "partial/absent support rejected " + support,
    lightFire(w, 4, 65, 4),
    false,
  );
}
{
  const w = new Grid();
  floor(w);
  w.setBlock(4, 65, 4, B.STONE);
  eq("occupied cell rejected", lightFire(w, 4, 65, 4), false);
  for (const y of [-1, 0, 128, NaN, Infinity, 1.5])
    eq("invalid height " + y, lightFire(w, 4, y, 4), false);
  w.canEdit = () => false;
  eq("permission blocks placement", lightFire(w, 4, 65, 4), false);
  const v = new Grid();
  floor(v);
  v.hasChunk = () => false;
  eq("no generation at unloaded cell", lightFire(v, 4, 65, 4), false);
  const q = new Grid();
  floor(q);
  q.setBlock = () => {};
  eq("refused world write is not success", lightFire(q, 4, 65, 4), false);
}
for (const [width, height] of [
  [2, 3],
  [3, 5],
  [21, 21],
])
  for (const axis of ["x", "z"]) {
    const w = new Grid();
    frame(w, width, height, axis);
    w.setBlock(
      axis === "x" ? width - 1 : 0,
      10 + height - 1,
      axis === "z" ? width - 1 : 0,
      B.FIRE,
    );
    w.writes = [];
    ok(
      `cornerless ${width}x${height} ${axis}`,
      tryLightPortalAt(
        w,
        axis === "x" ? width - 1 : 0,
        10 + height - 1,
        axis === "z" ? width - 1 : 0,
      ),
    );
    eq("entire interior filled", w.writes.length, width * height);
    ok(
      "portal only",
      w.writes.every((e) => e[3] === B.NETHER_PORTAL),
    );
    w.writes = [];
    eq("already active costs no use", tryLightPortalAt(w, 0, 10, 0), false);
    eq("already active no writes", w.writes.length, 0);
  }
for (const [width, height, id] of [
  [1, 3, B.OBSIDIAN],
  [2, 2, B.OBSIDIAN],
  [22, 3, B.OBSIDIAN],
  [2, 22, B.OBSIDIAN],
  [2, 3, B.CRYING_OBSIDIAN],
]) {
  const w = new Grid();
  frame(w, width, height, "x", id);
  eq(
    "invalid portal " + [width, height, id],
    tryLightPortalAt(w, 0, 10, 0),
    false,
  );
  eq("invalid writes none", w.writes.length, 0);
}
{
  const w = new Grid();
  frame(w);
  w.setBlock(0, 11, 0, B.STONE);
  w.writes = [];
  eq("blocked interior", tryLightPortalAt(w, 1, 10, 0), false);
  eq("no partial portal", w.writes.length, 0);
  const v = new Grid();
  frame(v, 3);
  eq(
    "protected remote interior preflight",
    tryLightPortalAt(v, 0, 10, 0, (x) => x < 2),
    false,
  );
  eq("permission preflight has zero edits", v.writes.length, 0);
  v.canEdit = (x) => x < 2;
  eq("world permission also checked", tryLightPortalAt(v, 0, 10, 0), false);
  eq("world refusal has zero edits", v.writes.length, 0);
  const q = new Grid();
  frame(q);
  eq("outside of frame never activates", tryLightPortalAt(q, 0, 10, 1), false);
}
{
  const w = new Grid();
  floor(w);
  const g = game(w);
  g.tryUse();
  eq("actual main-hand use creates fire", w.peekBlock(4, 65, 4), B.FIRE);
  eq("one durability point", g.inventory.slots[0].dur, 63);
  g.tryUse();
  eq("failed second use costs nothing", g.inventory.slots[0].dur, 63);
  eq("hand extinguishes actual fire", g.breakBlock(4, 65, 4), true);
  eq("no wear on extinguish", g.inventory.slots[0].dur, 63);
  g.inventory.slots[0].dur = 1;
  g.tryUse();
  eq("last use still lights", w.peekBlock(4, 65, 4), B.FIRE);
  eq("last durability breaks tool", g.inventory.slots[0], null);
}
{
  const w = new Grid();
  floor(w);
  const g = game(w);
  g.inventory.slots[0] = { id: I.IRON_SWORD, count: 1, dur: 200 };
  g.inventory.offhand = { id: I.FLINT_STEEL, count: 1 };
  g.tryUse();
  eq("offhand ignites", w.peekBlock(4, 65, 4), B.FIRE);
  eq("only offhand wears", g.inventory.offhand.dur, 63);
  eq("main sword intact", g.inventory.slots[0].dur, 200);
  eq("offhand flag restored", g.usingOffhand, false);
  const v = new Grid();
  floor(v);
  const c = game(v, "creative");
  c.tryUse();
  eq("creative lights", v.peekBlock(4, 65, 4), B.FIRE);
  eq(
    "creative does not initialize or consume durability",
    c.inventory.slots[0].dur,
    undefined,
  );
}
{
  const w = new Grid();
  floor(w);
  const g = game(w);
  g.net = { public: true, canEdit: () => false };
  g.tryUse();
  eq("protected ground no ignition", w.peekBlock(4, 65, 4), B.AIR);
  eq("no wear on protected use", g.inventory.slots[0].dur, undefined);
  g.net.canEdit = (x: number) => x < 5;
  g.target.nx = 1;
  g.target.ny = 0;
  g.tryUse();
  eq("protected adjacent street not ignited", w.peekBlock(5, 64, 4), B.AIR);
  g.target = { ...g.target, x: 4, y: 64, z: 4, id: B.CAMPFIRE_OFF };
  w.setBlock(4, 64, 4, B.CAMPFIRE_OFF);
  g.tryUse();
  eq(
    "own in-place campfire works next to protected street",
    w.peekBlock(4, 64, 4),
    B.CAMPFIRE,
  );
  eq("successful campfire wear", g.inventory.slots[0].dur, 63);
  g.inventory.slots[0] = { id: I.IRON_SHOVEL, count: 1 };
  g.target.id = B.CAMPFIRE;
  g.tryUse();
  eq("shovel extinguishes", w.peekBlock(4, 64, 4), B.CAMPFIRE_OFF);
  eq(
    "shovel wears one point",
    g.inventory.slots[0].dur,
    ITEMS[I.IRON_SHOVEL]!.durability! - 1,
  );
}
{
  const w = new Grid();
  frame(w);
  const g = game(w);
  g.target = { x: 0, y: 9, z: 0, nx: 0, ny: 1, nz: 0, id: B.OBSIDIAN, dist: 2 };
  g.tryUse();
  eq(
    "actual tool fills cornerless frame",
    w.peekBlock(1, 12, 0),
    B.NETHER_PORTAL,
  );
  eq("one wear for entire portal", g.inventory.slots[0].dur, 63);
  ok("portal achievement", g.unlocks.includes("portal"));
}
{
  const w = new Grid();
  floor(w, 4, 64, 4, B.TNT);
  const g = game(w);
  g.target.id = B.TNT;
  g.tryUse();
  eq("TNT consumed once", w.peekBlock(4, 64, 4), B.AIR);
  eq("one primed TNT", g.tnts.length, 1);
  eq("four-second fuse", g.tnts[0].fuse, 4);
  eq("player owner attribution", g.tnts[0].owner, "player");
  eq("TNT wears once", g.inventory.slots[0].dur, 63);
  eq("stale TNT cannot duplicate entities", g.igniteTNT(4, 64, 4, 4), false);
  floor(w, 4, 64, 4, B.TNT);
  g.net = { city: true };
  g.tryUse();
  eq("city TNT stays intact", w.peekBlock(4, 64, 4), B.TNT);
  eq("city TNT no extra entity", g.tnts.length, 1);
  eq("city TNT no tool wear", g.inventory.slots[0].dur, 63);
  ok(
    "city explains intentional restriction",
    g.messages.at(-1).includes("TNT"),
  );
}
{
  const w = new World(421, true);
  w.getChunk(0, 0);
  w.setBlock(4, 64, 4, B.STONE);
  const g = game(w);
  g.tryUse();
  eq("world registers fire", w.fire.size, 1);
  const edits: number[][] = [];
  w.onEdit = (...e) => edits.push(e);
  for (let n = 0; n < FIRE_LIFETIME + 1; n++) w.fire.tick(1);
  eq("ordinary fire expires", w.peekBlock(4, 65, 4), B.AIR);
  eq("expiry uses notified world edit", edits.at(-1), [4, 65, 4, B.AIR]);
  eq("expired queue drained", w.fire.size, 0);
  w.setBlock(4, 64, 4, B.NETHERRACK);
  lightFire(w, 4, 65, 4);
  for (let n = 0; n < 35; n++) w.fire.tick(1);
  eq("netherrack persists", w.peekBlock(4, 65, 4), B.FIRE);
  w.canEdit = () => false;
  w.seedMods([{ x: 4, y: 64, z: 4, id: B.AIR }]);
  w.fire.tick(1);
  eq(
    "simulation cannot edit newly protected cells",
    w.peekBlock(4, 65, 4),
    B.FIRE,
  );
  w.canEdit = () => true;
  w.fire.tick(1);
  eq(
    "unsupported fire extinguishes once editable",
    w.peekBlock(4, 65, 4),
    B.AIR,
  );
  w.setBlock(4, 64, 4, B.SOUL_SOIL);
  lightFire(w, 4, 65, 4);
  const saved = w.serializeMods();
  w.releaseChunk(0, 0);
  eq("chunk release removes timer entries", w.fire.size, 0);
  w.getChunk(0, 0);
  eq("chunk reload re-registers", w.fire.size, 1);
  const r = new World(421, true);
  r.loadMods(saved);
  r.getChunk(0, 0);
  eq("saved soul fire restores", r.peekBlock(4, 65, 4), B.SOUL_FIRE);
  eq("restored timer registered", r.fire.size, 1);
  r.seedMods([{ x: 4, y: 65, z: 4, id: B.AIR }]);
  eq("remote extinguish removes timer", r.fire.size, 0);
  r.seedMods([{ x: 4, y: 65, z: 4, id: B.SOUL_FIRE }]);
  eq("remote ignition registers timer", r.fire.size, 1);
  const count = r.chunks.size;
  r.fire.tick(1);
  eq("simulation never generates neighbors", r.chunks.size, count);
}
{
  const w = new Grid(),
    sim = new FireSimulation(w);
  for (let x = 0; x < 100; x++) {
    floor(w, x, 64, 4);
    w.setBlock(x, 65, 4, B.FIRE);
    sim.changed(x, 65, 4);
  }
  ok("simulation tick has hard work budget", sim.tick(0.25, 3) <= 3);
  eq("invalid tick ignored", sim.tick(NaN), 0);
  const g = game(w);
  g.body.pos.set(0.9, 65, 4.5);
  let hurt = 0;
  g.damage = (n: number) => (hurt += n);
  g.updateFireContact(0.5, false);
  eq("body-volume flame contact", hurt, 1);
  g.updateFireContact(1, true);
  eq("fire resistance prevents contact", hurt, 1);
  g.mode = "creative";
  g.updateFireContact(1, false);
  eq("creative immune", hurt, 1);
  g.mode = "survival";
  w.setBlock(0, 65, 4, B.SOUL_FIRE);
  g.body.pos.x = 0.5;
  g.updateFireContact(0.5, false);
  eq("soul fire double contact", hurt, 3);
}
{
  const w = new World(421, true);
  w.getChunk(0, 0);
  w.setBlock(4, 64, 4, B.NETHERRACK);
  lightFire(w, 4, 65, 4);
  w.setBlock(4, 66, 4, B.WATER);
  for (let n = 0; n < 4; n++) w.water.tick(0.2);
  ok(
    "falling water replaces flame with fluid",
    w.peekBlock(4, 65, 4) !== B.FIRE,
  );
  eq("water removes fire timer", w.fire.size, 0);
  const v = new World(421, true);
  v.getChunk(0, 0);
  v.setBlock(4, 64, 4, B.STONE);
  lightFire(v, 4, 65, 4);
  v.setBlock(5, 65, 4, B.WATER);
  v.allowFluid = () => false;
  v.water.tick(0.2);
  v.fire.tick(0.25);
  eq("protected fluid seam cannot erase flame", v.peekBlock(4, 65, 4), B.FIRE);
}
{
  const w = new Grid();
  floor(w);
  lightFire(w, 4, 65, 4);
  const g = game(w);
  g.inventory.slots[0] = { id: I.WATER_BUCKET, count: 1 };
  g.target = { x: 4, y: 65, z: 4, nx: 0, ny: 1, nz: 0, id: B.FIRE, dist: 2 };
  g.tryUse();
  eq(
    "bucket replaces targeted fire, not air above it",
    w.peekBlock(4, 65, 4),
    B.WATER,
  );
  eq("normal empty-bucket exchange", g.inventory.slots[0].id, I.BUCKET);
}
for (const id of [B.FIRE, B.SOUL_FIRE]) {
  eq("non-solid fire " + id, IS_SOLID[id], 0);
  eq("no fire collision " + id, collisionBoxes(id), null);
  eq("dedicated fire model " + id, RENDER[id], 17);
  eq("no fire creative item " + id, CREATIVE_BLOCKS.includes(id), false);
  eq("no drops " + id, blockDrops(id, I.DIAMOND_PICK, { silk: true }), []);
  eq(
    "extinguishing does not wear tools " + id,
    miningDurabilityCost(id, I.DIAMOND_SWORD),
    0,
  );
}
eq("normal emission", EMIT[B.FIRE], 15);
eq("soul emission", EMIT[B.SOUL_FIRE], 10);
eq("unlit emission", EMIT[B.CAMPFIRE_OFF], 0);
eq(
  "unlit collision matches lit",
  collisionBoxes(B.CAMPFIRE_OFF),
  collisionBoxes(B.CAMPFIRE),
);
eq(
  "unlit canonical drop",
  blockDrops(B.CAMPFIRE_OFF, I.DIAMOND_AXE, { silk: true }),
  [{ id: B.CAMPFIRE, count: 1 }],
);
eq(
  "campfire fuel unchanged",
  fuelSeconds(B.CAMPFIRE_OFF),
  fuelSeconds(B.CAMPFIRE),
);
ok(
  "all new IDs fit SQL/lookup limit",
  [B.FIRE, B.SOUL_FIRE, B.CAMPFIRE_OFF].every((id) => id < 512 && !!BLOCKS[id]),
);
{
  const img = {
    width: 256,
    height: 256,
    data: new Uint8ClampedArray(256 * 256 * 4).fill(173),
  } as ImageData;
  applyJavaFireTextures(img, T);
  const reserved = new Set([
    T.campfire_off,
    188,
    189,
    190,
    191,
    ...Array.from({ length: 12 }, (_, i) => 240 + i),
  ]);
  for (let tile = 0; tile < 256; tile++)
    if (!reserved.has(tile)) {
      let same = true;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++)
          for (let c = 0; c < 4; c++)
            if (
              img.data[
                ((Math.floor(tile / 16) * 16 + y) * 256 +
                  (tile % 16) * 16 +
                  x) *
                  4 +
                  c
              ] !== 173
            )
              same = false;
      ok("atlas tile preserved " + tile, same);
    }
  for (const [name, base, count] of [
    ["fire_0", T.fire, 8],
    ["soul_fire_0", T.soul_fire, 4],
    ["campfire_fire", T.campfire_flame, 4],
  ] as const) {
    const sheet = decodePng(JAVA_FIRE_TEXTURES[name]);
    eq(
      "native sheet dimensions " + name,
      [sheet.width, sheet.height],
      [16, name === "campfire_fire" ? 128 : 512],
    );
    for (let frame = 0; frame < count; frame++) {
      const actual = [];
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dst =
            ((Math.floor((base + frame) / 16) * 16 + y) * 256 +
              ((base + frame) % 16) * 16 +
              x) *
            4;
          actual.push(...img.data.subarray(dst, dst + 4));
        }
      const indices = JAVA_FIRE_ANIMATIONS[name].frames,
        native = indices[Math.floor((frame * indices.length) / count)];
      eq(
        "exact native sampled frame " + name + frame,
        actual,
        Array.from(sheet.data.subarray(native * 1024, (native + 1) * 1024)),
      );
    }
  }
}
{
  const w = new World(421, true);
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) w.getChunk(x, z);
  for (const [x, id] of [
    [4, B.FIRE],
    [6, B.SOUL_FIRE],
    [8, B.CAMPFIRE],
    [10, B.CAMPFIRE_OFF],
  ])
    w.setBlock(x, 65, 4, id);
  const geo = w.buildMesh(w.getChunk(0, 0));
  const flags = geo[1].getAttribute("aWave");
  ok("ordinary flame animation flag", Array.from(flags.array).includes(2));
  ok("soul animation flag", Array.from(flags.array).includes(3));
  const snap = snapshotMesh(w, 0, 0);
  const reply = meshSnapshot(snap.snapshot, 1);
  const async = reply.geometries.map(unpackGeometry);
  eq(
    "fire/campfires exact Worker geometry",
    meshFingerprint(async),
    meshFingerprint(geo),
  );
  geo.forEach((g) => g.dispose());
  async.forEach((g) => g.dispose());
  const c = w.getChunk(0, 0);
  let scans = 0;
  const rebuild = c.refreshEmitters.bind(c);
  c.refreshEmitters = () => {
    scans++;
    rebuild();
  };
  for (let n = 0; n < 100; n++)
    w.setBlock(
      n % 16,
      70 + Math.floor(n / 16),
      8,
      n % 2 ? B.TORCH : B.GLOWSTONE,
    );
  for (let n = 0; n < 30; n++)
    w.seedMods([
      {
        x: n % 16,
        y: 70 + Math.floor(n / 16),
        z: 8,
        id: n % 3 ? B.FIRE : B.AIR,
      },
    ]);
  eq("source edits never rescan whole chunk", scans, 0);
  const actual = c.emitters.slice();
  rebuild();
  eq(
    "incremental source index exactly equals complete sorted scan",
    actual,
    c.emitters,
  );
  const raw = new Chunk(0, 0);
  raw.updateEmitter(9, B.AIR, B.TORCH);
  raw.updateEmitter(2, B.AIR, B.FIRE);
  raw.updateEmitter(9, B.TORCH, B.SOUL_FIRE);
  eq("stable source-to-source transition", [...raw.emitters], [2, 9]);
  raw.updateEmitter(2, B.FIRE, B.AIR);
  eq("source removal", [...raw.emitters], [9]);
}
{
  const time = { value: 0 },
    mat = new THREE.MeshBasicMaterial();
  patchChunkMaterial(mat, { value: 1 }, { fire: true, time });
  const shader: any = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
  (mat.onBeforeCompile as any)(shader);
  ok("fire gets shared time uniform", shader.uniforms.uTime === time);
  ok(
    "frame UV animation shader installed",
    shader.vertexShader.includes(
      "vMapUv.x += floor(mod(uTime * rate, frames)) / 16.0",
    ),
  );
  ok(
    "cutout geometry is not water-deformed",
    !shader.vertexShader.includes("transformed.y += sin"),
  );
  ok(
    "separate shader cache key",
    mat.customProgramCacheKey().endsWith("-fire"),
  );
}

{
  const w = new Grid();
  floor(w);
  const g = game(w);
  g.inventory.slots[0] = {
    id: I.FLINT_STEEL,
    count: 1,
    ench: { unbreaking: 3 },
  };
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    g.tryUse();
  } finally {
    Math.random = random;
  }
  eq("Unbreaking can preserve a successful use", g.inventory.slots[0].dur, 64);
  eq("Unbreaking still lights real fire", w.peekBlock(4, 65, 4), B.FIRE);
  const c = game(w, "creative");
  c.target.id = B.FIRE;
  c.pickBlock();
  eq(
    "creative cannot clone a fire item",
    c.inventory.slots[0].id,
    I.FLINT_STEEL,
  );
  c.target.id = B.CAMPFIRE_OFF;
  c.pickBlock();
  eq(
    "pick unlit campfire gives ordinary campfire",
    c.inventory.slots[0].id,
    B.CAMPFIRE,
  );
  const q = new Grid();
  floor(q, 4, 64, 4, B.TNT);
  q.setBlock = () => {};
  const t = game(q);
  t.target.id = B.TNT;
  t.tryUse();
  eq("refused TNT world write creates no entity", t.tnts.length, 0);
  eq(
    "refused TNT write costs no durability",
    t.inventory.slots[0].dur,
    undefined,
  );
  const v = new Grid();
  floor(v);
  const f = game(v, "creative");
  f.net = { public: true, canEdit: () => false };
  v.setBlock(4, 65, 4, B.FIRE);
  eq(
    "protected fire cannot be extinguished by hand",
    f.breakBlock(4, 65, 4),
    false,
  );
  eq(
    "protected flame survives rejected extinguish",
    v.peekBlock(4, 65, 4),
    B.FIRE,
  );
}
console.log(`${checks} fire/ignition/protection checks passed`);
