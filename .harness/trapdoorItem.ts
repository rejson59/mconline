import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { B, T } from "../src/game/blocks";
import { Game, blockGeometry } from "../src/game/engine";
import { Inventory } from "../src/game/inventory";
import { trapdoorReference } from "./trapdoorReference";
import { meshFingerprint } from "./meshFingerprint";
import {
  TRAPDOOR_ITEM_DISPLAY,
  trapdoorIconFaces,
  iconFaceTransform,
  drawTrapdoorIcon,
} from "../src/game/trapdoorItem";
const root = path.resolve(".harness/fixtures/java-trapdoor-item-26.3");
const load = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
let checks = 0,
  failures = 0,
  corners = 0;
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (e) {
    failures++;
    if (failures < 4) console.error(name, e);
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 2e-6, `${a} != ${b}`);
}
for (const file of load("manifest.json").files)
  test("pinned item/display " + file.path, () => {
    const bytes = fs.readFileSync(path.join(root, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  });
test("actual item definition selects bottom model, whose parent chain supplies display", () => {
  const item = load("assets/minecraft/items/oak_trapdoor.json");
  assert.equal(item.model.type, "minecraft:model");
  assert.equal(item.model.model, "minecraft:block/oak_trapdoor_bottom");
  const world = JSON.parse(
    fs.readFileSync(
      ".harness/fixtures/java-trapdoor-26.3/assets/minecraft/models/block/template_trapdoor_bottom.json",
      "utf8",
    ),
  );
  assert.equal(world.parent, "block/thin_block");
  assert.equal(
    load("assets/minecraft/models/block/thin_block.json").parent,
    "block/block",
  );
});
test("GUI transform equals inherited block model, not arbitrary cube projection", () => {
  assert.deepEqual(
    TRAPDOOR_ITEM_DISPLAY.gui,
    load("assets/minecraft/models/block/block.json").display.gui,
  );
});
const normals = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ],
  ids = [68, 69, 70, 71, 72, ...Array.from({ length: 16 }, (_, i) => 503 + i)];
const key = (p: number[], face: number) =>
  face + ":" + p.map((v) => Math.round(v * 65536)).join(",");
for (const id of ids)
  test(`held/drop geometry ${id}: canonical bottom, all UVs and outward winding`, () => {
    const g = blockGeometry(id);
    try {
      g.computeBoundingBox();
      const b = g.boundingBox!;
      near(b.min.y, -0.5);
      near(b.max.y, -0.5 + 3 / 16);
      near(b.max.x - b.min.x, 1);
      near(b.max.z - b.min.z, 1);
      const p = g.getAttribute("position"),
        uv = g.getAttribute("uv"),
        normal = g.getAttribute("normal"),
        expected = trapdoorReference(503).out;
      assert.equal(p.count, 24);
      assert.equal(g.getIndex()!.count, 36);
      for (let i = 0; i < 24; i++) {
        const face = normals.findIndex((n) =>
          n.every((v, a) => Math.abs(v - normal.getComponent(i, a)) < 1e-6),
        );
        assert.ok(face >= 0);
        const ref = expected.get(
          key([p.getX(i) + 0.5, p.getY(i) + 0.5, p.getZ(i) + 0.5], face),
        );
        assert.ok(ref);
        const [u, v] = ref!,
          eps = 0.0004;
        near(
          uv.getX(i),
          ((T.trapdoor % 16) + u / 16) / 16 +
            (u === 0 ? eps : u === 16 ? -eps : 0),
        );
        near(
          uv.getY(i),
          1 -
            (Math.floor(T.trapdoor / 16) + v / 16) / 16 +
            (v === 0 ? -eps : v === 16 ? eps : 0),
        );
        corners++;
      }
      const index = g.getIndex()!;
      let area = 0;
      for (let i = 0; i < index.count; i += 3) {
        const points = [0, 1, 2].map((j) =>
          new THREE.Vector3().fromBufferAttribute(p, index.getX(i + j)),
        );
        const cross = points[1]
          .clone()
          .sub(points[0])
          .cross(points[2].clone().sub(points[0]));
        area += cross.length() / 2;
        const outward = points
          .reduce((sum, v) => sum.add(v), new THREE.Vector3())
          .multiplyScalar(1 / 3)
          .sub(new THREE.Vector3(0, -13 / 32, 0));
        assert.ok(cross.dot(outward) > 0);
      }
      near(area, 2.75);
    } finally {
      g.dispose();
    }
  });
test("all hidden world state aliases produce one canonical item mesh", () => {
  const geos = ids.map(blockGeometry);
  try {
    for (const g of geos)
      assert.deepEqual(meshFingerprint([g]), meshFingerprint([geos[0]]));
  } finally {
    geos.forEach((g) => g.dispose());
  }
});
for (const f of trapdoorIconFaces())
  test(`GUI face ${f.face}: affine map preserves all four reversed UV corners`, () => {
    const [a, b, c, d, e, g] = iconFaceTransform(f.uv, f.screen);
    for (let k = 0; k < 4; k++) {
      const [u, v] = f.uv[k];
      near(a * u + c * v + e, f.screen[k][0]);
      near(b * u + d * v + g, f.screen[k][1]);
    }
  });
test("GUI projection follows native display on reference positions; only outward visible faces", () => {
  const display = load("assets/minecraft/models/block/block.json").display.gui;
  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        ...(display.rotation.map((v: number) => (v * Math.PI) / 180) as [
          number,
          number,
          number,
        ]),
        "XYZ",
      ),
    ),
  );
  const ref = trapdoorReference(503).out;
  assert.deepEqual(
    trapdoorIconFaces()
      .map((f) => f.face)
      .sort(),
    [1, 3, 4],
  );
  for (const f of trapdoorIconFaces())
    for (let i = 0; i < 4; i++) {
      const p = f.points[i];
      assert.deepEqual(ref.get(key(p, f.face)), f.uv[i]);
      const projected = new THREE.Vector3(p[0] - 0.5, p[1] - 0.5, p[2] - 0.5)
        .multiply(
          new THREE.Vector3(...(display.scale as [number, number, number])),
        )
        .applyMatrix4(matrix);
      near(f.screen[i][0], 24 + 48 * projected.x);
      near(f.screen[i][1], 24 - 48 * projected.y);
    }
});
test("icon painting isolates alpha shading per face and restores caller context", () => {
  const old = (globalThis as any).document;
  let saved = 0,
    restored = 0,
    cleared = 0,
    layerDraws = 0,
    composites = 0;
  const paint: any = {
    imageSmoothingEnabled: true,
    setTransform() {},
    clearRect() {
      cleared++;
    },
    drawImage() {
      layerDraws++;
    },
    fillRect() {
      assert.equal(paint.globalCompositeOperation, "source-atop");
    },
  };
  (globalThis as any).document = {
    createElement: () => ({ getContext: () => paint }),
  };
  const ctx: any = {
    save() {
      saved++;
    },
    restore() {
      restored++;
    },
    setTransform() {},
    drawImage() {
      composites++;
    },
  };
  try {
    drawTrapdoorIcon(ctx, {} as HTMLCanvasElement, T.trapdoor);
    assert.equal(saved, 1);
    assert.equal(restored, 1);
    assert.equal(cleared, 3);
    assert.equal(layerDraws, 3);
    assert.equal(composites, 3);
    assert.equal(paint.globalCompositeOperation, "source-over");
  } finally {
    if (old === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = old;
  }
});
test("real updateHand builds main/offhand thin meshes with cutout material", () => {
  const inventory = new Inventory();
  inventory.slots[0] = { id: B.TRAP, count: 8 };
  inventory.offhand = { id: B.TRAP, count: 1 };
  const material = new THREE.MeshBasicMaterial({ alphaTest: 0.3 }),
    g: any = Object.assign(Object.create(Game.prototype), {
      inventory,
      selected: 0,
      handId: -999,
      offHandId: -999,
      hand: new THREE.Group(),
      offHand: new THREE.Group(),
      handMat: material,
    });
  g.updateHand();
  for (const m of [g.handMesh, g.offHandMesh]) {
    m.geometry.computeBoundingBox();
    near(m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y, 3 / 16);
    assert.equal(m.material, material);
    assert.ok(m.material.alphaTest > 0);
    m.geometry.dispose();
  }
  material.dispose();
  assert.equal(inventory.slots[0]!.count, 8);
  assert.equal(inventory.offhand!.count, 1);
});
test("real spawnDrop reuses thin geometry without changing count/delay or inventory", () => {
  const material = new THREE.MeshBasicMaterial({ alphaTest: 0.4 }),
    g: any = Object.assign(Object.create(Game.prototype), {
      scene: new THREE.Scene(),
      drops: [],
      dropGeos: new Map(),
      dropMat: material,
    });
  g.spawnDrop(
    B.TRAP,
    2,
    1,
    100,
    1,
    undefined,
    0,
    0,
    0,
    undefined,
    undefined,
    undefined,
    2,
  );
  g.spawnDrop(B.TRAP, 3, 2, 100, 1, undefined, 0, 0, 0);
  assert.equal(g.drops.length, 2);
  assert.equal(g.drops[0].count, 2);
  assert.equal(g.drops[0].pickupDelay, 2);
  assert.equal(g.drops[1].count, 3);
  const a = g.drops[0].mesh,
    b = g.drops[1].mesh;
  assert.equal(a.geometry, b.geometry);
  a.geometry.computeBoundingBox();
  near(a.geometry.boundingBox.max.y - a.geometry.boundingBox.min.y, 3 / 16);
  assert.ok(a.material.alphaTest > 0);
  a.geometry.dispose();
  material.dispose();
});
console.log(
  `Trap item: ${checks} groups passed, ${failures} failed, ${corners}/504 UV pairs matched`,
);
if (failures) process.exitCode = 1;
