import assert from "node:assert/strict";
import { trapdoorReference as reference } from "./trapdoorReference";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { T, collisionBoxes } from "../src/game/blocks";
import { World, Chunk } from "../src/game/world";
import {
  snapshotMesh,
  meshSnapshot,
  unpackGeometry,
} from "../src/game/meshProtocol";
import { meshFingerprint } from "./meshFingerprint";
import { BLOCK_ATLAS_PNG } from "../src/game/art/vanillaArt.generated";
import { decodePng } from "../src/game/art/miniPng";
import { isOfficialTile } from "../src/game/packArt";
const root = path.resolve(".harness/fixtures/java-trapdoor-26.3");
const load = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const manifest = load("manifest.json");
let checks = 0,
  failed = 0,
  matchedUVs = 0;
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (e) {
    failed++;
    if (failed < 5) console.error(name, e);
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 2e-6, `${a} != ${b}`);
}
for (const file of manifest.files)
  test("pinned reference " + file.path, () => {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  });
function key(pos: number[], face: number) {
  return face + ":" + pos.map((n) => Math.round(n * 65536)).join(",");
}
function fixture() {
  const w = new World(435, true);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      w.chunks.set(World.key(x, z), new Chunk(x, z));
  return w;
}
const ids = [
  68,
  69,
  70,
  71,
  72,
  ...Array.from({ length: 16 }, (_, i) => 503 + i),
];
for (const id of ids) {
  test(`state ${id}: unchanged physical bounds agree with reference`, () => {
    const { box } = reference(id),
      actual = collisionBoxes(id)!;
    box.forEach((v, i) => near(v, actual[i]));
  });
  test(`state ${id}: all 24 rendered corners use reference UV, including reversed edges`, () => {
    const w = fixture();
    w.setBlock(5, 100, 5, id);
    const geos = w.buildMesh(w.getChunk(0, 0));
    try {
      const { out } = reference(id),
        p = geos[1].getAttribute("position"),
        uv = geos[1].getAttribute("uv"),
        f = geos[1].getAttribute("aFace");
      assert.equal(p.count, 24);
      assert.equal(geos[0].getAttribute("position")?.count ?? 0, 0);
      for (let i = 0; i < p.count; i++) {
        const expected = out.get(
          key([p.getX(i) - 5, p.getY(i) - 100, p.getZ(i) - 5], f.getX(i)),
        );
        assert.ok(expected);
        // Atlas padding is only at the outer 0/16 texel boundary. Independent
        // calculation rather than sharing the production tile UV helper.
        const [u, v] = expected!,
          eps = 0.0004,
          col = T.trapdoor % 16,
          row = Math.floor(T.trapdoor / 16);
        near(
          uv.getX(i),
          (col + u / 16) / 16 + (u === 0 ? eps : u === 16 ? -eps : 0),
        );
        near(
          uv.getY(i),
          1 - (row + v / 16) / 16 + (v === 0 ? -eps : v === 16 ? eps : 0),
        );
        matchedUVs++;
      }
    } finally {
      geos.forEach((g) => g.dispose());
    }
  });
  test(`state ${id}: worker preserves UV and vertex layout exactly`, () => {
    const w = fixture();
    w.setBlock(5, 100, 5, id);
    const geos = w.buildMesh(w.getChunk(0, 0)),
      { snapshot } = snapshotMesh(w, 0, 0),
      worker = meshSnapshot(snapshot, 1).geometries.map(unpackGeometry);
    assert.deepEqual(meshFingerprint(worker), meshFingerprint(geos));
    [...geos, ...worker].forEach((g) => g.dispose());
  });
}
test("runtime embedded oak pixels exactly match pinned 26.3 PNG, including alpha", () => {
  const atlas = decodePng(BLOCK_ATLAS_PNG),
    ref = decodePng(
      fs
        .readFileSync(
          path.join(root, "assets/minecraft/textures/block/oak_trapdoor.png"),
        )
        .toString("base64"),
    );
  assert.equal(ref.width, 16);
  assert.equal(ref.height, 16);
  assert.ok(isOfficialTile(T.trapdoor));
  const actual = new Uint8ClampedArray(1024);
  for (let y = 0; y < 16; y++) {
    const offset =
      ((Math.floor(T.trapdoor / 16) * 16 + y) * atlas.width +
        (T.trapdoor % 16) * 16) *
      4;
    actual.set(atlas.data.subarray(offset, offset + 64), y * 64);
  }
  assert.deepEqual(actual, new Uint8ClampedArray(ref.data));
});
test("closed direction/half changes do not invent texture rotations absent from oak blockstates", () => {
  const first = reference(503).out;
  for (let id = 504; id <= 510; id++) {
    const normalized = (id: number) =>
      [...reference(id).out].map(([k, v]) => [k.split(":")[0], v]);
    assert.deepEqual(
      normalized(id),
      [...first].map(([k, v]) => [k.split(":")[0], v]),
    );
  }
  for (let face = 0; face < 4; face++)
    assert.deepEqual(reference(511 + face).out, reference(515 + face).out);
});
console.log(
  `Trap UV: ${checks} groups passed, ${failed} failed, ${matchedUVs}/504 vertex UV pairs matched`,
);
if (failed) process.exitCode = 1;
