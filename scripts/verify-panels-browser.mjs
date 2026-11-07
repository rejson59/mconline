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
const output = path.join(root, ".cache/verification433");
fs.mkdirSync(output, { recursive: true });
const enums = path.join(output, "blocks.mjs");
await build({
  stdin: {
    contents: "export {B} from './src/game/blocks';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: enums,
});
const { B } = await import(pathToFileURL(enums).href);
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
      ? { width: 390, height: 844, isMobile: true, hasTouch: true }
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
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((e) => e.textContent?.trim() === "Graj w pionie mimo to")
        ?.click(),
    );
    const report = await p.evaluate((B) => {
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
      w.setBlock(5, y, 5, B.AIR);
      w.setBlock(6, y, 5, B.TRAP_N);
      w.setBlock(7, y, 5, B.TRAP_E);
      w.setBlock(8, y, 5, B.TRAP_S);
      w.setBlock(9, y, 5, B.TRAP_W);
      w.setBlock(10, y, 5, B.TRAP);
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
      g.updateBuildingTarget(B.TRAP_S, 8, y, 5);
      g.selection.position.set(8.5, y + 0.5, 5.5);
      g.selection.visible = true;
      g.firstPerson.render(g.renderer, g.scene, g.camera);
      return { panels, closedTrapDistance: closed.dist, doorStates: doors };
    }, B);
    if (errors.length) throw Error(JSON.stringify(errors));
    const device = mobile ? "mobile" : "desktop";
    await p.screenshot({ path: path.join(output, device + ".png") });
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
