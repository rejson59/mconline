import { Matrix4, Euler, Vector3 } from "three";
/** Production build, fresh guest-only profiles. No real accounts or multiplayer.
 * Browser tools: npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start production preview, then npm run test:browser:panels.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
const tools = path.resolve(
  process.env.BROWSER_TOOLS ?? path.join(root, ".cache/browser-tools"),
);
const resolve = createRequire(path.join(tools, "package.json")).resolve;
const { default: puppeteer } = await import(
  pathToFileURL(resolve("puppeteer-core")).href
);
const { default: chromium } = await import(
  pathToFileURL(resolve("@sparticuz/chromium")).href
);
const libs = path.join(tools, "al2023");
if (!fs.existsSync(libs)) {
  fs.mkdirSync(libs, { recursive: true });
  const tar = path.join(tools, "al2023.tar");
  fs.writeFileSync(
    tar,
    brotliDecompressSync(
      fs.readFileSync(
        path.join(tools, "node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
      ),
    ),
  );
  execFileSync("tar", ["xf", tar, "-C", libs]);
  fs.unlinkSync(tar);
}
const output = path.join(
  root,
  process.env.BROWSER_CUBE_POSE
    ? ".cache/verification439"
    : process.env.BROWSER_TRAP_POSE
      ? ".cache/verification438"
      : process.env.BROWSER_TRAP_ITEM
        ? ".cache/verification436"
        : process.env.BROWSER_TRAP_UV
          ? ".cache/verification435"
          : process.env.BROWSER_TRAPS
            ? ".cache/verification434"
            : ".cache/verification433",
);
fs.mkdirSync(output, { recursive: true });
const enums = path.join(output, "blocks.mjs");
await build({
  stdin: {
    contents:
      "export {B,T} from './src/game/blocks'; export { trapdoorReference } from './.harness/trapdoorReference'; export { decodePng } from './src/game/art/miniPng';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: enums,
});
const { B, T, trapdoorReference, decodePng } = await import(
  pathToFileURL(enums).href
);
const cubeDisplayReferences = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".harness/fixtures/java-trapdoor-item-26.3/assets/minecraft/models/block/block.json",
    ),
    "utf8",
  ),
).display;
const displayReferences = Object.assign(
  {},
  ...["block", "thin_block"].map(
    (name) =>
      JSON.parse(
        fs.readFileSync(
          path.join(
            root,
            ".harness/fixtures/java-trapdoor-item-26.3/assets/minecraft/models/block/" +
              name +
              ".json",
          ),
          "utf8",
        ),
      ).display,
  ),
);
const expectedUVs = [
  68,
  69,
  70,
  71,
  72,
  ...Array.from({ length: 16 }, (_, i) => 503 + i),
].map((id) => ({ id, vertices: [...trapdoorReference(id).out] }));
const pixels = Array.from(
  decodePng(
    fs
      .readFileSync(
        path.join(
          root,
          ".harness/fixtures/java-trapdoor-26.3/assets/minecraft/textures/block/oak_trapdoor.png",
        ),
      )
      .toString("base64"),
  ).data,
);
const itemDisplay = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".harness/fixtures/java-trapdoor-item-26.3/assets/minecraft/models/block/block.json",
    ),
    "utf8",
  ),
).display.gui;
const rotation = new Matrix4().makeRotationFromEuler(
  new Euler(...itemDisplay.rotation.map((v) => (v * Math.PI) / 180), "XYZ"),
);
const itemProject = (x, y, z) =>
  new Vector3(x - 0.5, y - 0.5, z - 0.5)
    .applyMatrix4(rotation)
    .multiplyScalar(itemDisplay.scale[0]);
const projected = expectedUVs
  .find((r) => r.id === 503)
  .vertices.flatMap(([key]) => {
    const [face, coords] = key.split(":"),
      normal = [
        [-1, 0, 0],
        [1, 0, 0],
        [0, -1, 0],
        [0, 1, 0],
        [0, 0, -1],
        [0, 0, 1],
      ][+face];
    if (new Vector3(...normal).applyMatrix4(rotation).z <= 0) return [];
    const v = itemProject(...coords.split(",").map((n) => Number(n) / 65536));
    return [[24 + 48 * v.x, 24 - 48 * v.y]];
  });
const itemBounds = [
  Math.min(...projected.map((p) => p[0])),
  Math.min(...projected.map((p) => p[1])),
  Math.max(...projected.map((p) => p[0])),
  Math.max(...projected.map((p) => p[1])),
];
const alphaProbes = [];
for (let u = 2; u < 14; u++)
  for (let v = 2; v < 14; v++) {
    const alpha = pixels[(v * 16 + u) * 4 + 3];
    if (![0, 255].includes(alpha)) continue;
    if (
      [-1, 0, 1].some((dx) =>
        [-1, 0, 1].some(
          (dy) => pixels[((v + dy) * 16 + u + dx) * 4 + 3] !== alpha,
        ),
      )
    )
      continue;
    const p = itemProject((u + 0.5) / 16, 3 / 16, (v + 0.5) / 16);
    alphaProbes.push([
      Math.floor(24 + 48 * p.x),
      Math.floor(24 - 48 * p.y),
      alpha,
    ]);
  }
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((arg) => arg !== "--single-process"),
  headless: true,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const reports = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.createBrowserContext(),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const viewport = mobile
      ? { width: 844, height: 390, isMobile: true, hasTouch: true }
      : { width: 960, height: 600 };
    await p.setViewport(viewport);
    await p.evaluateOnNewDocument((mobile) => {
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          controlMode: mobile ? "touch" : "desktop",
          guiScale: 0,
          renderDistance: 2,
          volume: 0,
          fpsCap: 30,
          fpsCapUserSet: true,
          autoQuality: false,
          lod: false,
          autoJump: false,
        }),
      );
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "panels433",
            name: "Audyt włazów i drzwi",
            seed: 433,
            mode: "creative",
            worldType: "flat",
            mods: {},
            pos: [7.5, 65, 9.5],
            yaw: 0,
            pitch: 0,
            inv: Array(36).fill(null),
            time: 0.25,
            health: 20,
            day: 1,
            updated: 1,
          },
        ]),
      );
    }, mobile);
    await p.goto(process.env.BROWSER_URL ?? "http://127.0.0.1:4173/", {
      waitUntil: "domcontentloaded",
    });
    await p.waitForFunction(
      (version) => document.body.innerText.includes("przeglądarka " + version),
      {},
      version,
    );
    const click = (label) =>
      p.evaluate((label) => {
        const button = [...document.querySelectorAll("button")].find(
          (e) => e.textContent?.trim() === label,
        );
        if (!button) throw Error("Missing button " + label);
        button.click();
      }, label);
    await click("Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click("Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    const join = await p.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((e) =>
        ["Dołącz do świata", "Dotknij, aby grać"].includes(
          e.textContent?.trim(),
        ),
      );
      if (!button) return false;
      button.id = "panels-audit-join";
      return true;
    });
    if (join) await p.click("#panels-audit-join");
    await p.waitForFunction(() => window.minecraft.game.ui === "playing");
    await p.evaluate(() => cancelAnimationFrame(window.minecraft.game.raf));
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 15000,
    });
    const report = await p.evaluate(
      ({ B, T, expectedUVs, pixels }) => {
        const g = window.minecraft.game,
          w = g.world,
          y = 65;
        g.ui = "playing";
        g.autoJump = false;
        g.flying = false;
        g.mobs = [];
        for (let x = 2; x <= 16; x++)
          for (let z = 3; z <= 11; z++)
            for (let h = 64; h <= 69; h++)
              w.setBlock(x, h, z, h === 64 ? B.STONE : B.AIR);
        const panels = [];
        const walk = (axis, parallel = false) => {
          g.body.pos.set(parallel ? 5.5 : 4, y, parallel ? 4 : 5.5);
          if (axis === 2)
            g.body.pos.set(parallel ? 4 : 5.5, y, parallel ? 5.5 : 4);
          g.body.vel.set(0, 0, 0);
          g.body.onGround = true;
          g.yaw = 0;
          g.keys.clear();
          g.keys.add((axis === 0) !== parallel ? "KeyD" : "KeyS");
          for (let i = 0; i < 90; i++) g.updatePlayer(1 / 60);
          g.keys.clear();
          return {
            x: g.body.pos.x,
            z: g.body.pos.z,
            y: g.body.pos.y,
            hitWall: g.body.hitWall,
          };
        };
        for (const [id, axis, lo] of [
          [B.TRAP_N, 2, 0],
          [B.TRAP_E, 0, 13 / 16],
          [B.TRAP_S, 2, 13 / 16],
          [B.TRAP_W, 0, 0],
        ]) {
          w.setBlock(5, y, 5, id);
          const origin = [5.5, y + 0.5, 5.5],
            direction = [0, 0, 0];
          origin[axis] = 4;
          direction[axis] = 1;
          const hit = w.raycast(...origin, ...direction, 3);
          if (hit?.id !== id || Math.abs(hit.dist - 1 - lo) > 1e-6)
            throw Error("Wing ray misses actual surface");
          const tangent = axis === 0 ? 2 : 0;
          origin[axis] = 5.5;
          origin[tangent] = 4;
          direction[axis] = 0;
          direction[tangent] = 1;
          if (w.raycast(...origin, ...direction, 3))
            throw Error("Empty trap cell blocks targeting");
          const blocked = walk(axis),
            gap = walk(axis, true),
            position = axis === 0 ? blocked.x : blocked.z;
          if (Math.abs(position - (5 + lo - 0.3)) > 0.001 || !blocked.hitWall)
            throw Error("Walking through open wing " + JSON.stringify(blocked));
          if ((axis === 0 ? gap.z : gap.x) < 6.5 || Math.abs(gap.y - y) > 0.001)
            throw Error("Trap gap blocks movement");
          g.updateBuildingTarget(id, 5, y, 5);
          g.selection.geometry.computeBoundingBox();
          const bounds = g.selection.geometry.boundingBox;
          if (
            Math.abs(
              (axis === 0
                ? bounds.max.x - bounds.min.x
                : bounds.max.z - bounds.min.z) -
                (3 / 16) * 1.004,
            ) > 1e-5
          )
            throw Error("Trap outline remains cube");
          panels.push({ id, rayDistance: hit.dist, blocked, gap });
        }
        w.setBlock(5, y, 5, B.TRAP);
        const closed = w.raycast(5.5, y + 3, 5.5, 0, -1, 0, 4);
        if (closed?.id !== B.TRAP || Math.abs(closed.dist - 2) > 1e-6)
          throw Error("Closed trap top target mismatch");
        // All facing/hinge/half/open combinations must target the visible slab.
        let doors = 0;
        for (const base of [
          B.DOOR_N,
          B.DOOR_ON,
          B.DOOR_UN,
          B.DOOR_UON,
          B.DOOR_RN,
          B.DOOR_ORN,
          B.DOOR_URN,
          B.DOOR_UORN,
        ])
          for (let f = 0; f < 4; f++) {
            const id = base + f;
            w.setBlock(5, y, 5, id);
            g.updateBuildingTarget(id, 5, y, 5);
            g.selection.geometry.computeBoundingBox();
            const b = g.selection.geometry.boundingBox,
              axis = b.max.x - b.min.x < 0.5 ? 0 : 2,
              tangent = axis === 0 ? 2 : 0;
            const origin = [5.5, y + 0.5, 5.5],
              direction = [0, 0, 0];
            origin[axis] = 4;
            direction[axis] = 1;
            if (w.raycast(...origin, ...direction, 3)?.id !== id)
              throw Error("Door panel unselectable");
            origin[axis] = 5.5;
            origin[tangent] = 4;
            direction[axis] = 0;
            direction[tangent] = 1;
            if (w.raycast(...origin, ...direction, 3))
              throw Error("Door gap still selected");
            if (
              Math.abs(
                (axis === 0 ? b.max.x - b.min.x : b.max.z - b.min.z) -
                  (3 / 16) * 1.004,
              ) > 1e-5
            )
              throw Error("Door outline remains cube");
            doors++;
          }
        const modernStates = [];
        for (let state = 0; state < 16; state++) {
          const id = B.TRAP_BOTTOM_N + state,
            open = !!(state & 8),
            top = !!(state & 4),
            face = state % 4,
            axis = open ? (face % 2 ? 0 : 2) : 1;
          w.setBlock(5, y, 5, id);
          g.updateBuildingTarget(id, 5, y, 5);
          g.selection.geometry.computeBoundingBox();
          const b = g.selection.geometry.boundingBox;
          if (
            Math.abs(
              b.max.getComponent(axis) -
                b.min.getComponent(axis) -
                (3 / 16) * 1.004,
            ) > 1e-5
          )
            throw Error("New state outline missing " + id);
          const origin = [5.5, y + 0.5, 5.5],
            direction = [0, 0, 0];
          origin[axis] = axis === 1 ? y + 2 : 4;
          direction[axis] = axis === 1 ? -1 : 1;
          const hit = w.raycast(...origin, ...direction, 3);
          const expected =
            axis === 1
              ? top
                ? 1
                : 2 - 3 / 16
              : 1 + (face === 1 || face === 2 ? 13 / 16 : 0);
          if (hit?.id !== id || Math.abs(hit.dist - expected) > 1e-5)
            throw Error("New state ray missing " + id);
          if (open) {
            const blocked = walk(axis),
              gap = walk(axis, true),
              expectedContact =
                5 + (face === 1 || face === 2 ? 13 / 16 : 0) - 0.3;
            if (
              Math.abs((axis === 0 ? blocked.x : blocked.z) - expectedContact) >
                0.001 ||
              !blocked.hitWall
            )
              throw Error("New wing lacks physics " + id);
            if ((axis === 0 ? gap.z : gap.x) < 6.5)
              throw Error("New wing gap blocks player " + id);
          }
          modernStates.push({ id, rayDistance: hit.dist });
        }
        // Actual player eye/aim and production tryUse: no substituted target ray.
        w.setBlock(5, y, 5, B.AIR);
        g.aimDir = null;
        g.inventory.offhand = null;
        g.inventory.slots.fill(null);
        g.inventory.slots[0] = { id: B.TRAP, count: 8 };
        g.selected = 0;
        g.body.pos.set(12.5, y, 8);
        g.body.vel.set(0, 0, 0);
        g.yaw = 0;
        g.pitch = -Math.atan2(g.eyeHeight, 2.5);
        g.updateCamera(0.016);
        const floorTarget = g.raycastTarget();
        if (
          floorTarget?.ny !== 1 ||
          floorTarget.x !== 12 ||
          floorTarget.z !== 5
        )
          throw Error("Floor placement ray wrong");
        g.tryUse();
        const floorPlaced = w.getBlock(12, y, 5);
        if (floorPlaced !== B.TRAP_BOTTOM_N)
          throw Error("Floor did not place closed lower trap");
        g.tryUse();
        if (w.getBlock(12, y, 5) !== B.TRAP_OPEN_BOTTOM_N)
          throw Error("Floor trap lost half on opening");
        g.pitch = -Math.atan2(g.eyeHeight - 0.5, 8 - (5 + 3 / 16));
        g.updateCamera(0.016);
        if (g.raycastTarget()?.id !== B.TRAP_OPEN_BOTTOM_N)
          throw Error("Cannot aim at rotated lower wing");
        g.tryUse();
        const closedAgain = w.getBlock(12, y, 5);
        if (closedAgain !== floorPlaced)
          throw Error("Lower trap lost direction/half on closing");
        w.setBlock(14, y + 2, 5, B.STONE);
        g.body.pos.set(14.5, y, 8);
        g.pitch = Math.atan2(2 - g.eyeHeight, 2.5);
        g.updateCamera(0.016);
        const ceilingTarget = g.raycastTarget();
        if (
          ceilingTarget?.ny !== -1 ||
          ceilingTarget.x !== 14 ||
          ceilingTarget.z !== 5
        )
          throw Error("Ceiling placement ray wrong");
        g.tryUse();
        const ceilingPlaced = w.getBlock(14, y + 1, 5);
        if (ceilingPlaced !== B.TRAP_TOP_N)
          throw Error("Underside did not place upper trap");
        w.setBlock(12, y, 5, B.AIR);
        w.setBlock(14, y + 1, 5, B.AIR);
        w.setBlock(14, y + 2, 5, B.AIR);
        g.inventory.slots.fill(null);
        w.setBlock(5, y, 5, B.AIR);
        let matchedUVs = 0;
        for (const { id, vertices } of expectedUVs) {
          w.setBlock(5, 90, 5, id);
          const meshes = w.buildMesh(w.getChunk(0, 0));
          try {
            const ref = new Map(vertices);
            let count = 0;
            for (const [layer, mesh] of meshes.entries()) {
              const p = mesh.getAttribute("position"),
                uv = mesh.getAttribute("uv"),
                f = mesh.getAttribute("aFace");
              if (!p) continue;
              for (let i = 0; i < p.count; i++) {
                if (
                  p.getX(i) < 5 ||
                  p.getX(i) > 6 ||
                  p.getY(i) < 90 ||
                  p.getY(i) > 91 ||
                  p.getZ(i) < 5 ||
                  p.getZ(i) > 6
                )
                  continue;
                const key =
                  f.getX(i) +
                  ":" +
                  [p.getX(i) - 5, p.getY(i) - 90, p.getZ(i) - 5]
                    .map((n) => Math.round(n * 65536))
                    .join(",");
                if (layer !== 1 || g.materials[layer].alphaTest !== 0.5)
                  throw Error("Trap holes use opaque material");
                const point = ref.get(key);
                if (!point)
                  throw Error("Unmatched trap vertex " + id + " " + key);
                const [u, v] = point,
                  eps = 0.0004,
                  U =
                    ((T.trapdoor % 16) + u / 16) / 16 +
                    (u === 0 ? eps : u === 16 ? -eps : 0),
                  V =
                    1 -
                    (Math.floor(T.trapdoor / 16) + v / 16) / 16 +
                    (v === 0 ? -eps : v === 16 ? eps : 0);
                if (
                  Math.abs(uv.getX(i) - U) > 2e-6 ||
                  Math.abs(uv.getY(i) - V) > 2e-6
                )
                  throw Error("Reference UV mismatch " + id + " " + key);
                matchedUVs++;
                count++;
              }
            }
            if (count !== 24)
              throw Error("Missing trap vertices " + id + " " + count);
          } finally {
            meshes.forEach((m) => m.dispose());
            w.setBlock(5, 90, 5, B.AIR);
          }
        }
        const atlasPixels = g.atlasTex.image
          .getContext("2d")
          .getImageData(
            (T.trapdoor % 16) * 16,
            Math.floor(T.trapdoor / 16) * 16,
            16,
            16,
          ).data;
        if (
          atlasPixels.length !== pixels.length ||
          pixels.some((v, i) => v !== atlasPixels[i])
        )
          throw Error("Production atlas differs from reference PNG");
        w.setBlock(6, y, 5, B.TRAP_BOTTOM_N);
        w.setBlock(7, y, 5, B.TRAP_TOP_E);
        w.setBlock(8, y, 5, B.TRAP_OPEN_BOTTOM_S);
        w.setBlock(9, y, 5, B.TRAP_OPEN_TOP_W);
        w.setBlock(10, y, 5, B.TRAP_TOP_N);
        w.setBlock(8, y, 7, B.DOOR_N);
        w.setBlock(8, y + 1, 7, B.DOOR_UN);
        g.body.pos.set(7.5, y, 10.5);
        g.body.vel.set(0, 0, 0);
        g.yaw = 0;
        g.pitch = -0.35;
        g.updateCamera(0.016);
        g.buildChunk(0, 0);
        g.buildChunk(1, 0);
        g.emitHud();
        g.updateBuildingTarget(B.TRAP_OPEN_BOTTOM_S, 8, y, 5);
        g.selection.position.set(8.5, y + 0.5, 5.5);
        g.selection.visible = true;
        g.firstPerson.render(g.renderer, g.scene, g.camera);
        return {
          panels,
          closedTrapDistance: closed.dist,
          doorStates: doors,
          modernStates,
          floorPlaced,
          closedAgain,
          ceilingPlaced,
          matchedUVs,
          referencePixelChannels: pixels.length,
        };
      },
      { B, T, expectedUVs, pixels },
    );
    const itemReport = await p.evaluate(
      async ({
        B,
        T,
        expectedUVs,
        itemBounds,
        alphaProbes,
        displayReferences,
        cubeDisplayReferences,
      }) => {
        const g = window.minecraft.game;
        g.inventory.slots.fill(null);
        g.inventory.slots[0] = { id: B.TRAP, count: 8 };
        g.inventory.offhand = { id: B.TRAP, count: 1 };
        g.selected = 0;
        g.handId = -999;
        g.offHandId = -999;
        g.updateHand();
        const expected = new Map(
          expectedUVs.find((r) => r.id === 503).vertices,
        );
        const normals = [
          [-1, 0, 0],
          [1, 0, 0],
          [0, -1, 0],
          [0, 1, 0],
          [0, 0, -1],
          [0, 0, 1],
        ];
        let uvPairs = 0;
        const inspect = (mesh) => {
          const geo = mesh.geometry;
          geo.computeBoundingBox();
          const b = geo.boundingBox;
          if (
            Math.abs(b.max.y - b.min.y - 3 / 16) > 1e-6 ||
            Math.abs(b.min.y + 0.5) > 1e-6
          )
            throw Error("Item remains cube or uses world state");
          if (!mesh.material.alphaTest) throw Error("Item holes are opaque");
          const p = geo.getAttribute("position"),
            uv = geo.getAttribute("uv"),
            n = geo.getAttribute("normal");
          for (let i = 0; i < p.count; i++) {
            const face = normals.findIndex((v) =>
              v.every((x, a) => Math.abs(x - n.getComponent(i, a)) < 1e-6),
            );
            const key =
              face +
              ":" +
              [p.getX(i) + 0.5, p.getY(i) + 0.5, p.getZ(i) + 0.5]
                .map((x) => Math.round(x * 65536))
                .join(",");
            const ref = expected.get(key);
            if (!ref) throw Error("Unknown item corner");
            const [u, v] = ref,
              eps = 0.0004,
              U =
                ((T.trapdoor % 16) + u / 16) / 16 +
                (u === 0 ? eps : u === 16 ? -eps : 0),
              V =
                1 -
                (Math.floor(T.trapdoor / 16) + v / 16) / 16 +
                (v === 0 ? -eps : v === 16 ? eps : 0);
            if (
              Math.abs(uv.getX(i) - U) > 2e-6 ||
              Math.abs(uv.getY(i) - V) > 2e-6
            )
              throw Error("Item UV differs from bottom reference");
            uvPairs++;
          }
          return b.max.y - b.min.y;
        };
        let poseVertices = 0;
        const rotate = (point, angles) => {
          let [x, y, z] = point;
          for (const axis of [2, 1, 0]) {
            const a = (angles[axis] * Math.PI) / 180,
              c = Math.cos(a),
              s = Math.sin(a);
            if (axis === 2) [x, y] = [c * x - s * y, s * x + c * y];
            else if (axis === 1) [x, z] = [c * x + s * z, -s * x + c * z];
            else [y, z] = [c * y - s * z, s * y + c * z];
          }
          return [x, y, z];
        };
        const pose = (
          mesh,
          key,
          anchor,
          angles = [0, 0, 0],
          left = false,
          references = displayReferences,
        ) => {
          const d = references[key],
            sign = left ? -1 : 1;
          mesh.updateMatrix();
          const p = mesh.geometry.getAttribute("position"),
            m = mesh.matrix.elements;
          for (let i = 0; i < p.count; i++) {
            const point = [p.getX(i), p.getY(i), p.getZ(i)];
            let expected = rotate(
              point.map((v, a) => v * d.scale[a]),
              [d.rotation[0], sign * d.rotation[1], sign * d.rotation[2]],
            );
            expected = expected.map(
              (v, a) => v + (d.translation[a] / 16) * (a === 0 ? sign : 1),
            );
            expected = rotate(expected, angles).map((v, a) => v + anchor[a]);
            for (let a = 0; a < 3; a++) {
              const actual =
                m[a] * point[0] +
                m[a + 4] * point[1] +
                m[a + 8] * point[2] +
                m[a + 12];
              if (Math.abs(actual - expected[a]) > 3e-6)
                throw Error(
                  "Display mismatch " + key + " vertex " + i + " axis " + a,
                );
            }
            poseVertices++;
          }
        };
        const mainHeight = inspect(g.handMesh),
          offhandHeight = inspect(g.offHandMesh);
        pose(
          g.handMesh,
          "firstperson_righthand",
          [0.42, -0.32, -0.62],
          [(0.1 * 180) / Math.PI, 45 + (0.12 * 180) / Math.PI, 0],
        );
        pose(
          g.offHandMesh,
          "firstperson_lefthand",
          [-0.42, -0.32, -0.62],
          [(0.1 * 180) / Math.PI, -45 - (0.12 * 180) / Math.PI, 0],
          true,
        );
        const oldDropCount = g.drops.length;
        g.spawnDrop(
          B.TRAP,
          2,
          7,
          65.35,
          8,
          undefined,
          0,
          0,
          0,
          undefined,
          undefined,
          undefined,
          2,
        );
        const drop = g.drops.at(-1),
          dropHeight = inspect(drop.mesh);
        pose(drop.mesh, "ground", [7, 65.35, 8]);
        g.updateDrops(0);
        if (
          Math.abs(
            drop.mesh.position.y -
              drop.pos.y -
              0.12 -
              Math.sin(drop.age * 3) * 0.06 -
              3 / 16,
          ) > 1e-6
        )
          throw Error("Ground animation lost display translation");
        const remoteId = "synthetic-pose-browser";
        const remote = g.ensureRemote({
          id: remoteId,
          name: "Test modelu",
          hue: 120,
          skin: "steve",
        });
        remote.held = B.TRAP;
        const anchor = remote.hand.position.toArray();
        g.updateRemoteHeld(remote);
        const remoteHeight = inspect(remote.hand);
        pose(remote.hand, "thirdperson_righthand", anchor);
        if (remote.hand.material.map !== g.atlasTex)
          throw Error("Avatar does not use item atlas");
        remote.group.position.set(5.8, 65, 6.5);
        remote.group.rotation.y = Math.PI;
        remote.group.visible = true;
        window.poseTestRemoteId = remoteId;
        if (
          g.drops.length !== oldDropCount + 1 ||
          drop.count !== 2 ||
          drop.pickupDelay !== 2
        )
          throw Error("Drop behavior changed");
        const beforeCubes = poseVertices;
        for (const id of [B.STONE, B.COBBLE, B.DIRT, B.PLANKS, B.SAND]) {
          g.inventory.slots[0] = { id, count: 8 };
          g.inventory.offhand = { id, count: 1 };
          g.updateHand();
          pose(
            g.handMesh,
            "firstperson_righthand",
            [0.42, -0.32, -0.62],
            [(0.1 * 180) / Math.PI, 45 + (0.12 * 180) / Math.PI, 0],
            false,
            cubeDisplayReferences,
          );
          pose(
            g.offHandMesh,
            "firstperson_lefthand",
            [-0.42, -0.32, -0.62],
            [(0.1 * 180) / Math.PI, -45 - (0.12 * 180) / Math.PI, 0],
            true,
            cubeDisplayReferences,
          );
          g.spawnDrop(
            id,
            2,
            7,
            65.35,
            8,
            undefined,
            0,
            0,
            0,
            undefined,
            undefined,
            undefined,
            2,
          );
          const cube = g.drops.at(-1);
          pose(
            cube.mesh,
            "ground",
            [7, 65.35, 8],
            [0, 0, 0],
            false,
            cubeDisplayReferences,
          );
          remote.held = id;
          g.updateRemoteHeld(remote);
          pose(
            remote.hand,
            "thirdperson_righthand",
            anchor,
            [0, 0, 0],
            false,
            cubeDisplayReferences,
          );
          for (const mesh of [
            g.handMesh,
            g.offHandMesh,
            cube.mesh,
            remote.hand,
          ]) {
            const geo = mesh.geometry;
            geo.computeBoundingBox();
            if (
              Math.abs(geo.boundingBox.max.y - geo.boundingBox.min.y - 1) > 1e-6
            )
              throw Error("Full cube geometry changed");
            if (mesh.material.map !== g.atlasTex)
              throw Error("Cube item lost atlas");
          }
        }
        g.updateDrops(0);
        for (const d of g.drops.slice(-5))
          if (
            Math.abs(
              d.mesh.position.y -
                d.pos.y -
                0.12 -
                Math.sin(d.age * 3) * 0.06 -
                3 / 16,
            ) > 1e-6
          )
            throw Error("Cube ground translation lost");
        const cubePoseVertices = poseVertices - beforeCubes;
        g.inventory.slots[0] = { id: B.STONE, count: 8 };
        g.inventory.offhand = { id: B.PLANKS, count: 1 };
        g.updateHand();
        remote.held = B.COBBLE;
        g.updateRemoteHeld(remote);
        const icon = g.icons[B.TRAP];
        for (const { id } of expectedUVs)
          if (g.icons[id] !== icon)
            throw Error("Hidden state has different item icon");
        const image = new Image();
        image.src = icon;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 48;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, 48, 48).data;
        const bounds = [48, 48, -1, -1];
        let opaque = 0,
          transparent = 0;
        for (let y = 0; y < 48; y++)
          for (let x = 0; x < 48; x++) {
            const a = rgba[(y * 48 + x) * 4 + 3];
            if (a > 0) {
              bounds[0] = Math.min(bounds[0], x);
              bounds[1] = Math.min(bounds[1], y);
              bounds[2] = Math.max(bounds[2], x);
              bounds[3] = Math.max(bounds[3], y);
            }
            if (a === 0) transparent++;
            if (a === 255) opaque++;
          }
        if (bounds.some((v, i) => Math.abs(v - itemBounds[i]) > 2))
          throw Error(
            "GUI projection does not match inherited display " +
              JSON.stringify({ bounds, itemBounds }),
          );
        let holeChecks = 0,
          woodChecks = 0;
        for (const [x, y, expected] of alphaProbes) {
          const a = rgba[(y * 48 + x) * 4 + 3];
          if (expected === 0) {
            if (a > 5) throw Error("GUI hole filled");
            holeChecks++;
          } else {
            if (a < 250) throw Error("GUI wood missing");
            woodChecks++;
          }
        }
        if (!holeChecks || !woodChecks) throw Error("Missing alpha coverage");
        g.swingT = 1;
        g.updateCamera(0.016);
        g.emitHud();
        g.firstPerson.render(g.renderer, g.scene, g.camera);
        return {
          mainHeight,
          offhandHeight,
          dropHeight,
          remoteHeight,
          poseVertices,
          cubePoseVertices,
          cubeFamilies: 5,
          uvPairs,
          iconBounds: bounds,
          holeChecks,
          woodChecks,
          opaque,
          transparent,
          icon,
        };
      },
      {
        B,
        T,
        expectedUVs,
        itemBounds,
        alphaProbes,
        displayReferences,
        cubeDisplayReferences,
      },
    );
    fs.writeFileSync(
      path.join(output, (mobile ? "mobile" : "desktop") + "-icon.png"),
      Buffer.from(itemReport.icon.split(",")[1], "base64"),
    );
    delete itemReport.icon;
    report.item = itemReport;
    if (errors.length) throw Error(JSON.stringify(errors));
    const device = mobile ? "mobile" : "desktop";
    await p.screenshot({ path: path.join(output, device + ".png") });
    // Actual avatar teardown must not invalidate the atlas used by both hands/world.
    await p.evaluate(() => {
      const g = window.minecraft.game;
      let disposed = 0;
      const onDispose = () => disposed++;
      g.atlasTex.addEventListener("dispose", onDispose);
      g.dropRemote(window.poseTestRemoteId);
      g.atlasTex.removeEventListener("dispose", onDispose);
      if (disposed) throw Error("Avatar removal disposed shared atlas");
      g.firstPerson.render(g.renderer, g.scene, g.camera);
    });
    if (errors.length) throw Error(JSON.stringify(errors));
    reports.push({ device, viewport, ...report, errors });
    console.log("PASS " + device + " " + JSON.stringify(report));
    await context.close();
  }
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify({ version, reports }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
