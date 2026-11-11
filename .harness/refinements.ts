import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { B, BLOCKS, bedPart, isBed } from "../src/game/blocks";
import {
  I,
  ITEMS,
  ITEM_LIST,
  canHarvest,
  fuelSeconds,
  toolMiningSpeed,
  mineSeconds,
  durabilityMax,
  blockDrops,
} from "../src/game/items";
import { Inventory, RECIPES } from "../src/game/inventory";
import { NATIVE_RECIPE_IDS } from "../src/game/refinementRecipes";
import { CloudMotion } from "../src/game/sky";
import { spriteItemGeometry } from "../src/game/spriteItem";
import { bedItemGeometry, createBedItemMaterial } from "../src/game/bedItem";
import { patchChunkMaterial } from "../src/game/lighting";
import { skinnedBox, skinnedHat } from "../src/game/skinArt";
import { officialItemPixels } from "../src/game/packArt";
let checks = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log("✓ " + name);
}
const dir = ".harness/fixtures/java-refinements-1.20.4";
const manifest = JSON.parse(
  fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
);
for (const f of manifest.files)
  test("native SHA " + f.path, () =>
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(path.join(dir, f.path)))
        .digest("hex"),
      f.sha256,
    ),
  );
for (const file of manifest.files.filter(
  (f: any) =>
    f.path.includes("/recipes/") && !f.path.endsWith("/oak_boat.json"),
)) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, file.path), "utf8"));
  const id = (o: any) => {
    const key = (o.item ?? o.tag).replace("minecraft:", "");
    assert.notEqual(NATIVE_RECIPE_IDS[key], undefined, key);
    return NATIVE_RECIPE_IDS[key];
  };
  test("native grid matches " + path.basename(file.path), () => {
    const inv = new Inventory();
    if (r.pattern) {
      r.pattern.forEach((row: string, y: number) =>
        [...row].forEach((c, x) => {
          if (c !== " ") inv.grid[y * 3 + x] = { id: id(r.key[c]), count: 1 };
        }),
      );
    } else
      r.ingredients.forEach((i: any, n: number) => {
        inv.grid[n] = { id: id(i), count: 1 };
      });
    assert.equal(inv.gridMatch(true)?.out.id, id(r.result));
    assert.equal(inv.craftGrid(true)?.count, r.result.count ?? 1);
  });
}
test("all item IDs remain unique and do not overlap directional furnaces", () => {
  assert.equal(new Set(ITEM_LIST.map((i) => i.id)).size, ITEM_LIST.length);
  for (const i of ITEM_LIST) assert.equal(BLOCKS[i.id], undefined, i.name);
});
for (const id of [
  I.GOLD_PICK,
  I.GOLD_AXE,
  I.GOLD_SHOVEL,
  I.GOLD_SWORD,
  I.GOLD_HOE,
])
  test("gold durability/stack/icon " + id, () => {
    assert.equal(durabilityMax(id), 32);
    assert.equal(fuelSeconds(id), 0);
    assert.equal(officialItemPixels(id)?.length, 1024);
    assert.equal(ITEMS[id]?.tier, 1);
  });
test("gold is faster but cannot harvest iron/diamond ores", () => {
  assert.equal(toolMiningSpeed(B.STONE, I.GOLD_PICK), 12);
  assert.equal(canHarvest(B.COAL_ORE, I.GOLD_PICK), true);
  assert.equal(canHarvest(B.IRON_ORE, I.GOLD_PICK), false);
  assert.equal(canHarvest(B.DIAMOND_ORE, I.GOLD_PICK), false);
  assert.equal(Math.round(mineSeconds(B.STONE, I.GOLD_PICK) * 20), 4);
  assert.equal(Math.round(mineSeconds(B.IRON_ORE, I.GOLD_PICK) * 20), 25);
});
test("26.3 component rules supersede old wool-sword and bed-axe assumptions", () => {
  assert.equal(toolMiningSpeed(B.WOOL_WHITE, I.WOOD_SWORD), 1);
  assert.equal(toolMiningSpeed(B.BED, I.GOLD_AXE), 1);
  assert.equal(toolMiningSpeed(B.BED_HEAD_E, I.IRON_AXE), 1);
});
test("no invented shortcuts for uncraftable blocks/items", () => {
  for (const id of [
    I.TOTEM,
    B.BELL,
    B.OBSIDIAN,
    B.CRYING_OBSIDIAN,
    B.GLASS,
    B.CONCRETE_RED,
    B.MUD,
  ])
    assert.equal(
      RECIPES.some((r) => r.out.id === id),
      false,
      String(id),
    );
});
test("honey block crafting preserves four bottles, including stacked inputs/full inventory", () => {
  const inv = new Inventory();
  for (const i of [0, 1, 3, 4]) inv.grid[i] = { id: I.HONEY_BOTTLE, count: 1 };
  assert.equal(inv.craftGrid(false)?.id, B.HONEY_BLOCK);
  assert.deepEqual(
    inv.grid.filter(Boolean).map((s) => s?.id),
    Array(4).fill(I.BOTTLE),
  );
  for (const i of [0, 1, 3, 4]) inv.grid[i] = { id: I.HONEY_BOTTLE, count: 2 };
  inv.slots.fill({ id: B.STONE, count: 64 });
  const before = JSON.stringify(inv);
  assert.equal(inv.craftGrid(false), null);
  assert.equal(JSON.stringify(inv), before);
});
test("weather changes alter cloud velocity, never multiply uptime", () => {
  const motion = new CloudMotion();
  motion.advance(24 * 3600 * 1000, 1);
  const before = motion.distance;
  const next = motion.advance(24 * 3600 * 1000 + 100, 1.28);
  assert.ok(Math.abs(next - before - 0.4352) < 1e-8);
  const sleep = motion.advance(48 * 3600 * 1000, 1.28);
  assert.ok(sleep - next < 1.1);
  assert.equal(motion.advance(NaN), sleep);
});
test("cloud motion is independent of regular render frame rate", () => {
  const a = new CloudMotion(),
    b = new CloudMotion();
  for (let i = 0; i <= 600; i++) a.advance((i / 60) * 1000);
  for (let i = 0; i <= 100; i++) b.advance((i / 10) * 1000);
  assert.ok(Math.abs(a.distance - b.distance) < 1e-8);
});
test("sprite tools have a real 1px perimeter and front/back faces", () => {
  const g = spriteItemGeometry(I.GOLD_PICK);
  g.computeBoundingBox();
  assert.ok(g.attributes.position.count > 12);
  assert.equal(g.boundingBox!.max.z - g.boundingBox!.min.z, 1 / 16);
  for (const n of g.attributes.position.array) assert.ok(Number.isFinite(n));
  g.dispose();
});
test("bed inventory model is a complete two-part bed with four legs", () => {
  const material = createBedItemMaterial();
  assert.equal(material.map!.image.width, 64);
  assert.equal(material.map!.image.height, 64);
  material.dispose();
  const g = bedItemGeometry();
  g.computeBoundingBox();
  assert.equal(g.boundingBox!.max.z - g.boundingBox!.min.z, 2);
  assert.equal(g.boundingBox!.max.y - g.boundingBox!.min.y, 9 / 16);
  assert.equal(g.attributes.position.count, 6 * 36);
  g.dispose();
});
test("world skin and overlay can use directional/point light without changing UI previews", () => {
  const t = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
  const lit = skinnedBox([0.5, 0.5, 0.5], "head", t, false, true),
    ui = skinnedBox([0.5, 0.5, 0.5], "head", t),
    hat = skinnedHat([0.5, 0.5, 0.5], t, true);
  assert.ok(lit.material instanceof THREE.MeshLambertMaterial);
  assert.ok(hat.material instanceof THREE.MeshLambertMaterial);
  assert.ok(ui.material instanceof THREE.MeshBasicMaterial);
  for (const m of [lit, ui, hat]) {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  t.dispose();
});
test("water shader uses world coordinates at chunk seams and bounded Fresnel reflection", () => {
  const m = new THREE.MeshBasicMaterial(),
    shader: any = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader:
        "#include <common>\n#include <color_fragment>\n#include <opaque_fragment>",
    };
  patchChunkMaterial(m, { value: 1 }, { water: true });
  m.onBeforeCompile(shader, {} as any);
  assert.ok(
    shader.vertexShader.includes("modelMatrix * vec4(transformed, 1.0)"),
  );
  assert.ok(shader.vertexShader.includes("wp.x * 0.55"));
  assert.ok(shader.fragmentShader.includes("fresnel*0.38"));
  m.dispose();
});
// Actual engine method, not a copy of the paired-block algorithm.
const { Game } = await import("../src/game/engine");
for (let facing = 0; facing < 4; facing++)
  for (const head of [false, true])
    test(
      "breaking either bed half removes its partner once " +
        facing +
        "/" +
        head,
      () => {
        const cells = new Map<string, number>(),
          get = (x: number, y: number, z: number) =>
            cells.get(`${x},${y},${z}`) ?? B.AIR;
        const dx = facing === 1 ? 1 : facing === 3 ? -1 : 0,
          dz = facing === 2 ? 1 : facing === 0 ? -1 : 0;
        const foot: [number, number, number] = [10, 70, 10],
          other: [number, number, number] = [10 + dx, 70, 10 + dz];
        cells.set(foot.join(","), bedPart(facing, false));
        cells.set(other.join(","), bedPart(facing, true));
        const drops: number[] = [];
        const g: any = Object.assign(Object.create(Game.prototype), {
          world: {
            city: false,
            getBlock: get,
            peekBlock: get,
            setBlock: (x: number, y: number, z: number, id: number) =>
              cells.set(`${x},${y},${z}`, id),
          },
          mode: "survival",
          growables: new Map(),
          canModify: () => true,
          spawnParticles() {},
          fallGravity() {},
          selectedStack: () => null,
          spawnDrop: (id: number) => drops.push(id),
        });
        const hit = head ? other : foot;
        assert.equal(g.breakBlock(...hit), true);
        assert.equal(get(...foot), B.AIR);
        assert.equal(get(...other), B.AIR);
        assert.deepEqual(drops, [B.BED]);
        assert.equal(g.breakBlock(...other), false);
        assert.deepEqual(drops, [B.BED]);
      },
    );
console.log(`${checks} refinement/native regression checks passed`);
