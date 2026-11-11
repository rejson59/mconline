import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { Game, blockGeometry } from "../src/game/engine";
import { Mob } from "../src/game/mobs";
import { World } from "../src/game/world";
import { B, BLOCKS, RENDER, tileFor } from "../src/game/blocks";
import { I } from "../src/game/items";
import { Inventory, RECIPES, recipeCells } from "../src/game/inventory";
import { blastExposure, clearSegment } from "../src/game/blast";
import { officialBlockAtlas, isOfficialTile } from "../src/game/packArt";

let passed = 0,
  failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e);
  }
}
function world(city = false) {
  const w = new World(442, true, false, city);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) w.getChunk(x, z);
  for (let x = -5; x < 10; x++)
    for (let z = -5; z < 10; z++)
      for (let y = 65; y < 73; y++) w.setBlock(x, y, z, B.AIR);
  return w;
}
function wall(w: World, id: number = B.STONE) {
  for (let y = 65; y < 70; y++)
    for (let z = -3; z <= 3; z++) w.setBlock(2, y, z, id);
}
for (const id of [B.STONE, B.GLASS, B.GLASS_PANE, B.COBBLE])
  test(`creeper never arms through an intact physical wall ${id}`, () => {
    const w = world();
    wall(w, id);
    const m = new Mob("creeper", 1.5, 65, 0.5),
      target = new THREE.Vector3(3.5, 65, 0.5);
    m.aiTimer = 100;
    for (let n = 0; n < 120; n++)
      m.update(
        1 / 60,
        w,
        target,
        () => {},
        () => {},
        false,
      );
    assert.ok(!m.dead && !m.exploded && m.fuse < 0);
    m.dispose();
  });
test("an exposed nearby player still triggers the ordinary creeper fuse", () => {
  const w = world(),
    m = new Mob("creeper", 1.5, 65, 0.5);
  m.aiTimer = 100;
  for (let n = 0; n < 100; n++)
    m.update(
      1 / 60,
      w,
      new THREE.Vector3(3.5, 65, 0.5),
      () => {},
      () => {},
      false,
    );
  assert.ok(m.dead && m.exploded);
  m.dispose();
});
test("placing a wall during a nearly finished fuse cools it instead of exploding", () => {
  const w = world(),
    m = new Mob("creeper", 1.5, 65, 0.5);
  m.fuse = 0.05;
  wall(w);
  for (let n = 0; n < 120; n++)
    m.update(
      1 / 60,
      w,
      new THREE.Vector3(3.5, 65, 0.5),
      () => {},
      () => {},
      false,
    );
  assert.ok(!m.dead && !m.exploded && m.fuse < 0);
  m.dispose();
});
test("retreat and creative mode defuse an already armed ordinary creeper", () => {
  for (const peaceful of [false, true]) {
    const w = world(),
      m = new Mob("creeper", 1.5, 65, 0.5);
    m.fuse = 0.05;
    for (let n = 0; n < 100; n++)
      m.update(
        1 / 60,
        w,
        new THREE.Vector3(peaceful ? 3.5 : 12.5, 65, 0.5),
        () => {},
        () => {},
        peaceful,
      );
    assert.ok(!m.exploded && m.fuse < 0);
    m.dispose();
  }
});
test("TNT keeps its independent fuse even with cover and creative target", () => {
  const w = world(),
    m = new Mob("creeper", 1.5, 65, 0.5);
  m.isTnt = true;
  m.primeFuse = 0.1;
  wall(w);
  m.update(
    0.2,
    w,
    new THREE.Vector3(3.5, 65, 0.5),
    () => {},
    () => {},
    true,
  );
  assert.ok(m.exploded);
  m.dispose();
});
test("DDA stops at glass and thin panels; clear air and the gap below a top trapdoor stay visible", () => {
  const w = world();
  assert.ok(clearSegment(w, 1.5, 65.4, 0.5, 3.5, 65.4, 0.5));
  w.setBlock(2, 65, 0, B.GLASS_PANE);
  assert.equal(clearSegment(w, 1.5, 65.4, 0.5, 3.5, 65.4, 0.5), false);
  w.setBlock(2, 65, 0, B.TRAP);
  assert.ok(clearSegment(w, 1.5, 65.4, 0.5, 3.5, 65.4, 0.5));
});
test("unknown terrain and nonfinite rays fail closed without generating a chunk", () => {
  const w = new World(442, true);
  assert.equal(clearSegment(w, 0, 65, 0, 5, 65, 0), false);
  assert.equal(w.hasChunk(0, 0), false);
  assert.equal(clearSegment(w, NaN, 0, 0, 1, 0, 0), false);
});
test("exposure distinguishes full cover, partial cover, and unobstructed bodies", () => {
  const w = world();
  assert.equal(blastExposure(w, 1.5, 66, 0.5, 4.5, 65, 0.5, 0.6, 1.8), 1);
  w.setBlock(2, 65, 0, B.STONE);
  const partial = blastExposure(w, 1.5, 66, 0.5, 4.5, 65, 0.5, 0.6, 1.8);
  assert.ok(partial > 0 && partial < 1);
  wall(w);
  assert.equal(blastExposure(w, 1.5, 66, 0.5, 4.5, 65, 0.5, 0.6, 1.8), 0);
});
function explosionScene(w: World, shared = false) {
  const hits: number[] = [];
  const body = {
    pos: new THREE.Vector3(4.5, 65, 0.5),
    vel: new THREE.Vector3(),
    h: 1.8,
    w: 0.6,
  };
  const g: any = Object.assign(Object.create(Game.prototype), {
    world: w,
    body,
    mobs: [],
    combatPlayers: new Map(),
    damage: (n: number) => hits.push(n),
    spawnParticles() {},
    spawnSmoke() {},
    fallGravity() {},
    mobSimulating: shared,
    net: shared ? { id: "owner" } : undefined,
    mobCaptureRegion: "o:0:0",
    mobCaptures: new Map([["o:0:0", { hits: [], edits: [], drops: [] }]]),
  });
  return { g, hits };
}
test("actual explosion computes cover before demolishing that wall, including knockback", () => {
  const w = world();
  wall(w);
  const { g, hits } = explosionScene(w),
    random = Math.random;
  try {
    Math.random = () => 0.5;
    g.explode(1.5, 66, 0.5, 3.2, "player");
  } finally {
    Math.random = random;
  }
  assert.equal(
    w.peekBlock(2, 66, 0),
    B.AIR,
    "test explosion must really remove the shielding block",
  );
  assert.equal(hits.length, 0);
  assert.equal(g.body.vel.length(), 0);
});
test("unshielded targets still take damage and impulse from the real explosion", () => {
  const { g, hits } = explosionScene(world());
  g.explode(1.5, 66, 0.5, 3.2, "player");
  assert.ok(hits[0] > 0);
  assert.ok(g.body.vel.length() > 0);
});
test("shared simulation captures only exposed players, not protected players behind the wall", () => {
  const w = world();
  wall(w);
  const { g } = explosionScene(w, true);
  g.combatPlayers.set("protected", {
    x: 4.5,
    y: 65,
    z: 0.5,
    d: "o",
    alive: true,
  });
  g.combatPlayers.set("exposed", {
    x: 1.5,
    y: 65,
    z: 2.5,
    d: "o",
    alive: true,
  });
  g.explode(1.5, 66, 0.5, 3.2, "player");
  const hits = g.mobCaptures.get("o:0:0").hits;
  assert.equal(
    hits.some((h: any) => h.target === "protected" || h.target === "owner"),
    false,
  );
  assert.ok(
    hits.some(
      (h: any) => h.target === "exposed" && h.damage > 0 && h.explosion,
    ),
  );
});
test("local mobs and the shared-mob action path use their own pre-blast body cover", () => {
  for (const shared of [false, true]) {
    const w = world();
    wall(w);
    const { g } = explosionScene(w);
    if (shared) g.net = { sharedContainers: true, exchangeSharedMobs() {} };
    const covered = new Mob("cow", 4.5, 65, 0.5),
      exposed = new Mob("cow", 1.5, 65, 2.5);
    covered.netId = "covered";
    exposed.netId = "exposed";
    covered.netRegion = exposed.netRegion = "o:0:0";
    const initialCovered = covered.health,
      initialExposed = exposed.health;
    g.mobs = [covered, exposed];
    g.performSharedMobAction = async (_key: string, fn: () => void) => fn();
    g.explode(1.5, 66, 0.5, 3.2, "player");
    assert.equal(covered.health, initialCovered);
    assert.equal(covered.body.vel.length(), 0);
    assert.ok(exposed.health < initialExposed);
    assert.ok(exposed.body.vel.length() > 0);
    covered.dispose();
    exposed.dispose();
  }
});
test("city explosions remain disabled before world or inventory mutations", () => {
  const w = world(true);
  wall(w);
  const { g, hits } = explosionScene(w);
  g.explode(1.5, 66, 0.5, 3.2, "player");
  assert.equal(w.peekBlock(2, 66, 0), B.STONE);
  assert.equal(hits.length, 0);
});
for (const id of [B.TORCH, B.REDSTONE_TORCH, B.REDSTONE_TORCH_OFF])
  test(`existing torch rod ${id} stays a real 3D item`, () => {
    const g = blockGeometry(id);
    g.computeBoundingBox();
    assert.ok(g.boundingBox!.max.z - g.boundingBox!.min.z > 0);
    assert.ok(g.attributes.position.count >= 24);
    g.dispose();
  });
for (const id of Object.keys(BLOCKS)
  .map(Number)
  .filter((id) => RENDER[id] === 1))
  test(`cross block ${id} now has a 1px silhouette perimeter, not a single wall`, () => {
    const g = blockGeometry(id);
    g.computeBoundingBox();
    assert.ok(
      Math.abs(g.boundingBox!.max.z - g.boundingBox!.min.z - 1 / 16) < 1e-7,
    );
    assert.ok(g.attributes.position.count > 12);
    const t = tileFor(id, 0),
      atlas = officialBlockAtlas();
    if (atlas && isOfficialTile(t)) {
      const alpha = (x: number, y: number) =>
        x >= 0 &&
        x < 16 &&
        y >= 0 &&
        y < 16 &&
        atlas.data[
          ((Math.floor(t / 16) * 16 + y) * atlas.width + (t % 16) * 16 + x) *
            4 +
            3
        ] >= 32;
      let edges = 0;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++)
          if (alpha(x, y))
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ])
              if (!alpha(x + dx, y + dy)) edges++;
      assert.equal(g.attributes.position.count, 12 + edges * 6);
    }
    for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v));
    g.dispose();
  });
const fixture = ".harness/fixtures/report-recipes-26.3/";
const manifest = JSON.parse(fs.readFileSync(fixture + "manifest.json", "utf8"));
for (const f of manifest.files)
  test("canonical pinned fixture hash " + f.path, () =>
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(fixture + f.path))
        .digest("hex"),
      f.sha256,
    ),
  );
const names: Record<string, number> = {
  stick: I.STICK,
  gold_ingot: I.GOLD,
  golden_pickaxe: I.GOLD_PICK,
  golden_axe: I.GOLD_AXE,
  golden_shovel: I.GOLD_SHOVEL,
  golden_sword: I.GOLD_SWORD,
  golden_hoe: I.GOLD_HOE,
  ladder: B.LADDER_N,
  oak_fence: B.FENCE,
  oak_planks: B.PLANKS,
  lapis_block: B.LAPIS_BLOCK,
  lapis_lazuli: I.LAPIS,
};
const idFor = (key: string) =>
  names[
    key === "#minecraft:gold_tool_materials"
      ? "gold_ingot"
      : key.replace("minecraft:", "")
  ];
for (const name of [
  "golden_pickaxe",
  "golden_axe",
  "golden_shovel",
  "golden_sword",
  "golden_hoe",
  "ladder",
  "oak_fence",
  "lapis_lazuli",
])
  test("native 26.3 crafting grid " + name, () => {
    const r = JSON.parse(fs.readFileSync(fixture + name + ".json", "utf8"));
    for (const mirror of [false, true]) {
      const inv = new Inventory();
      if (r.pattern)
        r.pattern.forEach((row: string, y: number) =>
          [...row].forEach((c, x) => {
            if (c !== " ")
              inv.grid[y * 3 + (mirror ? row.length - 1 - x : x)] = {
                id: idFor(r.key[c]),
                count: 1,
              };
          }),
        );
      else
        r.ingredients.forEach(
          (key: string, n: number) =>
            (inv.grid[n] = { id: idFor(key), count: 1 }),
        );
      const result = inv.craftGrid(true);
      assert.equal(result?.id, idFor(r.result.id));
      assert.equal(result?.count, r.result.count ?? 1);
    }
  });
test("the gold-tool tag really has just the mapped gold ingot, not silently narrowed alternatives", () => {
  assert.deepEqual(
    JSON.parse(fs.readFileSync(fixture + "gold_tool_materials.json", "utf8"))
      .values,
    ["minecraft:gold_ingot"],
  );
});
test("ladder/fence require a crafting table in the recipe book and crafting grid", () => {
  for (const id of [B.LADDER_N, B.FENCE]) {
    const r = RECIPES.find((r) => r.out.id === id)!;
    assert.equal(r.table, true);
    assert.equal(recipeCells(r, false), null);
    assert.ok(recipeCells(r, true));
    const inv = new Inventory();
    const cells = recipeCells(r, true)!;
    cells.forEach((id, i) => {
      if (id) inv.grid[i] = { id, count: 1 };
    });
    assert.equal(inv.gridMatch(false), null);
    assert.ok(inv.gridMatch(true));
  }
});
test("lapis ore cannot be converted by an invented 1 -> 4 crafting shortcut", () => {
  const inv = new Inventory();
  inv.grid[0] = { id: B.LAPIS_ORE, count: 1 };
  assert.equal(inv.gridMatch(true), null);
  assert.equal(
    RECIPES.some(
      (r) => r.out.id === I.LAPIS && r.inputs.some((s) => s.id === B.LAPIS_ORE),
    ),
    false,
  );
});
console.log(`Report fixes: ${passed} groups passed, ${failed} failed`);
if (failed) process.exitCode = 1;
