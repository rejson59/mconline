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
import { fixtureDB } from "./fixtures/shared-state-db.mjs";
const db = await fixtureDB(),
  out = path.join(root, ".cache/verification429");
fs.mkdirSync(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export { PublicServer } from './src/game/online'; export { profileRow } from './src/game/profile'; export { B } from './src/game/blocks'; export { I } from './src/game/items';",
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "SharedAudit",
  outfile: path.join(out, "bridge.js"),
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
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const peers = [];
let checks = 0;
const check = (label, value) => {
  assert.ok(value, label);
  checks++;
  console.log("PASS " + label);
};
try {
  for (let i = 0; i < 2; i++) {
    const account = crypto.randomUUID(),
      session = crypto.randomUUID(),
      pid = (await one("select 'p'||left(md5($1),19) pid", [account])).pid;
    const context = await browser.createBrowserContext(),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.setViewport(
      i
        ? { width: 390, height: 844, isMobile: true, hasTouch: true }
        : { width: 960, height: 600 },
    );
    await p.exposeFunction("sharedRpc", async (name, a) => {
      try {
        let data;
        if (name === "profile")
          data = [
            (
              await one(
                "select mconline_profile($1,$2,$3,$4,$5,$6,$7,$8,false)->0 p",
                [
                  account,
                  "Fixture",
                  session,
                  "public",
                  a,
                  a.mconline_guard === true,
                  a.mconline_base ?? null,
                  a.mconline_save ?? null,
                ],
              )
            ).p,
          ];
        else if (
          ["mconline_chest", "mconline_mobs", "mconline_mob_action"].includes(
            name,
          )
        )
          data = (
            await one(`select ${name}($1,$2,$3,$4,$5) r`, [
              account,
              "Fixture",
              session,
              "public",
              a,
            ])
          ).r;
        else if (name === "blockcraft_drop_op")
          data = (
            await db.query(
              "select * from blockcraft_drop_op($1,$2,$3,$4,$5,$6)",
              [a.p_world, pid, a.p_op, a.p_drop, a.p_uid, a.p_dim],
            )
          ).rows.map((r) => r.blockcraft_drop_op);
        else if (name === "blockcraft_write_blocks")
          data = (
            await one("select blockcraft_write_blocks($1,$2,$3) r", [
              a.p_world,
              a.p_key,
              a.p_edits,
            ])
          ).r;
        else throw Error("Unexpected RPC " + name);
        return { data, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    });
    await p.evaluateOnNewDocument(() => {
      localStorage.setItem(
        "blockcraft-settings",
        JSON.stringify({
          quality: "potato",
          renderDistance: 2,
          volume: 0,
          lod: false,
          autoQuality: false,
          fpsCap: 30,
          fpsCapUserSet: true,
        }),
      );
      sessionStorage.setItem("blockcraft-portrait-ok", "1");
      localStorage.setItem(
        "blockcraft-saves-v2",
        JSON.stringify([
          {
            id: "shared-audit",
            name: "Shared audit",
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
    });
    await p.goto(pathToFileURL(path.join(root, "dist/index.html")).href, {
      waitUntil: "domcontentloaded",
    });
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent.trim() === "Tryb jednoosobowy")
        .click(),
    );
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent.trim() === "Graj w wybranym świecie")
        .click(),
    );
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    await p.evaluate(() => {
      cancelAnimationFrame(window.minecraft.game.raf);
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent.trim() === "Graj w pionie mimo to")
        ?.click();
    });
    await p.addScriptTag({ path: path.join(out, "bridge.js") });
    await p.evaluate(
      async ({ pid, i }) => {
        const g = window.minecraft.game,
          { PublicServer, profileRow, B } = SharedAudit;
        const client = {
          from: () => ({ upsert: (row) => window.sharedRpc("profile", row) }),
          rpc: async (name, args) => {
            const r = await window.sharedRpc(name, args);
            if (
              window.loseAck &&
              name === "mconline_chest" &&
              args.op === "commit"
            ) {
              window.loseAck = false;
              return {
                data: null,
                error: { message: "synthetic lost ACK AFTER actual commit" },
              };
            }
            return r;
          },
        };
        const net = new PublicServer({
          id: pid,
          pid,
          name: "Fixture",
          client,
          accountBound: true,
        });
        net.status = "connected";
        net.plots.update("a".repeat(64), []);
        g.net = net;
        net.onMessage = (m) => g.onNetMessage(m);
        net.onChat = (n, text) => {
          window.auditChat ??= [];
          window.auditChat.push(n + ": " + text);
        };
        g.mode = "survival";
        g.inventory.slots.fill(null);
        g.inventory.cursor = null;
        g.body.pos.set(4.5 - i, 65, 8.5);
        g.inventory.slots[0] = i
          ? null
          : { id: B.STONE, count: 5, name: "Shared metadata" };
        g.mobs.forEach((m) => g.scene.remove(m.group));
        g.mobs = [];
        const r = await window.sharedRpc(
          "profile",
          profileRow(g.buildProfile(), "public"),
        );
        if (r.error) throw Error(r.error.message);
        net.checkpoint.load(r.data[0]);
        g.world.setBlock(4, 65, 4, B.CHEST);
        g.flushNetEdits();
        await net.flush();
      },
      { pid, i },
    );
    peers.push({ context, p, errors, pid });
  }
  const [a, b] = peers.map((p) => p.p);
  const idle = async (p) =>
    p.waitForFunction(() => !window.minecraft.game.sharedBusy, {
      timeout: 20000,
    });
  const open = async (p) => {
    await p.evaluate(() => window.minecraft.game.openChest(4, 65, 4));
    await idle(p);
  };
  await open(a);
  await a.evaluate(() => window.minecraft.game.clickInventorySlot(0, false));
  await idle(a);
  check(
    "cursor withdrawal is an atomic shared transaction",
    await a.evaluate(
      () =>
        window.minecraft.game.inventory.cursor?.count === 5 &&
        window.minecraft.game.inventory.slots[0] === null,
    ),
  );
  await a.evaluate(() => window.minecraft.game.clickChest(0, false));
  await idle(a);
  await open(b);
  check(
    "second real renderer opens the same ordinary chest",
    await b.evaluate(
      () => window.minecraft.game.currentChest()?.slots[0]?.count === 5,
    ),
  );
  check(
    "custom stack metadata survives the transfer",
    await b.evaluate(
      () =>
        window.minecraft.game.currentChest()?.slots[0]?.name ===
        "Shared metadata",
    ),
  );
  await Promise.all([
    a.evaluate(() => window.minecraft.game.clickChest(0, false)),
    b.evaluate(() => window.minecraft.game.clickChest(0, false)),
  ]);
  await Promise.all([idle(a), idle(b)]);
  const cursors = await Promise.all([
    a.evaluate(() => window.minecraft.game.inventory.cursor?.count ?? 0),
    b.evaluate(() => window.minecraft.game.inventory.cursor?.count ?? 0),
  ]);
  check(
    "two simultaneous GUI withdrawals produce one five-item stack",
    cursors[0] + cursors[1] === 5 && cursors.filter(Boolean).length === 1,
  );
  const winner = cursors[0] ? a : b;
  await winner.evaluate(() => {
    window.loseAck = true;
    const g = window.minecraft.game;
    g.selected = 0;
    g.clickChest(0, false);
    g.onKeyDown({ code: "Digit2", preventDefault() {} });
    g.clickArmorSlot(0);
    if (g.selected !== 0) throw Error("Hotbar mutated during transaction");
  });
  await idle(winner);
  check(
    "commit with a lost ACK resolves without restoring a duplicate cursor",
    await winner.evaluate(
      () => window.minecraft.game.inventory.cursor === null,
    ),
  );
  await open(a);
  await open(b);
  check(
    "after ambiguity both readers still see exactly five items",
    (await a.evaluate(
      () => window.minecraft.game.currentChest().slots[0]?.count === 5,
    )) &&
      (await b.evaluate(
        () => window.minecraft.game.currentChest().slots[0]?.count === 5,
      )),
  );
  // Last confirmed cursor return closes in one click; no implicit CAS retry.
  await a.evaluate(() => window.minecraft.game.clickChest(0, false));
  await idle(a);
  await a.evaluate(() => window.minecraft.game.closeInventory());
  await idle(a);
  check(
    "closing with a held stack returns it and closes once",
    await a.evaluate(
      () =>
        window.minecraft.game.ui === "playing" &&
        window.minecraft.game.inventory.cursor === null &&
        window.minecraft.game.inventory.countOf(SharedAudit.B.STONE) === 5,
    ),
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    await g.flushSharedMobs();
    await g.performSharedMobAction("o:0:0", () => g.spawnMob("cow", 7, 65, 8));
  });
  await b.evaluate(async () => {
    const g = window.minecraft.game;
    await g.flushSharedMobs();
  });
  const population = await Promise.all([
    a.evaluate(() =>
      window.minecraft.game.mobs.map((m) => [m.netId, m.type, m.health]),
    ),
    b.evaluate(() =>
      window.minecraft.game.mobs.map((m) => [m.netId, m.type, m.health]),
    ),
  ]);
  check(
    "two renderers share canonical entity IDs/types/health",
    population[0].length === 1 &&
      JSON.stringify(population[0]) === JSON.stringify(population[1]),
  );
  await b.evaluate(async () => {
    const g = window.minecraft.game;
    const m = g.mobs[0];
    await g.performSharedMobAction(m.netRegion, () => {
      m.damage(100, 5, 8, "player");
    });
  });
  const exitPreflight=await a.evaluate(async()=>{
    const g=window.minecraft.game,prepare=g.net.prepareSharedAction.bind(g.net);let dispatched=false;
    g.net.prepareSharedAction=async(profile)=>{await prepare(profile);g.sharedDisposed=true;};
    try{await g.performSharedMobAction('o:0:0',()=>{dispatched=true;});}
    finally{g.sharedDisposed=false;g.net.prepareSharedAction=prepare;}
    return !dispatched&&!g.sharedBusy&&!g.net.stateBusy&&g.net.stateJournal.read()===null;
  });
  check('exit during preflight never dispatches or creates a stale transfer journal',exitPreflight);
  await a.evaluate(async()=>{
    await window.minecraft.game.performSharedMobAction('o:0:0',()=>{throw Error('Synthetic local action failure before dispatch');});
  });
  check('local callback failure releases preflight without blocking future actions',await a.evaluate(()=>{
    const g=window.minecraft.game;return !g.sharedBusy&&!g.net.stateBusy&&g.net.stateJournal.read()===null;
  }));
  await a.evaluate(async () => {
    await window.minecraft.game.flushSharedMobs();
  });
  check(
    "a follower kill is visible to the coordinator",
    await a.evaluate(
      () =>
        window.minecraft.game.mobs[0].dead &&
        window.minecraft.game.mobs[0].looted,
    ),
  );
  check(
    "death publishes shared loot and XP instead of private orbs",
    (
      await one(
        "select count(*)::int n from blockcraft_drops where (payload->'stack'->>'id')::int=65535",
      )
    ).n >= 1,
  );
  const xp = (
    await one(
      "select payload from blockcraft_drops where (payload->'stack'->>'id')::int=65535 limit 1",
    )
  ).payload;
  const grantA = await db.query(
    "select * from blockcraft_drop_op('public',$1,'claim',null,$2,'o')",
    [peers[0].pid, xp.uid],
  );
  const grantB = await db.query(
    "select * from blockcraft_drop_op('public',$1,'claim',null,$2,'o')",
    [peers[1].pid, xp.uid],
  );
  check(
    "shared XP has a single pickup owner",
    grantA.rows.length === 1 && grantB.rows.length === 0,
  );
  await a.evaluate((drop) => {
    const g = window.minecraft.game;
    g.onNetMessage({ t: "pickup", from: "database", to: g.net.id, drop });
    g.deliverPickups();
    g.deliverPickups();
  }, grantA.rows[0].blockcraft_drop_op);
  check(
    "XP delivery/replay credits experience once",
    await a.evaluate(
      (n) => window.minecraft.game.xp.total === n,
      xp.stack.count,
    ),
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    await g.performSharedMobAction("o:0:0", () => {
      const m = g.spawnMob("pig", 9, 65, 10);
      m.walking = true;
      m.aiTimer = 10;
      m.yaw = 1;
    });
  });
  const prior = await a.evaluate(() =>
    window.minecraft.game.mobs.find((m) => m.type === "pig").body.pos.toArray(),
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    g.mobPollAt = 0;
    g.pollSharedMobs();
    await g.mobTask;
  });
  check(
    "coordinator executes and stages the real AI loop",
    await a.evaluate(() =>
      window.minecraft.game.mobUpdates.some((r) =>
        r.mobs.some((m) => m.type === "pig"),
      ),
    ),
  );
  await a.evaluate(async () => {
    await window.minecraft.game.flushSharedMobs();
  });
  await b.evaluate(async () => {
    await window.minecraft.game.flushSharedMobs();
  });
  const moved = await Promise.all([
    a.evaluate(() =>
      window.minecraft.game.mobs
        .find((m) => m.type === "pig")
        .body.pos.toArray(),
    ),
    b.evaluate(() =>
      window.minecraft.game.mobs
        .find((m) => m.type === "pig")
        .body.pos.toArray(),
    ),
  ]);
  check(
    "movement from one AI simulation is canonical for both renderers",
    JSON.stringify(moved[0]) === JSON.stringify(moved[1]) &&
      JSON.stringify(moved[0]) !== JSON.stringify(prior),
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    g.world.setBlock(12, 65, 8, SharedAudit.B.TNT);
    g.world.setBlock(13, 65, 8, SharedAudit.B.CHEST);
    g.world.setBlock(12, 65, 9, SharedAudit.B.FURNACE);
    g.furnaces.set("12,65,9", {
      x: 12,
      y: 65,
      z: 9,
      input: null,
      output: null,
      fuel: {
        id: SharedAudit.I.COAL,
        count: 3,
        name: "Private-furnace-fixture",
      },
      burn: 0,
      burnMax: 0,
      cook: 0,
    });
    g.furnacePos = { x: 12, y: 65, z: 9 };
    g.flushNetEdits();
    await g.net.flush();
  });
  await one("select mconline_chest($1,$2,$3,$4,$5) r", [
    crypto.randomUUID(),
    "Fixture",
    crypto.randomUUID(),
    "public",
    {
      op: "open",
      ref: { d: "o", x: 13, y: 65, z: 8 },
      seed: [{ id: 3, count: 2 }, ...Array(26).fill(null)],
    },
  ]);
  await a.evaluate(() =>
    window.minecraft.game.igniteTNT(12, 65, 8, 0.1, "player"),
  );
  await idle(a);
  await b.evaluate(async () => {
    await window.minecraft.game.flushSharedMobs();
  });
  check(
    "primed TNT is one canonical entity, not two private timers",
    (await a.evaluate(
      () =>
        window.minecraft.game.mobs.filter((m) => m.isTnt).length === 1 &&
        window.minecraft.game.tnts.length === 0,
    )) &&
      (await b.evaluate(
        () => window.minecraft.game.mobs.filter((m) => m.isTnt).length === 1,
      )),
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    g.mobStepAt = performance.now() - 400;
    g.mobPollAt = 0;
    g.pollSharedMobs();
    await g.mobTask;
  });
  check(
    "speculative explosion blocks access to private furnace cache until ACK",
    await a.evaluate(() => {
      const g = window.minecraft.game;
      return (
        !!g.mobContainerBackup &&
        g.sharedInputBlocked &&
        g.currentFurnace() === null
      );
    }),
  );
  await db.query(
    "update mconline_mob_regions set epoch=epoch+1 where world='public' and dim='o' and x=0 and z=0",
  );
  await a.evaluate(async () => await window.minecraft.game.flushSharedMobs());
  check(
    "rejected AI epoch restores private furnace contents and canonical terrain",
    await a.evaluate(() => {
      const g = window.minecraft.game;
      return (
        !g.mobContainerBackup &&
        g.furnaces.get("12,65,9")?.fuel?.count === 3 &&
        g.world.getBlock(12, 65, 9) === SharedAudit.B.FURNACE
      );
    }),
  );
  check(
    "rejected speculative spill never publishes furnace loot",
    (
      await one(
        "select count(*)::int n from blockcraft_drops where payload->'stack'->>'name'='Private-furnace-fixture'",
      )
    ).n === 0,
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    g.mobStepAt = performance.now() - 400;
    g.mobPollAt = 0;
    g.pollSharedMobs();
    await g.mobTask;
    await g.flushSharedMobs();
  });
  check(
    "accepted AI epoch removes destroyed private furnace cache",
    await a.evaluate(() => {
      const g = window.minecraft.game;
      return (
        !g.mobContainerBackup &&
        !g.furnaces.has("12,65,9") &&
        g.world.getBlock(12, 65, 9) === SharedAudit.B.AIR
      );
    }),
  );
  await a.evaluate(async () => await window.minecraft.game.flushSharedMobs());
  check(
    "accepted private furnace spill appears exactly once",
    (
      await one(
        "select count(*)::int n from blockcraft_drops where payload->'stack'->>'name'='Private-furnace-fixture'",
      )
    ).n === 1,
  );
  check(
    "shared TNT explosion atomically destroys an ordinary chest",
    (await one("select destroyed from mconline_chests where x=13")).destroyed,
  );
  check(
    "ordinary chest explosion spills contents once",
    (
      await one(
        "select count(*)::int n from blockcraft_drops where uid like 'mobchest:%'",
      )
    ).n === 1,
  );
  await a.evaluate(async () => {
    const g = window.minecraft.game;
    g.world.setBlock(20, 65, 8, SharedAudit.B.CHEST);
    g.inventory.slots[0] = { id: SharedAudit.I.IRON_AXE, count: 1, dur: 100 };
    g.selected = 0;
    g.flushNetEdits();
    await g.net.flush();
  });
  await one("select mconline_chest($1,$2,$3,$4,$5) r", [
    crypto.randomUUID(),
    "Fixture",
    crypto.randomUUID(),
    "public",
    {
      op: "open",
      ref: { d: "o", x: 20, y: 65, z: 8 },
      seed: [{ id: 3, count: 3 }, ...Array(26).fill(null)],
    },
  ]);
  await a.evaluate(() => window.minecraft.game.breakBlock(20, 65, 8));
  await idle(a);
  check(
    "mining a shared chest preserves its block and contents drops",
    (await a.evaluate(
      () =>
        window.minecraft.game.world.getBlock(20, 65, 8) === SharedAudit.B.AIR &&
        window.minecraft.game.inventory.slots[0].dur === 99,
    )) &&
      (
        await one(
          "select count(*)::int n from blockcraft_drops where (payload->'stack'->>'id')::int=54",
        )
      ).n === 1,
  );
  for (const { errors } of peers)
    check("no uncaught browser errors", errors.length === 0);
  await a.screenshot({ path: path.join(out, "desktop.png") });
  await b.screenshot({ path: path.join(out, "mobile.png") });
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        version: JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,
        checks,
        environment:
          "Two isolated Chromium contexts (desktop + emulated mobile), real production engine/PublicServer + PostgreSQL WASM; synthetic identities and membership stubs, not physical devices or real account sessions",
        errors: peers.map((p) => p.errors),
      },
      null,
      2,
    ),
  );
  console.log(`${checks} shared-state two-renderer checks passed`);
} finally {
  await browser.close();
  await db.close();
}
