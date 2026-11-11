/** Optional real WebGL/Worker regression suite, isolated temporary browser profile.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:meshing.
 * Linux x64; never uses your everyday browser profile or public multiplayer.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
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
import assert from "node:assert/strict";
import { build } from "esbuild";
const outputDir = path.join(root, ".cache/verification444");
fs.mkdirSync(outputDir, { recursive: true });
const injection = await build({
  stdin: {
    contents:
      "import * as THREE from 'three'; import { B } from './src/game/blocks'; window.__lightTest = { THREE, B };",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  write: false,
});
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: true,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const click = (p, text) =>
  p.evaluate((text) => {
    const b = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === text,
    );
    if (!b) throw Error("Missing button: " + text);
    b.click();
  }, text);
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
    await p.setViewport(
      mobile
        ? { width: 753, height: 360, isMobile: true, hasTouch: true }
        : { width: 1280, height: 720 },
    );
    await p.evaluateOnNewDocument(() => {
      Element.prototype.requestFullscreen = async () => {};
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          renderDistance: 3,
          quality: "low",
          music: false,
          sounds: false,
        }),
      );
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "light444",
            name: "Światło",
            seed: 444,
            mode: "creative",
            worldType: "flat",
            mods: {},
            pos: [-2.5, 69, -0.5],
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
    });
    await p.goto(process.env.BROWSER_URL ?? "http://127.0.0.1:4173/", {
      waitUntil: "domcontentloaded",
    });
    await click(p, "Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click(p, "Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 120000 },
    );
    await p.evaluate(() => cancelAnimationFrame(window.minecraft.game.raf));
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 20000,
    });
    await p.addScriptTag({ content: injection.outputFiles[0].text });
    const report = await p.evaluate(() => {
      const g = window.minecraft.game,
        { THREE: T, B } = window.__lightTest;
      const assert = (value, msg) => {
        if (!value) throw Error(msg);
      };
      // Keep actual production material/onBeforeCompile/uniforms and actual
      // engine source selection. An isolated white probe makes pixel deltas
      // independent of terrain texture, fog, sky, mobs and the owner's saves.
      const mat = g.materials[0],
        originalMap = mat.map;
      mat.map = null;
      mat.needsUpdate = true;
      mat.fog = false;
      g.uDay.value = 0;
      g.brightness.value = 0;
      g.sunState.power = 0;
      mat.userData.uSun.value = 0;
      const scene = new T.Scene();
      scene.background = new T.Color(0);
      const geo = new T.PlaneGeometry(1, 1);
      geo.rotateY(-Math.PI / 2);
      const count = geo.attributes.position.count;
      geo.setAttribute(
        "color",
        new T.Float32BufferAttribute(new Float32Array(count * 3), 3),
      );
      geo.setAttribute(
        "aBlock",
        new T.Float32BufferAttribute(new Float32Array(count), 1),
      );
      geo.setAttribute(
        "aFace",
        new T.Float32BufferAttribute(new Float32Array(count), 1),
      );
      const probe = new T.Mesh(geo, mat);
      probe.position.set(2, 70.5, -0.5);
      scene.add(probe);
      const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(-1, 70.5, -0.5);
      camera.lookAt(probe.position);
      const target = new T.WebGLRenderTarget(64, 64),
        pixels = new Uint8Array(64 * 64 * 4);
      const render = () => {
        g.renderer.setRenderTarget(target);
        g.renderer.render(scene, camera);
        g.renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
        g.renderer.setRenderTarget(null);
        const i = (32 * 64 + 32) * 4;
        return [...pixels.slice(i, i + 3)];
      };
      for (let x = -16; x < 16; x++)
        for (let z = -16; z < 16; z++)
          for (let y = 56; y < 85; y++) g.world.setBlock(x, y, z, B.AIR);
      const wall = (id) => {
        for (let z = -15; z <= 13; z++)
          for (let y = 56; y <= 84; y++) g.world.setBlock(0, y, z, id);
      };
      g.camera.position.set(-2.5, 70.5, -0.5);
      g.inventory.slots[0] = { id: B.TORCH, count: 1 };
      g.selected = 0;
      g.inventory.offhand = null;
      g.remotes.clear();
      g.updateHeldLight();
      const open = render();
      assert(open[0] > 60, "probe is not illuminated in air " + open);
      wall(B.STONE);
      g.updateHeldLight();
      const closed = render();
      assert(
        closed[0] < open[0] / 2,
        "opaque wall still leaks " + closed + " vs " + open,
      );
      const n = g.heldField.builds;
      g.updateHeldLight();
      render();
      assert(g.heldField.builds === n, "stationary field rebuilt");
      g.world.setBlock(0, 70, -1, B.AIR);
      g.updateHeldLight();
      const aperture = render();
      assert(aperture[0] > closed[0] + 20, "opening does not illuminate probe");
      g.world.setBlock(0, 70, -1, B.STONE);
      g.updateHeldLight();
      const resealed = render();
      assert(Math.abs(resealed[0] - closed[0]) <= 1, "resealing leaves light");
      wall(B.GLASS);
      g.updateHeldLight();
      const glass = render();
      assert(glass[0] > closed[0] + 20, "glass blocks light");
      wall(B.STONE);
      g.inventory.slots[0] = null;
      g.inventory.offhand = { id: B.TORCH, count: 1 };
      g.updateHeldLight();
      const offhandClosed = render();
      assert(offhandClosed[0] <= closed[0] + 1, "offhand leaks through wall");
      g.inventory.offhand = null;
      const group = new T.Group();
      group.position.set(-2.5, 69.05, -0.5);
      g.remotes.set("synthetic-peer", {
        group,
        held: B.TORCH,
        offhand: 0,
        seen: performance.now(),
        alive: true,
      });
      g.updateHeldLight();
      const remoteClosed = render();
      assert(remoteClosed[0] <= closed[0] + 1, "remote leaks through wall");
      wall(B.AIR);
      g.updateHeldLight();
      const remoteOpen = render();
      assert(
        remoteOpen[0] > remoteClosed[0] + 20,
        "remote does not illuminate opening",
      );
      g.remotes.clear();
      g.updateHeldLight();
      const removed = render();
      assert(removed[0] <= closed[0] + 1, "departed peer leaves ghost light");
      // Negative control: white atlas restores the pre-fix radial leak while
      // keeping the production shader, geometry, source and wall identical.
      wall(B.STONE);
      g.inventory.slots[0] = { id: B.TORCH, count: 1 };
      g.updateHeldLight();
      g.heldField.data.fill(255);
      g.heldField.texture.needsUpdate = true;
      const negativeControl = render();
      assert(
        negativeControl[0] > closed[0] + 20,
        "negative control did not detect old radial leak",
      );
      g.world.setBlock(0, 70, -1, B.AIR);
      g.world.setBlock(0, 70, -1, B.STONE);
      g.updateHeldLight();
      const restored = render();
      assert(restored[0] <= closed[0] + 1, "restored field still leaks");
      // Compile all three real production variants, not only the opaque one.
      for (let i = 1; i <= 2; i++) {
        probe.material = g.materials[i];
        geo.setAttribute(
          "aWave",
          new T.Float32BufferAttribute(new Float32Array(count), 1),
        );
        render();
      }
      probe.material = mat;
      const final = render();
      const result = {
        open,
        closed,
        aperture,
        resealed,
        glass,
        offhandClosed,
        remoteClosed,
        remoteOpen,
        removed,
        negativeControl,
        restored,
        final,
        worker: g.meshWorker.report().state,
        atlasBytes: g.heldField.data.byteLength,
        renderer: g.renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL",
      };
      target.dispose();
      geo.dispose();
      mat.map = originalMap;
      mat.needsUpdate = true;
      return result;
    });
    assert.deepEqual(errors, [], "browser errors");
    reports.push({ mobile, ...report, errors });
    console.log(JSON.stringify(reports.at(-1)));
    await context.close();
  }
  fs.writeFileSync(
    path.join(outputDir, "report.json"),
    JSON.stringify(reports, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
