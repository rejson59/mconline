/** Production WebGL + emulated touch regressions; no real user accounts.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * The received multiplayer packets are synthetic; this is NOT a live-account test.
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
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
const out = path.join(root, ".cache/verification430");
fs.mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export { B } from './src/game/blocks'; export { I } from './src/game/items';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(out, "enums.mjs"),
});
const { B, I } = await import(pathToFileURL(path.join(out, "enums.mjs")).href);
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
        ? { width: 844, height: 390, isMobile: true, hasTouch: true }
        : { width: 960, height: 600 },
    );
    await p.evaluateOnNewDocument((mobile) => {
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          controlMode: mobile ? "touch" : "desktop",
          renderDistance: 2,
          volume: 0,
          lod: false,
          autoQuality: false,
          fpsCap: 30,
          fpsCapUserSet: true,
        }),
      );
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "report4283",
            name: "Regression audit",
            seed: 4283,
            mode: "creative",
            worldType: "flat",
            mods: {},
            pos: [4.5, 65, 8.5],
            yaw: 0,
            pitch: 0,
            inv: Array(36).fill(null),
            time: 0.75,
            health: 20,
            day: 1,
            updated: 1,
          },
        ]),
      );
    }, mobile);
    await p.goto(pathToFileURL(path.join(root, "dist/index.html")).href, {
      waitUntil: "domcontentloaded",
    });
    await click(p, "Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click(p, "Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    await p.evaluate(() => {
      cancelAnimationFrame(window.minecraft.game.raf);
    });
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 15000,
    });
    const gameplay = await p.evaluate(
      ({ B, I }) => {
        const g = window.minecraft.game,
          check = (label, condition) => {
            if (!condition) throw Error(label);
          };
        g.mode = "survival";
        g.inventory.slots.fill(null);
        g.inventory.grid.fill(null);
        g.inventory.cursor = null;
        g.inventory.offhand = null;
        for (const i of [0, 1, 2])
          g.inventory.grid[i] = { id: I.GOLD, count: 1 };
        for (const i of [4, 7]) g.inventory.grid[i] = { id: I.STICK, count: 1 };
        check(
          "native golden pickaxe crafts",
          g.inventory.craftGrid(true)?.id === I.GOLD_PICK,
        );
        g.inventory.slots[0] = { id: I.GOLD_PICK, count: 1 };
        g.selected = 0;
        g.updateHand();
        g.handMesh.geometry.computeBoundingBox();
        check(
          "held item has depth",
          g.handMesh.geometry.boundingBox.max.z -
            g.handMesh.geometry.boundingBox.min.z >
            0,
        );
        const beds = [];
        for (let f = 0; f < 4; f++)
          for (const head of [false, true]) {
            const x = 2 + f * 3,
              z = head ? 18 : 14,
              y = 90;
            g.yaw = (f * Math.PI) / 2;
            for (let dx = -2; dx <= 2; dx++)
              for (let dz = -2; dz <= 2; dz++) {
                g.world.setBlock(x + dx, y - 1, z + dz, B.STONE);
                g.world.setBlock(x + dx, y, z + dz, B.AIR);
              }
            check("bed places", g.placeBed(x, y, z));
            const other = g.bedOther(x, y, z);
            check("partner exists", !!other);
            const before = g.drops
              .filter((d) => d.id === B.BED)
              .reduce((n, d) => n + d.count, 0);
            const hit = head ? other : [x, y, z];
            g.breakBlock(...hit);
            check(
              "both halves removed",
              g.world.getBlock(x, y, z) === B.AIR &&
                g.world.getBlock(...other) === B.AIR,
            );
            check(
              "one bed drop",
              g.drops
                .filter((d) => d.id === B.BED)
                .reduce((n, d) => n + d.count, 0) ===
                before + 1,
            );
            beds.push(true);
          }
        for (let x = 1; x < 12; x++)
          for (let z = 1; z < 12; z++) {
            g.world.setBlock(x, 70, z, B.STONE);
            g.world.setBlock(x, 71, z, B.WATER);
            for (let y = 72; y < 77; y++) g.world.setBlock(x, y, z, B.AIR);
          }
        g.buildChunk(0, 0);
        g.inventory.slots.fill(null);
        g.updateHand();
        const avatar = g.makeAvatar("Lighting audit", 30, "steve");
        avatar.group.position.set(5.5, 72, 5.5);
        g.scene.add(avatar.group);
        let litSkin = false;
        avatar.group.traverse((o) => {
          if (o.isMesh && o.material.isMeshLambertMaterial) litSkin = true;
        });
        check("actual world skin is lit", litSkin);
        g.camera.position.set(5.5, 73.15, 10);
        g.camera.lookAt(5.5, 73.15, 5.5);
        g.ambient.intensity = 0.01;
        g.dirLight.intensity = 0;
        g.heldLight.strength = 0;
        for (const l of g.avatarLights) l.intensity = 0;
        const pixel = () => {
          g.renderer.render(g.scene, g.camera);
          const gl = g.renderer.getContext(),
            p = new Uint8Array(4);
          gl.readPixels(
            Math.floor(gl.drawingBufferWidth / 2),
            Math.floor(gl.drawingBufferHeight / 2),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            p,
          );
          check("no WebGL error", gl.getError() === gl.NO_ERROR);
          return [...p].slice(0, 3);
        };
        const dark = pixel();
        g.dirLight.position.set(7, 78, 10);
        g.dirLight.target.position.set(5.5, 73, 5.5);
        g.dirLight.intensity = 3;
        const sunlight = pixel();
        check(
          "actual avatar pixels react to directional light",
          sunlight.reduce((a, b) => a + b, 0) >
            dark.reduce((a, b) => a + b, 0) + 20,
        );
        g.dirLight.intensity = 0;
        g.inventory.slots[0] = { id: B.TORCH, count: 1 };
        g.updateHeldLight();
        const torch = pixel();
        check(
          "actual avatar pixels react to held torch",
          torch.reduce((a, b) => a + b, 0) >
            dark.reduce((a, b) => a + b, 0) + 10,
        );
        g.dirLight.intensity = 1;
        g.ambient.intensity = 0.6;
        g.camera.position.set(12, 76, 15);
        g.camera.lookAt(6, 71, 6);
        g.updateHeldLight();
        pixel();
        return {
          goldenPickaxe: true,
          extrudedItem: true,
          bedCases: beds.length,
          waterShader: true,
          avatarPixels: { dark, sunlight, torch },
        };
      },
      { B, I },
    );
    const icon = await p.evaluate(
      (id) => window.minecraft.game.icons[id],
      B.BED,
    );
    assert.ok(icon.startsWith("data:image/png;base64,"));
    const pillowPixels = await p.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let white = 0,
        red = 0;
      for (let n = 0; n < d.length; n += 4) {
        if (d[n + 3] > 200 && Math.min(d[n], d[n + 1], d[n + 2]) > 180) white++;
        if (d[n + 3] > 200 && d[n] > d[n + 1] * 1.5 && d[n] > d[n + 2] * 1.5)
          red++;
      }
      return { white, red };
    }, icon);
    assert.ok(
      pillowPixels.white > 10 && pillowPixels.red > 40,
      `bed native pillow/blanket pixels: ${JSON.stringify(pillowPixels)}`,
    );
    fs.writeFileSync(
      path.join(out, "bed-icon.png"),
      Buffer.from(icon.split(",")[1], "base64"),
    );
    let touch = null;
    if (mobile) {
      await p.evaluate(() => window.minecraft.game.setUI("playing"));
      await p.waitForSelector(".game-gesture-surface");
      const surface = await p.$eval(".game-gesture-surface", (e) => {
        const s = getComputedStyle(e);
        return {
          select: s.userSelect,
          webkit: s.webkitUserSelect,
          action: s.touchAction,
        };
      });
      assert.equal(surface.select, "none");
      assert.equal(surface.webkit, "none");
      assert.equal(surface.action, "none");
      await p.evaluate(() => {
        window.unpreventedMenus = 0;
        document.addEventListener("contextmenu", (e) => {
          if (!e.defaultPrevented) window.unpreventedMenus++;
        });
      });
      await p.touchscreen.touchStart(195, 280);
      await delay(1000);
      await p.touchscreen.touchEnd();
      touch = await p.evaluate(() => ({
        selection: getSelection()?.toString(),
        menus: window.unpreventedMenus,
      }));
      assert.equal(touch.selection, "");
      assert.equal(touch.menus, 0);
    }
    const editable = await p.evaluate(() => {
      const e = document.createElement("input");
      e.value = "miód i skrzynia";
      document.querySelector("#root").append(e);
      const style = getComputedStyle(e);
      e.focus();
      e.select();
      const result = {
        select: style.userSelect,
        webkit: style.webkitUserSelect,
        text: e.value.slice(e.selectionStart, e.selectionEnd),
      };
      e.remove();
      return result;
    });
    assert.equal(editable.select, "text");
    assert.equal(editable.webkit, "text");
    assert.equal(editable.text, "miód i skrzynia");
    assert.deepEqual(errors, []);
    reports.push({
      device: mobile ? "mobile-emulated" : "desktop",
      gameplay,
      touch,
      editable,
      errors,
    });
    await p.screenshot({
      path: path.join(out, mobile ? "mobile.png" : "desktop.png"),
    });
    console.log("PASS", JSON.stringify(reports.at(-1)));
    await context.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(out, "report.json"),
  JSON.stringify(
    {
      version: JSON.parse(fs.readFileSync(path.join(root, "package.json")))
        .version,
      environment:
        "Chromium/SwiftShader; mobile viewport and touch emulated; synthetic received peer packets; no live account sessions",
      reports,
    },
    null,
    2,
  ) + "\n",
);
