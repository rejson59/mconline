// Production renderer, synthetic packet timings/regions, guest profile only.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url)),
  tools = path.resolve(
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
const out = path.join(root, ".cache/verification441");
fs.mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export { B } from './src/game/blocks'; export { bodyFits } from './src/game/physics';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  globalName: "MobAudit",
  outfile: path.join(out, "bridge.js"),
});
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
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
          fpsCap: 60,
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
            id: "mob-audit",
            name: "Mob audit",
            seed: 441,
            mode: "creative",
            worldType: "flat",
            mods: {},
            pos: [8.5, 65, 8.5],
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
    const click = (label) =>
      p.evaluate((label) => {
        const b = [...document.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === label,
        );
        if (!b) throw Error("Missing " + label);
        b.click();
      }, label);
    await click("Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click("Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    const join = await p.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        ["Dołącz do świata", "Dotknij, aby grać"].includes(
          b.textContent.trim(),
        ),
      );
      if (!button) return false;
      button.id = "mob-audit-join";
      return true;
    });
    if (join) await p.click("#mob-audit-join");
    await p.waitForFunction(() => window.minecraft.game.ui === "playing");
    await p.evaluate(() => cancelAnimationFrame(window.minecraft.game.raf));
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 15000,
    });
    await p.addScriptTag({ path: path.join(out, "bridge.js") });
    const report = await p.evaluate(async () => {
      const g = window.minecraft.game,
        w = g.world,
        { B, bodyFits } = MobAudit;
      const assert = (value, message) => {
        if (!value) throw Error(message);
      };
      for (const m of g.mobs) {
        g.scene.remove(m.group);
        m.dispose();
      }
      g.mobs = [];
      g.spawnTimer = 1e6;
      // Explicit fixture preparation, excluded from simulation timings.
      for (let x = 0; x <= 3; x++)
        for (let z = 0; z <= 3; z++) w.getChunk(x, z);
      for (let x = 2; x <= 43; x++)
        for (let z = 2; z <= 23; z++)
          for (let y = 64; y < 77; y++)
            w.setBlock(x, y, z, y === 64 ? B.STONE : B.AIR);
      const types = [
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
        "enderman",
        "golem",
        "slime",
        "ghast",
      ];
      const mobs = types.map((type, i) =>
        g.spawnMob(type, 6 + (i % 7) * 5, 65, 6 + Math.floor(i / 7) * 7),
      );
      assert(mobs.every(Boolean), "Valid mob rejected");
      const ownInventory = JSON.stringify([
          g.inventory.slots,
          g.inventory.armor,
          g.inventory.offhand,
          g.inventory.cursor,
        ]),
        poll = g.pollSharedMobs.bind(g);
      g.net = {
        id: "fixture-owner",
        sharedContainers: true,
        exchangeSharedMobs: async () => ({ regions: [], hits: [], edits: [] }),
      };
      g.pollSharedMobs = () => {};
      g.body.pos.set(20, 65, 20);
      g.entityDistance = 1;
      const distances = [];
      for (let frame = 0; frame < 126; frame++) {
        if (frame % 21 === 0) for (const m of mobs) m.body.pos.x += 0.35;
        const before = mobs.map((m) => m.group.position.x);
        g.updateMobs(1 / 60);
        for (let i = 0; i < mobs.length; i++) {
          const m = mobs[i];
          assert(m.group.visible, "Clear visible mob hidden " + m.type);
          distances.push(m.group.position.x - before[i]);
          assert(
            bodyFits(
              w,
              m.group.position.x,
              m.group.position.y,
              m.group.position.z,
              m.body.w,
              m.body.h,
            ),
            "Visual embedded " + m.type,
          );
        }
      }
      const minFrameStep = Math.min(...distances),
        maxFrameStep = Math.max(...distances);
      assert(
        minFrameStep > 0.01 && maxFrameStep < 0.025,
        "Packet sprint/stop " + minFrameStep + "/" + maxFrameStep,
      );
      // Packet restore preserves both current render position and yaw.
      const actor = mobs[0];
      actor.netId = "fixture";
      actor.netRegion = "o:0:0";
      actor.group.rotation.y = 0.2;
      const region = {
        d: "o",
        x: 0,
        z: 0,
        revision: 1,
        epoch: 1,
        owner: "fixture-owner",
        mobs: [actor.snapshot()],
      };
      const oldPosition = actor.group.position.clone();
      region.mobs[0].pos[0] += 0.35;
      region.mobs[0].state.yaw = 2;
      g.applyMobExchange({ regions: [region], hits: [], edits: [] });
      assert(
        actor.group.position.equals(oldPosition) &&
          actor.group.rotation.y === 0.2,
        "Exchange snapped presentation",
      );
      // Exercise the real asynchronous poll AND the real Mob.update with 350ms dt.
      g.net.exchangeSharedMobs = async () => ({
        regions: [region],
        hits: [],
        edits: [],
      });
      g.mobPollAt = performance.now() - 1000;
      g.mobStepAt = performance.now() - 350;
      const oldRotation = actor.group.rotation.clone();
      poll();
      await g.mobTask;
      assert(
        actor.group.position.equals(oldPosition) &&
          actor.group.rotation.y === oldRotation.y,
        "Owned simulation teleported model",
      );
      assert(g.mobUpdates.length === 1, "Owned physics was not queued");
      const clear = () => {
        for (const m of g.mobs) {
          g.scene.remove(m.group);
          m.dispose();
        }
        g.mobs = [];
      };
      clear();
      g.net = null;
      g.entityCulling = false;
      let wallChecks = 0;
      for (const type of types) {
        const m = g.spawnMob(type, 8, 65, 8);
        assert(m, "Failed wall setup " + type);
        for (let y = 65; y < 76; y++)
          for (let z = 2; z < 15; z++) w.setBlock(11, y, z, B.STONE);
        for (let n = 0; n < 8; n++) {
          m.kbTime = 0.45;
          m.body.vel.set(14, 0, 0);
          m.update(
            0.35,
            w,
            g.body.pos,
            () => {},
            () => {},
            true,
          );
          assert(
            bodyFits(
              w,
              m.body.pos.x,
              m.body.pos.y,
              m.body.pos.z,
              m.body.w,
              m.body.h,
            ),
            "Physics embedded " + type,
          );
          wallChecks++;
        }
        clear();
        for (let y = 65; y < 76; y++)
          for (let z = 2; z < 15; z++) w.setBlock(11, y, z, B.AIR);
      }
      w.setBlock(8, 65, 8, B.STONE);
      assert(
        g.spawnMob("pig", 8.5, 65, 8.5) === null,
        "Spawn in stone allowed",
      );
      w.setBlock(8, 65, 8, B.AIR);
      const stuck = g.spawnMob("pig", 8.5, 65, 8.5);
      w.setBlock(8, 65, 8, B.STONE);
      stuck.update(
        0.1,
        w,
        g.body.pos,
        () => {},
        () => {},
        true,
      );
      assert(
        bodyFits(
          w,
          stuck.body.pos.x,
          stuck.body.pos.y,
          stuck.body.pos.z,
          stuck.body.w,
          stuck.body.h,
        ),
        "Stuck mob did not recover",
      );
      clear();
      w.setBlock(8, 65, 8, B.AIR);
      // CPU-only real simulation distribution; not a phone FPS benchmark.
      const crowd = Array.from({ length: 48 }, (_, i) =>
        g.spawnMob(
          types[i % types.length],
          6 + (i % 8) * 4.5,
          65,
          5 + Math.floor(i / 8) * 3,
        ),
      );
      assert(crowd.every(Boolean), "Crowd setup failed");
      const timings = [];
      g.body.pos.set(20, 65, 20);
      for (let i = 0; i < 36; i++) {
        const start = performance.now();
        g.updateMobs(1 / 60);
        const elapsed = performance.now() - start;
        if (i >= 6) timings.push(elapsed);
        for (const m of g.mobs)
          assert(
            bodyFits(
              w,
              m.body.pos.x,
              m.body.pos.y,
              m.body.pos.z,
              m.body.w,
              m.body.h,
            ),
            "Crowd entered block",
          );
      }
      timings.sort((a, b) => a - b);
      assert(
        JSON.stringify([
          g.inventory.slots,
          g.inventory.armor,
          g.inventory.offhand,
          g.inventory.cursor,
        ]) === ownInventory,
        "Mob presentation modified own inventory",
      );
      clear();
      for (const [i, type] of [
        "cow",
        "pig",
        "sheep",
        "chicken",
        "villager",
        "golem",
      ].entries()) {
        const m = g.spawnMob(
          type,
          5.5 + (i % 3) * 3,
          65,
          5 + Math.floor(i / 3) * 4,
        );
        m.yaw = Math.PI;
        m.group.rotation.y = Math.PI;
      }
      g.body.pos.set(8.5, 65, 15);
      g.yaw = 0;
      g.pitch = -0.16;
      g.updatePlayer(0);
      g.updateHand();
      for (let i = 0; i < 30; i++) g.updateChunks(1 / 60);
      g.firstPerson.render(g.renderer, g.scene, g.camera);
      return {
        all14Types: true,
        fullyGeneratedWorld: true,
        packetIntervalMs: 350,
        minFrameStep,
        maxFrameStep,
        renderFrameSamples: distances.length,
        sharedExchangeNoSnap: true,
        realOwnedPollNoSnap: true,
        wallChecks,
        spawnRejected: true,
        embeddedBodyRecovered: true,
        localInventoryUnchanged: true,
        cpuOnly48Mobs: {
          samples: timings.length,
          medianMs: timings[Math.floor(timings.length / 2)],
          p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
        },
        syntheticNetwork: true,
        physicalPhone: false,
      };
    });
    if (errors.length) throw Error(JSON.stringify(errors));
    const device = mobile ? "mobile" : "desktop";
    await p.screenshot({ path: path.join(out, device + ".png") });
    reports.push({ device, viewport, ...report, errors });
    console.log("PASS", device, JSON.stringify(report));
    await context.close();
  }
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify({ version, reports }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
