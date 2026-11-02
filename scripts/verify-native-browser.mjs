/** Optional production crafting UI, block-drop and save/reload regression suite.
 * npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start the production preview separately, then npm run test:browser:native.
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
const outputDir = path.join(root, ".cache/verification422");
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
const { build } = await import("esbuild");
const enumFile = path.join(outputDir, "enums.mjs");
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
  outfile: enumFile,
});
const { B, I } = await import(pathToFileURL(enumFile).href);
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
        ? { width: 390, height: 844, isMobile: true, hasTouch: true }
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
      localStorage.setItem("blockcraft-java-recipe-book", "true");
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "native422",
            name: "Audyt receptur",
            seed: 4222026,
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
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((e) => e.textContent?.trim() === "Graj w pionie mimo to")
        ?.click(),
    );
    await p.evaluate(
      ({ I }) => {
        const g = window.minecraft.game;
        g.mode = "survival";
        g.ui = "playing";
        g.inventory.slots.fill(null);
        g.inventory.grid.fill(null);
        g.inventory.cursor = null;
        g.inventory.add(I.IRON, 4);
        g.inventory.add(I.REDSTONE, 1);
        g.inventory.add(I.COAL, 16);
        g.openInventory(true);
      },
      { I },
    );
    await p.waitForSelector(
      '[aria-label="Szukaj receptur po nazwie lub składniku"]',
    );
    if (device === "mobile") {
      await p.waitForFunction(
        () =>
          sessionStorage.getItem("blockcraft-portrait-ok") === "1" ||
          [...document.querySelectorAll("button")].some(
            (e) => e.textContent?.trim() === "Graj w pionie mimo to",
          ),
      );
      await p.evaluate(() =>
        [...document.querySelectorAll("button")]
          .find((e) => e.textContent?.trim() === "Graj w pionie mimo to")
          ?.click(),
      );
      await p.waitForFunction(
        () =>
          ![...document.querySelectorAll("button")].some(
            (e) => e.textContent?.trim() === "Graj w pionie mimo to",
          ),
      );
    }
    await p.type(
      '[aria-label="Szukaj receptur po nazwie lub składniku"]',
      "Kompas",
    );
    await p.waitForSelector('[aria-label="Ułóż: Kompas"]');
    await p.click('[aria-label="Ułóż: Kompas"]');
    await p.screenshot({
      path: path.join(outputDir, device + "-placement.png"),
    });
    const placed = await p.evaluate(
      ({ I }) => {
        const g = window.minecraft.game,
          inv = g.inventory,
          r = inv.gridMatch(true);
        if (r?.out.id !== I.COMPASS)
          throw Error(
            "Recipe book did not place native compass: " +
              JSON.stringify({
                grid: inv.grid,
                cursor: inv.cursor,
                slots: inv.slots,
                ui: g.ui,
                table: g.craftingTable,
                body: document.body.innerText.slice(-1000),
              }),
          );
        if (
          inv.grid[4]?.id !== I.REDSTONE ||
          inv.countOf(I.COAL) !== 16 ||
          inv.countOf(I.COMPASS) !== 0
        )
          throw Error("Wrong recipe resources or premature output");
        return inv.grid.map((s) => s?.id ?? 0);
      },
      { I },
    );
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((e) => e.textContent?.trim() === "Powrót do ekwipunku")
        ?.click(),
    );
    const output = await p.$('[data-craft-result] [role="button"]');
    if (!output) throw Error("No result slot");
    if (device === "mobile") {
      const box = await output.boundingBox();
      await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else await output.click();
    const result = await p.evaluate(
      ({ B, I }) => {
        const g = window.minecraft.game,
          inv = g.inventory;
        if (
          inv.cursor?.id !== I.COMPASS ||
          inv.cursor.count !== 1 ||
          inv.grid.some(Boolean) ||
          inv.countOf(I.COAL) !== 16
        )
          throw Error("Actual result-slot input failed");
        g.closeInventory();
        // Actual Game.breakBlock -> spawned drop entities, not only the pure loot helper.
        const drops = [];
        for (const id of [B.SLIME_BLOCK, B.HONEYCOMB_BLOCK]) {
          g.world.setBlock(10, 65, 10, id);
          const before = g.drops.length;
          if (!g.breakBlock(10, 65, 10))
            throw Error("Could not break audit block");
          const fresh = g.drops
            .slice(before)
            .map((d) => ({ id: d.id, count: d.count }));
          if (JSON.stringify(fresh) !== JSON.stringify([{ id, count: 1 }]))
            throw Error("Wrong actual entity drop " + JSON.stringify(fresh));
          drops.push(...fresh);
        }
        g.openInventory(false);
        g.save();
        return {
          cursorReturned: inv.countOf(I.COMPASS),
          coal: inv.countOf(I.COAL),
          drops,
        };
      },
      { B, I },
    );
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
    const restored = await p.evaluate(
      ({ I }) => {
        const g = window.minecraft.game;
        cancelAnimationFrame(g.raf);
        return {
          compass: g.inventory.countOf(I.COMPASS),
          coal: g.inventory.countOf(I.COAL),
          redstone: g.inventory.countOf(I.REDSTONE),
          iron: g.inventory.countOf(I.IRON),
          gui: JSON.parse(localStorage.getItem("blockcraft-settings")).guiScale,
        };
      },
      { I },
    );
    if (
      restored.compass !== 1 ||
      restored.coal !== 16 ||
      restored.redstone !== 0 ||
      restored.iron !== 0 ||
      restored.gui !== (device === "mobile" ? 0 : 2)
    )
      throw Error("Save/GUI mismatch " + JSON.stringify(restored));
    if (errors.length) throw Error("Browser errors " + errors.join("\n"));
    reports.push({ device, placed, ...result, restored, errors });
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
      environment:
        "Chromium / SwiftShader sandbox, mobile is viewport emulation",
      reports,
    },
    null,
    2,
  ) + "\n",
);
