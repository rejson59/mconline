/** Optional real WebGL/Worker regression suite, isolated temporary browser profile.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:entitylighting.
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
const outputDir = path.join(root, ".cache/verification445");
fs.mkdirSync(outputDir, { recursive: true });
const injection = await build({
  stdin: {
    contents:
      "import * as THREE from 'three'; import { B } from './src/game/blocks'; import { I } from './src/game/items'; window.__lightTest = { THREE, B, I };",
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
            id: "light445",
            name: "Światło",
            seed: 445,
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
        { THREE: T, B, I } = window.__lightTest;
      const assert = (v, name) => {
        if (!v) throw Error(name);
      };
      const scene = new T.Scene();
      scene.background = new T.Color(0);
      const target = new T.WebGLRenderTarget(128, 128),
        data = new Uint8Array(128 * 128 * 4);
      const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(5.5, 70.55, 10);
      camera.lookAt(5.5, 70.55, 5.5);
      const render = () => {
        g.updateEntityLighting();
        g.renderer.setRenderTarget(target);
        g.renderer.render(scene, camera);
        g.renderer.readRenderTargetPixels(target, 0, 0, 128, 128, data);
        g.renderer.setRenderTarget(null);
        const i = (64 * 128 + 64) * 4;
        return [...data.slice(i, i + 3)];
      };
      const sum = (p) => p.reduce((a, b) => a + b, 0);
      for (let x = -8; x <= 20; x++)
        for (let z = -8; z <= 20; z++)
          for (let y = 66; y <= 86; y++) g.world.setBlock(x, y, z, B.AIR);
      const seal = (id) => {
        for (let x = 3; x <= 9; x++)
          for (let z = 2; z <= 9; z++)
            for (let y = 68; y <= 74; y++)
              if (
                x === 3 ||
                x === 9 ||
                z === 2 ||
                z === 9 ||
                y === 68 ||
                y === 74
              )
                g.world.setBlock(x, y, z, id);
      };
      g.inventory.slots.fill(null);
      g.inventory.offhand = null;
      g.selected = 0;
      g.camera.position.set(1.5, 70.5, 5.5);
      g.uDay.value = 1;
      g.brightness.value = 0;
      g.sunState.power = 1;
      g.remotes.clear();
      g.mobs.forEach((m) => m.group.removeFromParent());
      g.mobs = [];
      const avatar = g.makeAvatar("Voxel light test", 30, "steve");
      avatar.group.position.set(5.5, 69.5, 5.5);
      scene.add(avatar.group);
      g.remotes.set("target", avatar);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const daylight = render();
      assert(sum(daylight) > 80, "daylight skin not illuminated: " + daylight);
      seal(B.STONE);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const enclosed = render();
      assert(
        sum(enclosed) < sum(daylight) / 3,
        "enclosed skin still sees sky: " + enclosed + " vs " + daylight,
      );
      // Deliberately huge unoccluded scene lights must not relight this cave.
      const ambient = new T.AmbientLight(0xffffff, 100),
        point = new T.PointLight(0xffffff, 1000, 30);
      point.position.set(5.5, 71, 7);
      scene.add(ambient, point);
      const globalLights = render();
      assert(
        Math.abs(sum(globalLights) - sum(enclosed)) <= 2,
        "global lights bypass sampled light",
      );
      g.inventory.slots[0] = { id: B.TORCH, count: 1 };
      g.updateHeldLight();
      const heldBlocked = render();
      assert(
        sum(heldBlocked) <= sum(enclosed) + 3,
        "held torch passes opaque wall",
      );
      g.world.setBlock(3, 70, 5, B.AIR);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const heldAperture = render();
      assert(
        sum(heldAperture) > sum(heldBlocked) + 20,
        "held torch does not enter aperture",
      );
      g.world.setBlock(3, 70, 5, B.STONE);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const heldResealed = render();
      assert(
        sum(heldResealed) <= sum(enclosed) + 3,
        "resealing leaves held light",
      );
      g.inventory.slots[0] = null;
      g.world.setBlock(6, 70, 5, B.TORCH);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const placedInside = render();
      assert(
        sum(placedInside) > sum(enclosed) + 30,
        "placed torch does not light model",
      );
      g.world.setBlock(6, 70, 5, B.AIR);
      g.world.setBlock(1, 70, 5, B.TORCH);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const placedOutside = render();
      assert(
        sum(placedOutside) <= sum(enclosed) + 3,
        "placed light leaks through wall",
      );
      g.world.setBlock(1, 70, 5, B.AIR);
      g.buildChunk(0, 0);
      const peer = g.makeAvatar("Synthetic source", 30, "alex");
      peer.group.position.set(1.5, 69.05, 5.5);
      peer.held = B.TORCH;
      g.remotes.set("source", peer);
      g.updateHeldLight();
      const remoteBlocked = render();
      assert(
        sum(remoteBlocked) <= sum(enclosed) + 3,
        "remote held light leaks",
      );
      g.world.setBlock(3, 70, 5, B.AIR);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const remoteAperture = render();
      assert(
        sum(remoteAperture) > sum(enclosed) + 20,
        "remote held light does not reach aperture",
      );
      g.remotes.delete("source");
      g.world.setBlock(3, 70, 5, B.STONE);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      // White-data negative control is a real faulty sky sample, not a different
      // shader or mock skin: the same enclosed avatar must become bright.
      const c = g.world.getChunk(0, 0),
        saved = c.sampledLight.data.slice();
      c.sampledLight.data.fill(240);
      const negativeSky = render();
      assert(
        sum(negativeSky) > sum(enclosed) + 40,
        "negative sky control not detected",
      );
      c.sampledLight.data.set(saved);
      const restored = render();
      assert(sum(restored) <= sum(enclosed) + 3, "restored sky still bright");
      // Existing held atlas negative control catches unoccluded dynamic light.
      g.inventory.offhand = { id: B.TORCH, count: 1 };
      g.updateHeldLight();
      g.heldField.data.fill(255);
      g.heldField.texture.needsUpdate = true;
      const negativeHeld = render();
      assert(
        sum(negativeHeld) > sum(enclosed) + 20,
        "held atlas negative control not detected",
      );
      g.inventory.offhand = null;
      g.updateHeldLight();
      // Added armor, replaced held materials and a replaced skin all pass the
      // production late-discovery path; text labels remain sprites/unpatched.
      avatar.armor.update([
        I.IRON_HELMET,
        I.DIAMOND_CHEST,
        I.IRON_LEGS,
        I.IRON_BOOTS,
      ]);
      avatar.held = I.IRON_PICKAXE;
      avatar.offhand = I.APPLE;
      g.updateRemoteHeld(avatar);
      render();
      let patchedMeshes = 0,
        sprites = 0;
      avatar.group.traverse((o) => {
        if (o.isMesh)
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            assert(
              m.userData.voxelEntityLighting,
              "late avatar material unpatched",
            );
            patchedMeshes++;
          }
        if (o.isSprite) {
          assert(!o.material.userData.voxelEntityLighting, "nameplate patched");
          sprites++;
        }
      });
      avatar.group.removeFromParent();
      g.setRemoteSkin("target", "alex");
      const fresh = g.remotes.get("target");
      scene.add(fresh.group);
      render();
      fresh.group.traverse((o) => {
        if (o.isMesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            assert(m.userData.voxelEntityLighting, "replaced skin unpatched");
      });
      fresh.group.removeFromParent();
      g.remotes.clear();
      scene.remove(ambient, point);
      // All actual model families, including new wolf collar/sheep state, are
      // rendered to force real GPU compilation and preserve tint/flash alpha.
      seal(B.AIR);
      g.buildChunk(0, 0);
      g.updateHeldLight();
      const models = [];
      for (const type of [
        "pig",
        "cow",
        "sheep",
        "chicken",
        "wolf",
        "villager",
        "zombie",
        "skeleton",
        "creeper",
        "spider",
        "golem",
        "enderman",
        "slime",
        "ghast",
      ]) {
        const mob = g.spawnMob(type, 5.5, 69.5, 5.5);
        assert(mob, "spawn rejected " + type);
        scene.add(mob.group);
        g.mobs = [mob];
        if (type === "wolf") mob.tame();
        if (type === "sheep") {
          mob.shear();
          mob.regrowWool();
        }
        render();
        let meshes = 0;
        mob.group.traverse((o) => {
          if (o.isMesh) {
            meshes++;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              assert(m.userData.voxelEntityLighting, "unpatched mob " + type);
          }
        });
        mob.setTint(true);
        render();
        mob.setTint(false);
        mob.setFlash(true);
        render();
        mob.setFlash(false);
        models.push({ type, meshes });
        mob.group.removeFromParent();
        mob.dispose();
        g.mobs = [];
      }
      const state = g.meshWorker.report().state;
      target.dispose();
      return {
        daylight,
        enclosed,
        globalLights,
        heldBlocked,
        heldAperture,
        heldResealed,
        placedInside,
        placedOutside,
        remoteBlocked,
        remoteAperture,
        negativeSky,
        negativeHeld,
        restored,
        patchedMeshes,
        sprites,
        models,
        worker: state,
        sampleBytesPerChunk: c.sampledLight.data.byteLength,
      };
    });
    const beforeWorker = await p.evaluate(() => {
      const g = window.minecraft.game,
        n = g.meshWorker.report().completed;
      g.world.setBlock(5, 90, 5, window.__lightTest.B.STONE);
      g.requestChunk(0, 0);
      return n;
    });
    await p.waitForFunction(() => !window.minecraft.game.meshWorker.busy, {
      timeout: 20000,
    });
    report.workerSamples = await p.evaluate((before) => {
      const g = window.minecraft.game,
        c = g.world.getChunk(0, 0),
        actual = c.sampledLight.data.slice();
      if (g.meshWorker.report().completed <= before)
        throw Error("Real worker did not publish light samples");
      const geometries = g.world.buildMesh(c),
        expected = c.sampledLight.data;
      const differences = actual.reduce(
        (n, v, i) => n + Number(v !== expected[i]),
        0,
      );
      geometries.forEach((g) => g.dispose());
      if (differences) throw Error("Real worker light differs from sync");
      return { bytesCompared: actual.length, differences };
    }, beforeWorker);
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
