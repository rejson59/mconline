import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { Game, blockGeometry } from "../src/game/engine";
import { B, BLOCKS } from "../src/game/blocks";
import { I, ITEMS, isItem } from "../src/game/items";
import { spriteItemGeometry } from "../src/game/spriteItem";
import { meshFingerprint } from "./meshFingerprint";

// Canvas only creates the nameplate/fallback skin; real packed skins and item
// silhouettes still decode their actual bytes. No WebGL or real account here.
const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    createElement: () => {
      const canvas: any = { width: 64, height: 64, toDataURL: () => "data:," };
      const ctx: any = new Proxy(
        {
          canvas,
          measureText: () => ({ width: 32 }),
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
          createImageData: (w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
          createLinearGradient: () => ({ addColorStop() {} }),
          createRadialGradient: () => ({ addColorStop() {} }),
        },
        { get: (o, k) => (o as any)[k] ?? (() => {}) },
      );
      canvas.getContext = () => ctx;
      return canvas;
    },
  },
});
let passed = 0,
  failed = 0,
  vertices = 0,
  registered = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    if (failed < 5) console.error(name, e);
  }
}
function near(a: number, b: number) {
  assert.ok(Math.abs(a - b) < 4e-6, `${a} != ${b}`);
}
function game() {
  const atlas = new THREE.Texture(),
    textures = new Map<number, THREE.Texture>();
  const g: any = Object.assign(Object.create(Game.prototype), {
    atlasTex: atlas,
    handMat: new THREE.MeshBasicMaterial({
      map: atlas,
      vertexColors: true,
      alphaTest: 0.3,
    }),
    icons: {},
    itemTex: textures,
    remotes: new Map(),
    remoteGroup: new THREE.Group(),
    netPlayers: [],
  });
  g.itemTexture = (id: number) => {
    if (!textures.has(id)) textures.set(id, new THREE.Texture());
    return textures.get(id);
  };
  return g;
}
function avatar(g: any, skin = "steve") {
  const a = g.makeAvatar("Synthetic", 20, skin);
  g.remotes.set("peer", a);
  g.remoteGroup.add(a.group);
  return a;
}
function cleanup(g: any) {
  for (const id of [...g.remotes.keys()]) g.dropRemote(id);
  g.handMat.dispose();
  g.atlasTex.dispose();
  for (const t of g.itemTex.values()) t.dispose();
}
function rotate(point: number[], angles: number[]) {
  let [x, y, z] = point;
  for (const axis of [2, 1, 0]) {
    const r = (angles[axis] * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r);
    if (axis === 2) [x, y] = [c * x - s * y, s * x + c * y];
    else if (axis === 1) [x, z] = [c * x + s * z, -s * x + c * z];
    else [y, z] = [c * y - s * z, s * y + c * z];
  }
  return [x, y, z];
}
const fixture =
  ".harness/fixtures/java-trapdoor-item-26.3/assets/minecraft/models/block/";
const base = JSON.parse(
  fs.readFileSync(fixture + "block.json", "utf8"),
).display;
const thin = {
  ...base,
  ...JSON.parse(fs.readFileSync(fixture + "thin_block.json", "utf8")).display,
};
function inspectWorld(a: any, id: number, left: boolean, slim: boolean) {
  const mesh = left ? a.offHand : a.hand,
    arm = left ? a.armL : a.armR,
    d = ((id >= 68 && id <= 72) || (id >= 503 && id <= 518) ? thin : base)
      .thirdperson_righthand,
    sign = left ? -1 : 1;
  a.group.updateMatrixWorld(true);
  const p = mesh.geometry.getAttribute("position");
  assert.equal(mesh.parent, arm);
  assert.ok(
    mesh.matrixWorld.determinant() > 0,
    "left hand must not mirror scale/winding",
  );
  const armX = (left ? -1 : 1) * (0.25 + (slim ? 0.1875 : 0.25) / 2);
  for (let i = 0; i < p.count; i++) {
    let expected = rotate(
      [p.getX(i) * d.scale[0], p.getY(i) * d.scale[1], p.getZ(i) * d.scale[2]],
      [d.rotation[0], sign * d.rotation[1], sign * d.rotation[2]],
    );
    expected = expected.map(
      (v, k) => v + (d.translation[k] / 16) * (k === 0 ? sign : 1),
    );
    expected = expected.map((v, k) => v + [0, 0.82 - 1.125, -0.26][k]);
    expected = rotate(expected, [(arm.rotation.x * 180) / Math.PI, 0, 0]).map(
      (v, k) => v + [armX, 1.125, 0][k],
    );
    expected = expected.map((v) => v * 0.9375);
    expected = rotate(expected, [
      0,
      (a.group.rotation.y * 180) / Math.PI,
      0,
    ]).map((v, k) => v + a.group.position.getComponent(k));
    const actual = new THREE.Vector3(
      p.getX(i),
      p.getY(i),
      p.getZ(i),
    ).applyMatrix4(mesh.matrixWorld);
    [actual.x, actual.y, actual.z].forEach((v, k) => near(v, expected[k]));
    vertices++;
  }
}
const native = [
  B.STONE,
  B.COBBLE,
  B.DIRT,
  B.PLANKS,
  B.SAND,
  68,
  69,
  70,
  71,
  72,
  ...Array.from({ length: 16 }, (_, i) => 503 + i),
];
try {
  for (const skin of ["steve", "alex"])
    for (const id of native)
      test(`${skin} reference local display in both moving arms ${id}`, () => {
        const g = game();
        try {
          const a = avatar(g, skin);
          a.held = a.offhand = id;
          g.updateRemoteHeld(a);
          a.group.position.set(10, 65, 20);
          a.group.rotation.y = 0.37;
          a.armR.rotation.x = 0.31;
          a.armL.rotation.x = -0.27;
          inspectWorld(a, id, false, skin === "alex");
          inspectWorld(a, id, true, skin === "alex");
          assert.notEqual(a.hand.geometry, a.offHand.geometry);
          assert.notEqual(a.hand.material, a.offHand.material);
        } finally {
          cleanup(g);
        }
      });
  test("resting main-hand world anchor remains identical to the pre-attachment anchor", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = B.TRAP;
      g.updateRemoteHeld(a);
      a.group.updateMatrixWorld(true);
      const expected = new THREE.Mesh(a.hand.geometry, a.hand.material);
      expected.position.set(0.375, 0.82, -0.26);
      const d = thin.thirdperson_righthand;
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(0, d.translation[1] / 16, d.translation[2] / 16),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            (d.rotation[0] * Math.PI) / 180,
            (d.rotation[1] * Math.PI) / 180,
            0,
          ),
        ),
        new THREE.Vector3(...(d.scale as [number, number, number])),
      );
      expected.updateMatrix();
      const matrix = new THREE.Matrix4()
        .makeScale(0.9375, 0.9375, 0.9375)
        .multiply(expected.matrix)
        .multiply(local);
      a.hand.matrixWorld.elements.forEach((v: number, i: number) =>
        near(v, matrix.elements[i]),
      );
    } finally {
      cleanup(g);
    }
  });
  test("changing only the offhand neither rebuilds nor disposes the main hand", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = B.STONE;
      a.offhand = B.TRAP;
      g.updateRemoteHeld(a);
      const geo = a.hand.geometry,
        mat = a.hand.material;
      let disposed = 0;
      geo.addEventListener("dispose", () => disposed++);
      a.offhand = B.PLANKS;
      g.updateRemoteHeld(a);
      assert.equal(a.hand.geometry, geo);
      assert.equal(a.hand.material, mat);
      assert.equal(disposed, 0);
      assert.equal(a.offhandId, B.PLANKS);
    } finally {
      cleanup(g);
    }
  });
  test("unchanged packet IDs reuse meshes/materials while the arms move", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = I.DIAMOND_SWORD;
      a.offhand = I.APPLE;
      g.updateRemoteHeld(a);
      const before = [
        a.hand.geometry,
        a.hand.material,
        a.offHand.geometry,
        a.offHand.material,
      ];
      a.group.updateMatrixWorld(true);
      const matrix = a.hand.matrixWorld.clone();
      for (let i = 0; i < 100; i++) {
        a.armR.rotation.x = i * 0.003;
        a.armL.rotation.x = -i * 0.003;
        g.updateRemoteHeld(a);
      }
      a.group.updateMatrixWorld(true);
      assert.deepEqual(
        [
          a.hand.geometry,
          a.hand.material,
          a.offHand.geometry,
          a.offHand.material,
        ],
        before,
      );
      assert.notDeepEqual(a.hand.matrixWorld.elements, matrix.elements);
      assert.equal(g.itemTex.size, 2);
    } finally {
      cleanup(g);
    }
  });
  test("empty or malformed packet hands are invisible and allocate no textures", () => {
    const g = game();
    try {
      const a = avatar(g);
      for (const id of [
        0,
        -1,
        NaN,
        Infinity,
        1.1,
        999999,
        "3",
        null,
        undefined,
        {},
        true,
      ]) {
        a.held = a.offhand = id;
        g.updateRemoteHeld(a);
        assert.equal(a.hand.visible, false);
        assert.equal(a.offHand.visible, false);
        assert.equal(a.heldId, 0);
        assert.equal(a.offhandId, 0);
      }
      assert.equal(g.itemTex.size, 0);
    } finally {
      cleanup(g);
    }
  });
  test("dead hands disappear and a live packet with unchanged IDs restores them", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = B.STONE;
      a.offhand = B.TRAP;
      g.updateRemoteHeld(a);
      const geo = a.offHand.geometry;
      a.alive = false;
      g.updateRemoteHeld(a);
      assert.equal(a.hand.visible, false);
      assert.equal(a.offHand.visible, false);
      a.alive = true;
      g.updateRemoteHeld(a);
      assert.equal(a.hand.visible, true);
      assert.equal(a.offHand.visible, true);
      assert.equal(a.offHand.geometry, geo);
    } finally {
      cleanup(g);
    }
  });
  test("all registered IDs produce their actual block/sprite geometry in both hands", () => {
    const g = game();
    try {
      const a = avatar(g),
        ids = new Set([
          ...BLOCKS.flatMap((b, id) => (b && id > 0 ? [id] : [])),
          ...ITEMS.flatMap((item, id) => (item ? [id] : [])),
        ]);
      for (const id of ids) {
        a.held = a.offhand = id;
        g.updateRemoteHeld(a);
        const expected = isItem(id)
          ? spriteItemGeometry(id)
          : blockGeometry(id);
        try {
          for (const mesh of [a.hand, a.offHand]) {
            assert.equal(mesh.visible, true);
            assert.deepEqual(
              meshFingerprint([mesh.geometry]),
              meshFingerprint([expected]),
            );
            for (const attr of ["position", "uv"])
              for (const value of mesh.geometry.getAttribute(attr).array)
                assert.ok(Number.isFinite(value));
            assert.equal(mesh.material.userData.borrowedMap, true);
          }
        } finally {
          expected.dispose();
        }
        registered++;
      }
    } finally {
      cleanup(g);
    }
  });
  test("sprite and bed maps survive avatar teardown while owned nameplate textures retire", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = I.DIAMOND_SWORD;
      a.offhand = B.BED;
      g.updateRemoteHeld(a);
      const icon = a.hand.material.map,
        bed = a.offHand.material.map;
      let icons = 0,
        beds = 0,
        labels = 0,
        geos = 0,
        mats = 0;
      icon.addEventListener("dispose", () => icons++);
      bed.addEventListener("dispose", () => beds++);
      a.group.children
        .find((o: any) => o instanceof THREE.Sprite)
        .material.map.addEventListener("dispose", () => labels++);
      for (const mesh of [a.hand, a.offHand]) {
        mesh.geometry.addEventListener("dispose", () => geos++);
        mesh.material.addEventListener("dispose", () => mats++);
      }
      g.dropRemote("peer");
      assert.equal(icons, 0);
      assert.equal(beds, 0);
      assert.equal(labels, 1);
      assert.equal(geos, 2);
      assert.equal(mats, 2);
    } finally {
      cleanup(g);
    }
  });
  test("removing one player cannot dispose a packed skin used by another player", () => {
    const g = game();
    try {
      const a = avatar(g),
        b = g.makeAvatar("Second", 30, "steve");
      g.remotes.set("second", b);
      g.remoteGroup.add(b.group);
      const skin = a.armR.material.map;
      assert.equal(skin, b.armR.material.map);
      let disposed = 0;
      skin.addEventListener("dispose", () => disposed++);
      g.dropRemote("peer");
      assert.equal(disposed, 0);
      assert.equal(b.armR.material.map, skin);
      assert.ok(skin.image.data.length > 0);
    } finally {
      cleanup(g);
    }
  });
  test("skin replacement preserves both held IDs, heading and animation pose", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = I.DIAMOND_SWORD;
      a.offhand = B.TRAP;
      a.group.position.set(3, 65, 4);
      a.group.rotation.y = 0.4;
      a.armR.rotation.x = 0.3;
      a.armL.rotation.x = -0.2;
      a.head.rotation.x = 0.1;
      a.walk = 2;
      a.swing = 0.4;
      g.updateRemoteHeld(a);
      const map = a.hand.material.map;
      let disposed = 0;
      map.addEventListener("dispose", () => disposed++);
      g.setRemoteSkin("peer", "alex");
      const b = g.remotes.get("peer");
      assert.notEqual(a, b);
      assert.equal(b.held, I.DIAMOND_SWORD);
      assert.equal(b.offhand, B.TRAP);
      assert.equal(b.hand.parent, b.armR);
      assert.equal(b.offHand.parent, b.armL);
      assert.equal(b.hand.visible, true);
      assert.equal(b.offHand.visible, true);
      near(b.group.rotation.y, 0.4);
      near(b.armR.rotation.x, 0.3);
      near(b.armL.rotation.x, -0.2);
      near(b.head.rotation.x, 0.1);
      assert.equal(b.walk, 2);
      assert.equal(b.swing, 0.4);
      assert.equal(b.hand.material.map, map);
      assert.equal(disposed, 0);
    } finally {
      cleanup(g);
    }
  });
  test("actual tickNet animates both arms in opposite phases and carries both items", () => {
    const g = game();
    try {
      const a = avatar(g);
      a.held = B.STONE;
      a.offhand = B.TRAP;
      g.updateRemoteHeld(a);
      a.track = {
        sample: () => ({ x: 2, y: 65, z: 3, yaw: 0.2, pitch: 0.1, speed: 3.2 }),
      };
      Object.assign(g, {
        net: { tick() {}, public: true },
        syncPublicClock() {},
        netEditTimer: 0,
        dropSyncTimer: 0,
        netPosTimer: 0,
        body: { pos: new THREE.Vector3(2, 65, 3) },
        combatPlayers: new Map(),
        entityDistance: 1,
        isInNether: false,
      });
      g.tickNet(0.016);
      assert.ok(a.armR.rotation.x > 0);
      near(a.armL.rotation.x, -a.armR.rotation.x);
      near(a.group.rotation.y, 0.2);
      assert.equal(a.group.visible, true);
      assert.equal(a.hand.parent, a.armR);
      assert.equal(a.offHand.parent, a.armL);
    } finally {
      cleanup(g);
    }
  });
} finally {
  if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
  else Reflect.deleteProperty(globalThis, "document");
}
console.log(
  `Remote hands: ${passed} groups passed, ${failed} failed, ${vertices} world vertices compared, ${registered} registered IDs checked in both hands`,
);
if (failed) process.exitCode = 1;
