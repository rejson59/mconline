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
const facingAudit = process.env.BROWSER_FACING === "1";
const furnaceAudit = facingAudit || process.env.BROWSER_FURNACE === "1";
const outputDir = path.join(
  root,
  facingAudit
    ? ".cache/verification424"
    : furnaceAudit
      ? ".cache/verification423"
      : ".cache/verification422",
);
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
      "export { B,T } from './src/game/blocks'; export { I } from './src/game/items'; export {JAVA_FACING_TEXTURES} from './src/game/art/javaFacing.generated';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: enumFile,
});
const { B, I, T, JAVA_FACING_TEXTURES } = await import(
  pathToFileURL(enumFile).href
);
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
    let furnaceResult;
    if (furnaceAudit) {
      const entityDrops = await p.evaluate(
        ({ B, I }) => {
          const g = window.minecraft.game;
          g.closeInventory();
          const selected = g.selected,
            previous = g.inventory.slots[35];
          g.inventory.slots[35] = { id: I.DIAMOND_PICK, count: 1, dur: 1561 };
          g.selected = 35;
          const result = [];
          for (const [block, item, count] of [
            [B.IRON_ORE, I.RAW_IRON, 1],
            [B.GOLD_ORE, I.RAW_GOLD, 1],
            [B.CAMPFIRE, I.CHARCOAL, 2],
          ]) {
            g.world.setBlock(10, 65, 10, block);
            const n = g.drops.length;
            if (!g.breakBlock(10, 65, 10))
              throw Error("Could not break furnace audit block");
            const fresh = g.drops
              .slice(n)
              .map((d) => ({ id: d.id, count: d.count }));
            if (JSON.stringify(fresh) !== JSON.stringify([{ id: item, count }]))
              throw Error("Incorrect native entity " + JSON.stringify(fresh));
            result.push(...fresh);
          }
          g.inventory.slots[35] = previous;
          g.selected = selected;
          g.inventory.add(I.CHARCOAL, 3);
          g.inventory.add(I.RAW_IRON, 4);
          g.inventory.add(I.RAW_GOLD, 2);
          g.world.setBlock(12, 65, 12, B.FURNACE);
          g.furnaces.set("12,65,12", {
            x: 12,
            y: 65,
            z: 12,
            input: { id: I.RAW_IRON, count: 2 },
            fuel: { id: I.CHARCOAL, count: 2 },
            output: null,
            burn: 0,
            burnMax: 0,
            cook: 0,
          });
          g.openFurnace(12, 65, 12);
          g.updateFurnaces(5);
          const f = g.currentFurnace();
          if (
            f.output ||
            Math.abs(f.cook - 0.5) > 1e-6 ||
            Math.abs(f.burn - 75) > 1e-6 ||
            g.world.getBlock(12, 65, 12) !== B.FURNACE_ON
          )
            throw Error("Incorrect halfway furnace state");
          return result;
        },
        { B, I },
      );
      await p.waitForFunction(
        ({ I }) => {
          const g = window.minecraft.game;
          return (
            document.querySelector(
              '[data-slot-area="furnace"][data-slot-index="0"] img',
            )?.src === g.icons[I.RAW_IRON] &&
            document.querySelector(
              '[data-slot-area="furnace"][data-slot-index="1"] img',
            )?.src === g.icons[I.CHARCOAL]
          );
        },
        {},
        { I },
      );
      await p.screenshot({
        path: path.join(outputDir, device + "-furnace-half.png"),
      });
      await p.waitForFunction(() => !document.pointerLockElement);
      await p.evaluate(() => window.minecraft.game.updateFurnaces(5));
      await p.waitForSelector(
        '[data-slot-area="furnace"][data-slot-index="2"] img',
      );
      const slot = await p.$('[data-slot-area="furnace"][data-slot-index="2"]');
      if (device === "mobile") {
        const box = await slot.boundingBox();
        await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      } else await slot.click();
      await p.screenshot({
        path: path.join(outputDir, device + "-furnace-click.png"),
      });
      furnaceResult = await p.evaluate(
        ({ I }) => {
          const g = window.minecraft.game,
            f = g.currentFurnace();
          if (
            g.inventory.cursor?.id !== I.IRON ||
            g.inventory.cursor.count !== 1 ||
            f.output
          )
            throw Error(
              "Actual furnace result-slot input failed " +
                JSON.stringify({
                  cursor: g.inventory.cursor,
                  f,
                  ui: g.ui,
                  body: document.body.innerText.slice(-400),
                }),
            );
          g.closeInventory();
          g.save();
          return {
            input: f.input,
            fuel: f.fuel,
            burn: f.burn,
            cook: f.cook,
            ingots: g.inventory.countOf(I.IRON),
            charcoal: g.inventory.countOf(I.CHARCOAL),
          };
        },
        { I },
      );
      furnaceResult.entityDrops = entityDrops;
    }
    let facingResult;
    if (facingAudit) {
      facingResult = await p.evaluate(
        async ({ B, I, T, art }) => {
          const g = window.minecraft.game;
          g.closeInventory();
          const image = g.atlasTex.image,
            ctx = image.getContext("2d");
          let channels = 0;
          for (const [name, tile] of Object.entries({
            furnace_front: T.furnace_front,
            furnace_front_on: T.furnace_lit,
            furnace_side: T.furnace_side,
            furnace_top: T.furnace_top,
          })) {
            const pic = new Image();
            pic.src = "data:image/png;base64," + art[name];
            await pic.decode();
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 16;
            const c = canvas.getContext("2d");
            c.drawImage(pic, 0, 0);
            const expected = c.getImageData(0, 0, 16, 16).data,
              actual = ctx.getImageData(
                (tile % 16) * 16,
                Math.floor(tile / 16) * 16,
                16,
                16,
              ).data;
            for (let i = 0; i < actual.length; i++) {
              if (actual[i] !== expected[i])
                throw Error(
                  "Production native atlas mismatch " + name + "/" + i,
                );
              channels++;
            }
          }
          const ray = g.raycastTarget,
            selected = g.selected,
            previous = g.inventory.slots[35],
            oldFurnaces = g.furnaces;
          const rows = [];
          g.furnaces = new Map();
          g.selected = 35;
          try {
            for (let i = 0; i < 8; i++) {
              const x = 16 + i * 2,
                yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][i % 4],
                cold = [B.FURNACE, B.FURNACE_E, B.FURNACE_N, B.FURNACE_W][
                  i % 4
                ];
              g.world.setBlock(x, 64, 10, B.STONE);
              for (let y = 65; y <= 68; y++) g.world.setBlock(x, y, 10, B.AIR);
              g.inventory.slots[35] = { id: B.FURNACE, count: 1 };
              g.yaw = yaw;
              g.pitch = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
              g.raycastTarget = () => ({
                x,
                y: 64,
                z: 10,
                nx: 0,
                ny: 1,
                nz: 0,
                id: B.STONE,
              });
              g.tryUse();
              if (
                g.world.peekBlock(x, 65, 10) !== cold ||
                g.inventory.slots[35]
              )
                throw Error("Actual furnace placement mismatch " + i);
              g.openFurnace(x, 65, 10);
              const f = g.currentFurnace();
              if (!f) throw Error("Oriented container did not open");
              if (i >= 4) {
                f.input = { id: I.RAW_IRON, count: 2 };
                f.fuel = { id: I.CHARCOAL, count: 1 };
              }
              rows.push({
                x,
                cold,
                id:
                  i < 4
                    ? cold
                    : [
                        B.FURNACE_ON,
                        B.FURNACE_ON_E,
                        B.FURNACE_ON_N,
                        B.FURNACE_ON_W,
                      ][i % 4],
              });
            }
            g.updateFurnaces(5);
            for (const row of rows)
              if (g.world.peekBlock(row.x, 65, 10) !== row.id)
                throw Error("Ignition rotated or erased a furnace");
          } finally {
            g.raycastTarget = ray;
            g.selected = selected;
            g.inventory.slots[35] = previous;
            g.furnaces = new Map([...oldFurnaces, ...g.furnaces]);
          }
          g.closeInventory();
          g.body.pos.set(24, 65, 16);
          g.yaw = 0;
          g.pitch = -0.17;
          g.updateCamera(0.016);
          g.save();
          g.requestChunk(1, 0);
          return { rows, atlasChannels: channels };
        },
        { B, I, T, art: JAVA_FACING_TEXTURES },
      );
      await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
        timeout: 15000,
      });
      const mesh = await p.evaluate(() => {
        const g = window.minecraft.game,
          c = g.world.getChunk(1, 0),
          expected = g.world.buildMesh(c);
        let values = 0;
        for (const m of c.meshes)
          for (const [name, a] of Object.entries(m.geometry.attributes)) {
            const b = expected[m.renderOrder].getAttribute(name);
            if (a.array.length !== b.array.length)
              throw Error("Facing Worker layout mismatch");
            for (let i = 0; i < a.array.length; i++) {
              if (a.array[i] !== b.array[i])
                throw Error("Facing Worker attribute mismatch " + name);
              values++;
            }
          }
        if (!values) throw Error("No native-facing geometry rendered");
        for (const e of expected) e.dispose();
        g.firstPerson.render(g.renderer, g.scene, g.camera);
        return { values, worker: g.meshWorker.report().state };
      });
      facingResult.mesh = mesh;
      await p.screenshot({
        path: path.join(outputDir, device + "-facings.png"),
      });
    }
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
          charcoal: g.inventory.countOf(I.CHARCOAL),
          rawIron: g.inventory.countOf(I.RAW_IRON),
          rawGold: g.inventory.countOf(I.RAW_GOLD),
          furnace: g.furnaces.get("12,65,12"),
          facingRows: Array.from({ length: 8 }, (_, i) => ({
            id: g.world.peekBlock(16 + i * 2, 65, 10),
            state: g.furnaces.get(`${16 + i * 2},65,10`),
          })),
          gui: JSON.parse(localStorage.getItem("blockcraft-settings")).guiScale,
        };
      },
      { I },
    );
    if (
      restored.compass !== 1 ||
      restored.coal !== 16 ||
      restored.redstone !== 0 ||
      restored.iron !== (furnaceAudit ? 1 : 0) ||
      restored.gui !== (device === "mobile" ? 0 : 2)
    )
      throw Error("Save/GUI mismatch " + JSON.stringify(restored));
    if (
      furnaceAudit &&
      (restored.charcoal !== 3 ||
        restored.rawIron !== 4 ||
        restored.rawGold !== 2 ||
        restored.furnace?.input?.id !== I.RAW_IRON ||
        restored.furnace.input.count !== 1 ||
        restored.furnace.fuel?.id !== I.CHARCOAL ||
        restored.furnace.fuel.count !== 1 ||
        restored.furnace.output ||
        restored.furnace.burn < 69 ||
        restored.furnace.burn > 70)
    )
      throw Error("Furnace/material save mismatch " + JSON.stringify(restored));
    if (facingAudit)
      for (let i = 0; i < 8; i++) {
        const row = restored.facingRows[i];
        if (
          row.id !== facingResult.rows[i].id ||
          !row.state ||
          row.state.input?.count !== (i < 4 ? undefined : 2) ||
          row.state.output ||
          row.state.burn < (i < 4 ? 0 : 73) ||
          row.state.burn > (i < 4 ? 0 : 75)
        )
          throw Error("Facing save mismatch " + JSON.stringify(row));
      }
    if (errors.length) throw Error("Browser errors " + errors.join("\n"));
    reports.push({
      device,
      placed,
      ...result,
      furnaceResult,
      facingResult,
      restored,
      errors,
    });
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
