/* Landscape-only gameplay; fresh synthetic local saves, no real accounts/server. */
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
const output = path.join(root, ".cache/verification437");
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => a !== "--single-process"),
  headless: true,
  protocolTimeout: 90000,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const reports = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (p, label) =>
  p.evaluate((label) => {
    const b = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === label,
    );
    if (!b) throw Error("Missing " + label);
    b.click();
  }, label);
try {
  for (const mode of ["touch", "desktop"]) {
    const context = await browser.createBrowserContext(),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const viewport = (portrait) => ({
      width: portrait ? 390 : 844,
      height: portrait ? 844 : 390,
      isMobile: true,
      hasTouch: true,
    });
    await p.setViewport(viewport(true));
    await p.evaluateOnNewDocument((mode) => {
      sessionStorage.setItem("blockcraft-portrait-ok", "1");
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          controlMode: mode,
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
            id: "landscape437",
            name: "Audyt poziomu",
            seed: 437,
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
      // Exercise the Safari-style/manual-rotation path even on Chromium.
      Element.prototype.requestFullscreen = async () => {
        throw new Error("Fullscreen unavailable in fixture");
      };
      if (screen.orientation)
        Object.defineProperty(screen.orientation, "lock", {
          configurable: true,
          value: async () => {
            throw new Error("Orientation lock unavailable in fixture");
          },
        });
    }, mode);
    await p.goto(process.env.BROWSER_URL ?? "http://127.0.0.1:4173/", {
      waitUntil: "domcontentloaded",
    });
    await p.waitForSelector(".java-title-screen");
    assert.equal(
      await p.$(".mc-orient-guard"),
      null,
      "portrait menu remains usable",
    );
    await clickText(p, "Tryb jednoosobowy");
    await p.evaluate(() => document.querySelector("[role=option]").click());
    await clickText(p, "Graj w wybranym świecie");
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    await p.waitForSelector(".mc-orient-guard");
    assert.equal(await p.$eval("[data-game-surface]", (e) => e.inert), true);
    assert.equal(
      await p.evaluate(() => window.minecraft.game.orientationBlocked),
      true,
    );
    assert.equal(
      await p.evaluate(() =>
        document.body.textContent.includes("Graj w pionie mimo to"),
      ),
      false,
    );
    await p.keyboard.press("Escape");
    await p.keyboard.press("w");
    await p.evaluate(() => window.minecraft.game.setUI("playing"));
    assert.equal(
      await p.evaluate(() => window.minecraft.game.ui),
      "paused",
      "legacy key, keyboard and setUI cannot bypass gate",
    );
    await p.tap(".mc-orient-guard button");
    await p.waitForFunction(() =>
      document
        .querySelector(".mc-orient-guard [role=status]")
        ?.textContent.includes("ręcznie"),
    );
    assert.ok(
      await p.$(".mc-orient-guard"),
      "failed lock still gates gameplay",
    );
    await p.screenshot({ path: path.join(output, `${mode}-portrait.png`) });
    await p.setViewport(viewport(false));
    await p.waitForFunction(
      () =>
        !document.querySelector(".mc-orient-guard") &&
        !window.minecraft.game.orientationBlocked,
    );
    assert.equal(await p.$eval("[data-game-surface]", (e) => e.inert), false);
    const join = await p.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((b) =>
        ["Dołącz do świata", "Dotknij, aby grać"].includes(
          b.textContent.trim(),
        ),
      );
      b.id = "landscape-join";
      return !!b;
    });
    assert.ok(join);
    await p.click("#landscape-join");
    await p.waitForFunction(() => window.minecraft.game.ui === "playing");
    await p.evaluate(() => {
      const g = window.minecraft.game;
      g.inventory.slots[0] = { id: 68, count: 8 };
      g.inventory.offhand = { id: 68, count: 1 };
      g.selected = 0;
      g.updateHand();
      g.emitHud();
    });
    await p.screenshot({ path: path.join(output, `${mode}-landscape.png`) });
    await p.evaluate(() => {
      const g = window.minecraft.game;
      g.keys.add("KeyW");
      g.mouseLeft = g.mouseRight = true;
      g.bowDraw = 1;
      g.sprinting = true;
    });
    await p.setViewport(viewport(true));
    await p.waitForFunction(
      () =>
        window.minecraft.game.orientationBlocked &&
        window.minecraft.game.ui === "paused",
    );
    const canceled = await p.evaluate(() => {
      const g = window.minecraft.game;
      return {
        keys: g.keys.size,
        left: g.mouseLeft,
        right: g.mouseRight,
        bow: g.bowDraw,
        sprint: g.sprinting,
        progress: g.breakProgress,
      };
    });
    assert.deepEqual(canceled, {
      keys: 0,
      left: false,
      right: false,
      bow: -1,
      sprint: false,
      progress: 0,
    });
    const frozen = await p.evaluate(() => ({
      time: window.minecraft.game.time,
      pos: window.minecraft.game.body.pos.toArray(),
    }));
    await wait(350);
    assert.deepEqual(
      await p.evaluate(() => ({
        time: window.minecraft.game.time,
        pos: window.minecraft.game.body.pos.toArray(),
      })),
      frozen,
      "singleplayer must not run behind gate",
    );
    await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => window.minecraft.game.ui), "paused");
    await p.setViewport(viewport(false));
    await p.waitForFunction(() => !window.minecraft.game.orientationBlocked);
    assert.equal(
      await p.evaluate(() => window.minecraft.game.ui),
      "paused",
      "no automatic resume",
    );
    await p.evaluate(() => {
      const g = window.minecraft.game;
      g.setUI("playing");
      g.openInventory(false);
      g.inventory.cursor = { id: 1, count: 7 };
      g.inventory.grid[0] = { id: 2, count: 9 };
      g.emitHud();
    });
    const inventory = await p.evaluate(() =>
      JSON.stringify({
        cursor: window.minecraft.game.inventory.cursor,
        grid: window.minecraft.game.inventory.grid,
      }),
    );
    await p.setViewport(viewport(true));
    await p.waitForFunction(() => window.minecraft.game.orientationBlocked);
    assert.equal(await p.evaluate(() => window.minecraft.game.ui), "inventory");
    assert.equal(await p.$eval("[data-game-surface]", (e) => e.inert), true);
    await p.keyboard.press("Escape");
    await p.keyboard.press("e");
    assert.equal(
      await p.evaluate(() =>
        JSON.stringify({
          cursor: window.minecraft.game.inventory.cursor,
          grid: window.minecraft.game.inventory.grid,
        }),
      ),
      inventory,
      "rotation preserves crafting/cursor, no discard or close",
    );
    await p.setViewport(viewport(false));
    await p.waitForFunction(() => !window.minecraft.game.orientationBlocked);
    assert.equal(await p.evaluate(() => window.minecraft.game.ui), "inventory");
    await p.evaluate(() => window.minecraft.game.setUI("dead"));
    await p.setViewport(viewport(true));
    await p.waitForSelector(".mc-orient-guard");
    await p.keyboard.press("r");
    assert.equal(
      await p.evaluate(() => window.minecraft.game.ui),
      "dead",
      "death screen keyboard cannot bypass gate",
    );
    await clickText(p, "Zapisz i wróć do menu");
    await p.waitForFunction(() => !window.minecraft?.game);
    assert.equal(await p.$(".mc-orient-guard"), null);
    assert.ok(
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem("blockcraft-saves-v2")).some(
          (s) => s.id === "landscape437",
        ),
      ),
    );
    assert.deepEqual(errors, []);
    reports.push({
      mode,
      portrait: [390, 844],
      landscape: [844, 390],
      legacyOptOutIgnored: true,
      unsupportedLockFallback: true,
      canceled,
      singleplayerFrozen: true,
      inventoryPreserved: true,
      noAutomaticResume: true,
      portraitQuit: true,
      errors,
    });
    console.log("PASS", mode);
    await context.close();
  }
  const context = await browser.createBrowserContext(),
    p = await context.newPage();
  await p.setViewport({ width: 600, height: 900 });
  await p.goto(process.env.BROWSER_URL ?? "http://127.0.0.1:4173/", {
    waitUntil: "domcontentloaded",
  });
  await p.waitForSelector(".java-title-screen");
  assert.equal(
    await p.$(".mc-orient-banner"),
    null,
    "fine-pointer desktop portrait stays supported",
  );
  reports.push({ mode: "desktop-portrait", blocked: false });
  await context.close();
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(
      {
        version: "4.37.0",
        reports,
        limits: [
          "Synthetic local guests, not physical phone or live multiplayer sessions",
          "No browser-native hand pose or lighting parity claim",
        ],
      },
      null,
      2,
    ) + "\n",
  );
} catch (error) {
  for (const p of await browser.pages()) {
    console.error(
      await p.evaluate(() => ({
        button: (() => {
          const b = document.querySelector(".mc-orient-guard button"),
            r = b?.getBoundingClientRect();
          return {
            rect: r?.toJSON(),
            hit:
              r &&
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.outerHTML,
            inert: b?.closest("[inert]")?.outerHTML.slice(0, 200),
          };
        })(),
        text: document.body.innerText,
        ui: window.minecraft?.game?.ui,
        blocked: window.minecraft?.game?.orientationBlocked,
      })),
    );
    await p.screenshot({ path: path.join(output, "failure.png") });
  }
  throw error;
} finally {
  await browser.close();
}
