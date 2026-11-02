import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  B,
  T,
  BLOCKS,
  EMIT,
  CREATIVE_BLOCKS,
  tileFor,
  buildingItem,
  furnaceIdFor,
  furnaceFacing,
  furnaceFacingForYaw,
  furnaceCapCorner,
  isFurnace,
  collisionBoxes,
} from "../src/game/blocks";
import {
  I,
  ITEMS,
  blockDrops,
  canHarvest,
  mineSeconds,
  resolveId,
} from "../src/game/items";
import { World } from "../src/game/world";
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";
import { applyJavaFurnaceTextures } from "../src/game/facingArt";
import { JAVA_FACING_TEXTURES } from "../src/game/art/javaFacing.generated";
import { decodePng } from "../src/game/art/miniPng";

let checks = 0;
eq("ordinary furnace alias remains canonical", resolveId("piec"), B.FURNACE);
eq("legacy lit alias is not shadowed", resolveId("rozpalony_piec"), B.FURNACE_ON);
function eq(name: string, a: unknown, b: unknown) {
  assert.deepStrictEqual(a, b, name);
  checks++;
}
const root = path.resolve(".harness/fixtures/java-facing-1.20.4");
const load = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const manifest = load("manifest.json");
for (const f of manifest.files) {
  const bytes = fs.readFileSync(path.join(root, f.path));
  eq("reference bytes " + f.path, bytes.length, f.bytes);
  eq(
    "reference SHA " + f.path,
    createHash("sha256").update(bytes).digest("hex"),
    f.sha256,
  );
}
const variants = load("assets/minecraft/blockstates/furnace.json").variants;
const names = ["north", "east", "south", "west"];
const faces = ["west", "east", "down", "up", "north", "south"];
const vectors = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];
const bindings = load(
  "assets/minecraft/models/block/orientable_with_bottom.json",
).textures;
const tiles: Record<string, number> = {
  furnace_front: T.furnace_front,
  furnace_front_on: T.furnace_lit,
  furnace_side: T.furnace_side,
  furnace_top: T.furnace_top,
};
const targetFor = (name: string) => {
  let key = bindings[name].slice(1);
  if (key === "bottom") key = "top";
  return key;
};
for (const [state, raw] of Object.entries(variants)) {
  const v = raw as { model: string; y?: number };
  const facing = names.indexOf(state.match(/facing=(\w+)/)![1]);
  const lit = state.endsWith("=true");
  const id = furnaceIdFor(facing, lit),
    model = load(
      "assets/minecraft/models/" + v.model.replace("minecraft:", "") + ".json",
    );
  const angle = ((v.y ?? 0) * Math.PI) / 180,
    c = Math.round(Math.cos(angle)),
    s = Math.round(Math.sin(angle));
  eq(
    "reference model parent " + state,
    model.parent,
    "minecraft:block/orientable",
  );
  eq(
    "known cube bounds " + state,
    load("assets/minecraft/models/block/cube.json").elements[0].to,
    [16, 16, 16],
  );
  for (let base = 0; base < 6; base++) {
    const [x, y, z] = vectors[base];
    const rotated = [x * c - z * s, y, x * s + z * c];
    const target = vectors.findIndex((vec) =>
      vec.every((n, i) => n === rotated[i]),
    );
    const texture = model.textures[targetFor(faces[base])].split("/").pop();
    eq(
      "native face " + state + "/" + faces[target],
      tileFor(id, target),
      tiles[texture],
    );
  }
  for (const face of [2, 3])
    for (const x of [0, 1])
      for (const z of [0, 1]) {
        // Inverse original blockstate rotation, then Java's implicit cube UV convention.
        const lx = Math.round(0.5 + (x - 0.5) * c + (z - 0.5) * s),
          lz = Math.round(0.5 - (x - 0.5) * s + (z - 0.5) * c);
        const expected = lx + 2 * (face === 3 ? 1 - lz : lz);
        eq(
          "native cap UV " + state + "/" + face + "/" + x + "/" + z,
          furnaceCapCorner(id, face, x, z),
          expected,
        );
      }
  eq("recognized state " + state, isFurnace(id), true);
  eq("facing roundtrip " + state, furnaceFacing(id), facing);
  eq("canonical item " + state, buildingItem(id), B.FURNACE);
  eq("no item collision " + state, !!ITEMS[id], false);
  eq("hardness " + state, BLOCKS[id].hardness, 3.5);
  eq("light " + state, EMIT[id], lit ? 13 : 0);
  eq("collision " + state, collisionBoxes(id), collisionBoxes(B.FURNACE));
  eq(
    "state hidden from Creative " + state,
    CREATIVE_BLOCKS.includes(id),
    id === B.FURNACE,
  );
  eq("hand cannot harvest " + state, canHarvest(id, 0), false);
  eq("wood pick can harvest " + state, canHarvest(id, I.WOOD_PICK), true);
  eq(
    "mining speed invariant " + state,
    mineSeconds(id, I.DIAMOND_PICK),
    mineSeconds(B.FURNACE, I.DIAMOND_PICK),
  );
  for (const silk of [false, true]) {
    eq(
      "canonical drop " + state + "/" + silk,
      blockDrops(id, I.DIAMOND_PICK, { silk }),
      [{ id: B.FURNACE, count: 1 }],
    );
    eq(
      "no drop by hand " + state + "/" + silk,
      blockDrops(id, 0, { silk }),
      [],
    );
  }
  const world = new World(424, true);
  world.setBlock(8, 100, 8, id);
  const chunk = world.getChunk(0, 0),
    geometries = world.buildMesh(chunk);
  let checked = 0;
  for (const geo of geometries) {
    const p = geo.getAttribute("position"),
      uv = geo.getAttribute("uv"),
      f = geo.getAttribute("aFace");
    if (!p) continue;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      if (x < 8 || x > 9 || y < 100 || y > 101 || z < 8 || z > 9) continue;
      const face = f.getX(i),
        tile = tileFor(id, face),
        corner =
          face === 2 || face === 3
            ? furnaceCapCorner(id, face, x - 8, z - 8)
            : null;
      eq(
        "actual mesh tile " + state + "/" + i,
        [Math.floor(uv.getX(i) * 16), Math.floor((1 - uv.getY(i)) * 16)],
        [tile % 16, Math.floor(tile / 16)],
      );
      if (corner !== null) {
        const u = uv.getX(i) * 16 - (tile % 16),
          v = 1 - (uv.getY(i) * 16 - Math.floor(uv.getY(i) * 16));
        eq(
          "actual mesh cap " + state + "/" + i,
          [u > 0.5 ? 1 : 0, v > 0.5 ? 1 : 0],
          [corner & 1, 1 - (corner >> 1)],
        );
      }
      checked++;
    }
  }
  eq("all cube vertices present " + state, checked, 24);
  const { snapshot } = snapshotMesh(world, 0, 0),
    worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
  eq(
    "Worker parity " + state,
    meshFingerprint(worker),
    meshFingerprint(geometries),
  );
  for (const g of [...geometries, ...worker]) g.dispose();
}
eq("legacy cold south unchanged", furnaceIdFor(2), 28);
eq("legacy lit south unchanged", furnaceIdFor(2, true), 53);
for (let turns = -2; turns <= 2; turns++)
  for (const [yaw, expected] of [
    [0, 2],
    [90, 1],
    [180, 0],
    [270, 3],
    [44.9, 2],
    [45, 2],
    [45.1, 1],
    [134.9, 1],
    [135, 1],
    [135.1, 0],
    [-45, 3],
  ]) {
    // Stay off exact floating boundary for wrapped-angle tests.
    if (turns !== 0 && Math.abs(yaw % 90) === 45) continue;
    eq(
      "horizontal placement " + yaw + "/" + turns,
      furnaceFacingForYaw(((yaw + turns * 360) * Math.PI) / 180),
      expected,
    );
  }
const image = {
  width: 256,
  height: 256,
  data: new Uint8ClampedArray(256 * 256 * 4).fill(23),
} as ImageData;
applyJavaFurnaceTextures(image, tiles);
for (const [name, tile] of Object.entries(tiles)) {
  const source = decodePng(JAVA_FACING_TEXTURES[name]);
  const actual = new Uint8ClampedArray(1024);
  for (let row = 0; row < 16; row++) {
    const offset =
      ((Math.floor(tile / 16) * 16 + row) * 256 + (tile % 16) * 16) * 4;
    actual.set(image.data.subarray(offset, offset + 64), row * 64);
  }
  eq(
    "exact original atlas pixels " + name,
    actual,
    new Uint8ClampedArray(source.data),
  );
  const file = manifest.files.find((f: { path: string }) =>
    f.path.endsWith("/" + name + ".png"),
  );
  eq(
    "embedded PNG SHA " + name,
    createHash("sha256")
      .update(Buffer.from(JAVA_FACING_TEXTURES[name], "base64"))
      .digest("hex"),
    file.sha256,
  );
}
eq(
  "unrelated tile untouched",
  Array.from(image.data.subarray(0, 4)),
  [23, 23, 23, 23],
);
const loot = load("data/minecraft/loot_tables/blocks/furnace.json");
eq("original furnace item", loot.pools[0].entries[0].name, "minecraft:furnace");
console.log(`${checks} native facing/texture/mesh checks passed`);
if (process.env.FACING_REPORT)
  fs.writeFileSync(
    process.env.FACING_REPORT,
    JSON.stringify(
      {
        checks,
        failed: 0,
        reference: manifest.commit,
        files: manifest.files.length,
        bytes: manifest.files.reduce(
          (n: number, f: { bytes: number }) => n + f.bytes,
          0,
        ),
      },
      null,
      2,
    ) + "\n",
  );
