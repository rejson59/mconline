/** Optional actual input, fire UV animation, WebGL and offline save regression suite.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:fire.
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
const outputDir = path.join(root, ".cache/verification421");
const baseUrl = process.env.BROWSER_URL ?? "http://127.0.0.1:4173/";
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args,
  headless: true,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const click = (p, label) =>
  p.evaluate((label) => {
    const e = [...document.querySelectorAll("button")].find(
      (e) => e.textContent?.trim() === label,
    );
    if (!e) throw Error("No " + label);
    e.click();
  }, label);
fs.mkdirSync(outputDir, { recursive: true });
const reports = [];
try {
  for (const device of (
    process.env.BROWSER_CASES ?? "desktop,mobile,file"
  ).split(",")) {
    const p = await browser.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await p.setViewport(
      device === "mobile"
        ? { width: 844, height: 390, isMobile: true, hasTouch: true }
        : { width: 960, height: 600 },
    );
    const init = await p.evaluateOnNewDocument((device) => {
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          controlMode: device === "mobile" ? "touch" : "desktop",
          guiScale: device === "mobile" ? 0 : 2,
          renderDistance: 2,
          volume: 0,
          fpsCap: 30,
          fpsCapUserSet: true,
          autoQuality: false,
          lod: false,
        }),
      );
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "fire421",
            name: "Krzesiwo",
            seed: 4212026,
            mode: "creative",
            worldType: "flat",
            mods: {},
            pos: [4.5, 65, 5.5],
            yaw: 0,
            pitch: -0.4,
            inv: Array(36).fill(null),
            time: 0.25,
            health: 20,
            day: 1,
            updated: 1,
          },
        ]),
      );
    }, device);
    await p.goto(
      device === "file"
        ? pathToFileURL(path.join(root, "dist/index.html")).href
        : baseUrl,
      { waitUntil: "domcontentloaded" },
    );
    await p.removeScriptToEvaluateOnNewDocument(init.identifier);
    await p.waitForFunction(
      (version) => document.body.innerText.includes("przeglądarka " + version),
      {},
      version,
    );
    await click(p, "Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click(p, "Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    await p.evaluate(() => cancelAnimationFrame(window.minecraft.game.raf));
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 15000,
    });
    const target = await p.evaluate(() => {
      const g = window.minecraft.game;
      g.ui = "playing";
      g.onUI("playing");
      g.mouseFallback = true;
      g.locked = false;
      g.mode = "survival";
      for (let x = 1; x < 12; x++)
        for (let z = 0; z < 7; z++) {
          g.world.setBlock(x, 64, z, 3);
          for (let y = 65; y < 69; y++) g.world.setBlock(x, y, z, 0);
        }
      g.body.pos.set(4.5, 65, 5.5);
      g.body.vel.set(0, 0, 0);
      g.mobs.forEach((m) => (m.dead = true));
      g.selected = 0;
      g.inventory.slots[0] = { id: 142, count: 1 };
      g.inventory.offhand = null;
      g.yaw = 0;
      g.pitch = Math.atan2(65 - g.eyePos().y, 4);
      g.camera.position.copy(g.eyePos());
      g.camera.rotation.set(g.pitch, g.yaw, 0, "YXZ");
      g.camera.updateMatrixWorld(true);
      g.touchAim = g.aimDir = null;
      g.refreshTarget();
      return g.target;
    });
    if (
      target?.x !== 4 ||
      target?.y !== 64 ||
      target?.z !== 1 ||
      target?.ny !== 1
    )
      throw Error("Actual ray missed ignition cell " + JSON.stringify(target));
    if (device === "mobile")
      await p.evaluate(() => window.minecraft.game.touchTap(0, 0));
    else
      await p.evaluate(() => {
        const canvas = window.minecraft.game.renderer.domElement;
        canvas.dispatchEvent(
          new MouseEvent("mousedown", { button: 2, buttons: 2, bubbles: true }),
        );
        window.dispatchEvent(
          new MouseEvent("mouseup", { button: 2, bubbles: true }),
        );
      });
    const result = await p.evaluate(async () => {
      const g = window.minecraft.game,
        w = g.world;
      if (w.peekBlock(4, 65, 1) !== 491 || g.inventory.slots[0].dur !== 63)
        throw Error("Real input did not ignite/wear");
      // A second use against a flame cannot silently eat durability.
      g.tryUse();
      if (g.inventory.slots[0].dur !== 63)
        throw Error("Failed action wore tool");
      const chunk = w.getChunk(0, 0);
      function rebuild() {
        const next = w.buildMesh(chunk);
        chunk.meshes.forEach((m, i) => {
          m.geometry.dispose();
          m.geometry = next[i];
        });
      }
      // Include ordinary, soul and campfire flames in one production cutout shader.
      w.setBlock(6, 64, 1, 336);
      w.setBlock(6, 65, 1, 492);
      w.setBlock(8, 65, 1, 73);
      w.setBlock(10, 65, 1, 493);
      rebuild();
      const read = () => {
        const gl = g.renderer.getContext(),
          a = new Uint8Array(
            gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
          );
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          a,
        );
        return a;
      };
      g.uTime.value = 0;
      g.firstPerson.render(g.renderer, g.scene, g.camera);
      const before = read();
      g.uTime.value = 0.45;
      g.firstPerson.render(g.renderer, g.scene, g.camera);
      const after = read();
      let changed = 0;
      for (let i = 0; i < before.length; i++)
        if (before[i] !== after[i]) changed++;
      if (changed < 10)
        throw Error(
          "Fire UV animation not visible in production WebGL " + changed,
        );
      const gl = g.renderer.getContext();
      if (gl.getError() !== gl.NO_ERROR) throw Error("WebGL error");
      const badPrograms = g.renderer.info.programs.filter(
        (p) => p.diagnostics?.runnable === false,
      );
      if (badPrograms.length) throw Error("Shader compile failed");
      const flags = Array.from(
        chunk.meshes[1].geometry.getAttribute("aWave").array,
      );
      if (!flags.includes(2) || !flags.includes(3) || !flags.includes(4))
        throw Error("Missing flame flags");
      if (w.isSolid(4, 65, 1)) throw Error("Fire has collision");
      if (!g.breakBlock(4, 65, 1) || w.peekBlock(4, 65, 1) !== 0)
        throw Error("Extinguish failed");
      // Fresh actual ray + offhand route.
      g.inventory.slots[0] = { id: 134, count: 1, dur: 200 };
      g.inventory.offhand = { id: 142, count: 1 };
      g.tryUse();
      if (
        w.peekBlock(4, 65, 1) !== 491 ||
        g.inventory.offhand.dur !== 63 ||
        g.inventory.slots[0].dur !== 200
      )
        throw Error("Offhand route failed");
      g.save();
      return {
        changedChannels: changed,
        fire: 491,
        offhandDur: g.inventory.offhand.dur,
        shaderPrograms: g.renderer.info.programs.length,
        worker: g.meshWorker.report().state,
        gui: g.guiScale,
        flags: [...new Set(flags)],
      };
    });
    const audio = JSON.parse(
      fs
        .readFileSync(
          path.join(root, "src/game/art/javaFire.generated.ts"),
          "utf8",
        )
        .match(/export const FIRE_SOUND_FILES:[^=]+ = ([\s\S]*?);\n/)[1],
    );
    result.decodedAudio = await p.evaluate(async (audio) => {
      const ac = new AudioContext(),
        out = [];
      for (const [name, data] of Object.entries(audio)) {
        const b = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
          buffer = await ac.decodeAudioData(b.buffer);
        out.push({
          name,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
        });
      }
      await ac.close();
      return out;
    }, audio);
    await p.screenshot({ path: path.join(outputDir, device + ".png") });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() =>
      document.body.innerText.includes("Tryb jednoosobowy"),
    );
    await click(p, "Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click(p, "Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    const restored = await p.evaluate(() => {
      const g = window.minecraft.game;
      cancelAnimationFrame(g.raf);
      return [
        g.world.peekBlock(4, 65, 1),
        g.world.peekBlock(6, 65, 1),
        g.world.peekBlock(10, 65, 1),
        g.inventory.offhand?.dur,
      ];
    });
    if (JSON.stringify(restored) !== JSON.stringify([491, 492, 493, 63]))
      throw Error("Save/reload mismatch " + JSON.stringify(restored));
    if (errors.length) throw Error("Browser errors: " + errors.join("\n"));
    reports.push({ device, ...result, restored, errors });
    console.log("PASS", device, JSON.stringify(reports.at(-1)));
    await p.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(outputDir, "report.json"),
  JSON.stringify(
    {
      version,
      browser: "Chromium / SwiftShader sandbox, not physical hardware",
      reports,
    },
    null,
    2,
  ) + "\n",
);
