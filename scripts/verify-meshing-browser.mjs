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
const outputDir = path.join(root, ".cache/verification420");
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
    LD_LIBRARY_PATH:
      [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
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
    process.env.BROWSER_CASES ?? "desktop,mobile,fallback,file,terrain"
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
      if (device === "fallback")
        window.Worker = class {
          constructor() {
            throw Error("Controlled unavailable worker");
          }
        };
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          controlMode: "desktop",
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
            id: "worker420",
            name: "Chunki w tle",
            seed: 4202026,
            mode: "creative",
            worldType: device === "terrain" ? "normal" : "flat",
            mods: {},
            pos: [4.5, 65, 4.5],
            yaw: 0,
            pitch: -0.3,
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
    const initial = await p.evaluate((device) => {
      const g = window.minecraft.game,
        s = g.meshWorker?.report();
      if (
        !s ||
        (device === "fallback"
          ? s.state !== "sync"
          : s.state === "sync" || s.completed < 1)
      )
        throw Error("Worker not operational: " + JSON.stringify(s));
      g.ui = "playing";
      g.onUI("playing");
      g.mouseFallback = true;
      g.locked = true;
      g.world.setBlock(4, 64, 4, 3);
      for (let y = 65; y < 69; y++) g.world.setBlock(4, y, 4, 0);
      for (let x = 2; x < 7; x++)
        for (let z = 0; z < 4; z++) g.world.setBlock(x, 64, z, 9);
      g.updateCamera(0.016);
      return s;
    }, device);
    if (device !== "fallback") {
      // A real response arrives after the edit: it must not replace the old floor.
      await p.evaluate(() => {
        const g = window.minecraft.game;
        window.__old = g.world.getChunk(0, 0).meshes;
        window.__completed = g.meshWorker.report().completed;
        g.requestChunk(0, 0);
        g.world.setBlock(6, 65, 3, 27);
      });
      await p.waitForFunction(() => !window.minecraft.game.meshWorker.busy, {
        timeout: 15000,
      });
      await p.evaluate(() => {
        const g = window.minecraft.game;
        if (
          g.world.getChunk(0, 0).meshes !== window.__old ||
          g.meshWorker.report().completed !== window.__completed ||
          !g.world.dirty.has("0,0")
        )
          throw Error("Stale floor replacement");
        g.requestChunk(0, 0);
      });
      await p.waitForFunction(() => !window.minecraft.game.meshWorker.busy, {
        timeout: 15000,
      });
      const parity = await p.evaluate(() => {
        const g = window.minecraft.game,
          c = g.world.getChunk(0, 0),
          expected = g.world.buildMesh(c);
        let values = 0;
        for (const m of c.meshes) {
          const e = expected[m.renderOrder];
          for (const [name, a] of Object.entries(m.geometry.attributes)) {
            const b = e.getAttribute(name);
            if (
              a.array.constructor !== b.array.constructor ||
              a.array.length !== b.array.length
            )
              throw Error("Attribute layout");
            for (let i = 0; i < a.array.length; i++) {
              if (a.array[i] !== b.array[i])
                throw Error("Worker attribute mismatch " + name);
              values++;
            }
          }
          const a = m.geometry.index.array,
            b = e.index.array;
          if (a.length !== b.length || a.some((v, i) => v !== b[i]))
            throw Error("Worker index mismatch");
        }
        const r = g.renderer,
          gl = r.getContext(),
          read = () => {
            const a = new Uint8Array(
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
        g.firstPerson.render(r, g.scene, g.camera);
        const before = read(),
          drawCalls = r.info.render.calls;
        const restore = c.meshes.map((m) => [m, m.geometry]);
        for (const [m] of restore) m.geometry = expected[m.renderOrder];
        g.firstPerson.render(r, g.scene, g.camera);
        const after = read();
        for (const [m, geo] of restore) m.geometry = geo;
        let differences = 0;
        for (let i = 0; i < before.length; i++)
          if (before[i] !== after[i]) differences++;
        for (const e of expected) e.dispose();
        if (
          differences ||
          gl.getError() !== gl.NO_ERROR ||
          !g.world.isSolid(4, 64, 4)
        )
          throw Error("Pixels/collision mismatch");
        return {
          values,
          pixels: before.length / 4,
          differences,
          drawCalls,
          worker: g.meshWorker.report(),
        };
      });
      const pairs = [];
      for (
        let n = 0;
        n < (device === "file" || device === "terrain" ? 1 : 7);
        n++
      ) {
        const sync = await p.evaluate(() => {
          const g = window.minecraft.game,
            t = performance.now();
          g.buildChunk(0, 0);
          return performance.now() - t;
        });
        const submit = await p.evaluate(() => {
          const g = window.minecraft.game,
            t = performance.now();
          g.requestChunk(0, 0);
          return performance.now() - t;
        });
        await p.waitForFunction(() => !window.minecraft.game.meshWorker.busy, {
          timeout: 15000,
        });
        pairs.push({
          syncMs: sync,
          submitMs: submit,
          ...(await p.evaluate(() =>
            window.minecraft.game.meshWorker.report(),
          )),
        });
      }
      const emergency = await p.evaluate(() => {
        const g = window.minecraft.game;
        g.requestChunk(0, 0);
        const worker = g.meshWorker.worker,
          terminate = worker.terminate.bind(worker);
        let cancelled = false;
        worker.terminate = () => {
          cancelled = true;
          terminate();
        };
        g.unloadTimer = 2;
        g.body.pos.x = 324.5;
        g.updateChunks(0.016);
        if (!cancelled || !g.world.getChunk(20, 0).built)
          throw Error("Missing emergency floor");
        g.body.pos.x = 4.5;
        g.updateChunkVisibility();
        return {
          cancelled,
          solid: g.world.isSolid(4, 64, 4),
          built: g.world.getChunk(20, 0).built,
        };
      });
      await p.waitForFunction(() => !window.minecraft.game.meshWorker.busy, {
        timeout: 15000,
      });
      reports.push({ device, initial, parity, pairs, emergency });
      console.log(
        "PASS native Worker, stale response, exact geometry/pixels, main-thread scheduling " +
          device,
        JSON.stringify({ parity, pairs }),
      );
    } else {
      await p.evaluate(() => {
        const g = window.minecraft.game;
        g.requestChunk(0, 0);
        if (!g.world.isSolid(4, 64, 4) || !g.world.getChunk(0, 0).built)
          throw Error("Fallback lost floor");
      });
      console.log(
        "PASS blocked Worker uses synchronous fallback and loads the world",
      );
    }
    await p.evaluate(() => {
      const g = window.minecraft.game;
      g.debug = true;
      g.emitHud();
      g.save();
    });
    await p.waitForFunction(() => document.body.innerText.includes("Mesher:"));
    await p.screenshot({ path: path.join(outputDir, `${device}.png`) });
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
    const saved = await p.evaluate(() => {
      const g = window.minecraft.game;
      cancelAnimationFrame(g.raf);
      return {
        floor: g.world.getBlock(4, 64, 4),
        water: g.world.getBlock(3, 64, 2),
        gui: JSON.parse(localStorage.getItem("blockcraft-settings")).guiScale,
      };
    });
    if (
      saved.floor !== 3 ||
      saved.water !== 9 ||
      saved.gui !== (device === "mobile" ? 0 : 2)
    )
      throw Error("Save regression " + JSON.stringify(saved));
    if (errors.length) throw Error(JSON.stringify(errors));
    await p.evaluate(() => {
      const q = window.minecraft.game.meshWorker;
      window.minecraft.game.dispose();
      if (q && (q.busy || q.available))
        throw Error("Worker survived game disposal");
    });
    console.log(
      "PASS save/reload, GUI 2/Auto 0, cleanup and zero console errors " +
        device,
      JSON.stringify(saved),
    );
    await p.close();
  }
} finally {
  fs.writeFileSync(
    path.join(outputDir, "browser-report.json"),
    JSON.stringify(reports, null, 2),
  );
  await browser.close();
}
