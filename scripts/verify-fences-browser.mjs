/** Production build, fresh guest-only profiles. No real accounts or multiplayer.
 * Browser tools: npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
 * Start production preview, then npm run test:browser:fences.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const tools = path.resolve(
  process.env.BROWSER_TOOLS ?? path.join(root, '.cache/browser-tools'),
);
const resolve = createRequire(path.join(tools, 'package.json')).resolve;
const { default: puppeteer } = await import(
  pathToFileURL(resolve('puppeteer-core')).href
);
const { default: chromium } = await import(
  pathToFileURL(resolve('@sparticuz/chromium')).href
);
const libs = path.join(tools, 'al2023');
if (!fs.existsSync(libs)) {
  fs.mkdirSync(libs, { recursive: true });
  const tar = path.join(tools, 'al2023.tar');
  fs.writeFileSync(
    tar,
    brotliDecompressSync(
      fs.readFileSync(
        path.join(tools, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'),
      ),
    ),
  );
  execFileSync('tar', ['xf', tar, '-C', libs]);
  fs.unlinkSync(tar);
}
const output = path.join(root, '.cache/verification432');
fs.mkdirSync(output, { recursive: true });
const enums = path.join(output, 'blocks.mjs');
await build({
  stdin: {
    contents: "export {B} from './src/game/blocks';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: enums,
});
const { B } = await import(pathToFileURL(enums).href);
const version = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
).version;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((arg) => arg !== '--single-process'),
  headless: true,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, 'lib'), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(':'),
  },
});
const reports = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.createBrowserContext(),
      p = await context.newPage(),
      errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const viewport = mobile
      ? { width: 844, height: 390, isMobile: true, hasTouch: true }
      : { width: 960, height: 600 };
    await p.setViewport(viewport);
    await p.evaluateOnNewDocument((mobile) => {
      localStorage.setItem(
        'blockcraft-settings',
        JSON.stringify({
          quality: 'potato',
          controlMode: mobile ? 'touch' : 'desktop',
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
        'blockcraft-saves-v2',
        JSON.stringify([
          {
            id: 'fences432',
            name: 'Audyt płotów',
            seed: 432,
            mode: 'creative',
            worldType: 'flat',
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
    await p.goto(process.env.BROWSER_URL ?? 'http://127.0.0.1:4173/', {
      waitUntil: 'domcontentloaded',
    });
    await p.waitForFunction(
      (version) => document.body.innerText.includes('przeglądarka ' + version),
      {},
      version,
    );
    const click = (label) =>
      p.evaluate((label) => {
        const button = [...document.querySelectorAll('button')].find(
          (e) => e.textContent?.trim() === label,
        );
        if (!button) throw Error('Missing button ' + label);
        button.click();
      }, label);
    await click('Tryb jednoosobowy');
    await p.evaluate(() => document.querySelector('[role="option"]').click());
    await click('Graj w wybranym świecie');
    await p.waitForFunction(
      () => window.minecraft?.game?.loadingProgress >= 0.999,
      { timeout: 90000 },
    );
    const join = await p.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((e) =>
        ['Dołącz do świata', 'Dotknij, aby grać'].includes(
          e.textContent?.trim(),
        ),
      );
      if (!button) return false;
      button.id = 'fence-audit-join';
      return true;
    });
    if (join) await p.click('#fence-audit-join');
    await p.waitForFunction(() => window.minecraft.game.ui === 'playing');
    await p.evaluate(() => cancelAnimationFrame(window.minecraft.game.raf));
    await p.waitForFunction(() => !window.minecraft.game.meshWorker?.busy, {
      timeout: 15000,
    });

    const report = await p.evaluate((B) => {
      const g = window.minecraft.game,
        w = g.world,
        y = 65;
      g.ui = 'playing';
      g.autoJump = false;
      g.flying = false;
      g.mobs = [];
      for (let x = 2; x <= 16; x++)
        for (let z = 3; z <= 11; z++)
          for (let h = 64; h <= 69; h++)
            w.setBlock(x, h, z, h === 64 ? B.STONE : B.AIR);
      w.setBlock(5, y, 5, B.FENCE);
      const miss = w.raycast(4, y + 0.5, 5.15, 1, 0, 0, 2.5);
      const hit = w.raycast(4, y + 0.5, 5.5, 1, 0, 0, 2.5);
      if (miss || hit?.id !== B.FENCE || Math.abs(hit.dist - 1.375) > 1e-6)
        throw Error('Wrong post targeting');
      if (w.raycast(4, y + 1.2, 5.5, 1, 0, 0, 2.5))
        throw Error('Selection reaches invisible upper half');
      if (
        w.raycast(4, y + 1.2, 5.5, 1, 0, 0, 2.5, { solidOnly: true })?.id !==
        B.FENCE
      )
        throw Error('Upper collision missing');
      const walk = (z) => {
        g.body.pos.set(4, y, z);
        g.body.vel.set(0, 0, 0);
        g.body.onGround = true;
        g.yaw = 0;
        g.keys.clear();
        g.keys.add('KeyD');
        for (let i = 0; i < 90; i++) g.updatePlayer(1 / 60);
        g.keys.clear();
        return { x: g.body.pos.x, y: g.body.pos.y, hitWall: g.body.hitWall };
      };
      const beside = walk(5.05),
        blocked = walk(5.5);
      if (beside.x < 6.5 || Math.abs(beside.y - y) > 0.001)
        throw Error('Invisible fence-cell barrier');
      if (Math.abs(blocked.x - 5.075) > 0.001 || !blocked.hitWall)
        throw Error('Player crosses post');
      g.updateBuildingTarget(B.FENCE, 5, y, 5);
      g.selection.geometry.computeBoundingBox();
      const box = g.selection.geometry.boundingBox;
      if (Math.abs(box.max.x - box.min.x - 0.251) > 0.00001)
        throw Error('Outline still full cube');
      w.setBlock(6, y, 5, B.FENCE);
      g.updateBuildingTarget(B.FENCE, 5, y, 5);
      g.selection.geometry.computeBoundingBox();
      const connected = g.selection.geometry.boundingBox;
      if (Math.abs(connected.max.x - connected.min.x - 0.6275) > 0.00001)
        throw Error('Outline ignores new arm');
      w.setBlock(7, y, 5, B.FENCE);
      w.setBlock(7, y, 6, B.FENCE);
      g.body.pos.set(7.5, y, 9.5);
      g.body.vel.set(0, 0, 0);
      g.yaw = 0.46;
      g.pitch = 0.2;
      g.updateCamera(0.016);
      g.buildChunk(0, 0);
      g.buildChunk(1, 0);
      g.emitHud();
      g.firstPerson.render(g.renderer, g.scene, g.camera);
      return {
        beside,
        blocked,
        postTargetDistance: hit.dist,
        outlineWidth: 0.251,
        connectedOutlineWidth: 0.6275,
      };
    }, B);
    if (errors.length) throw Error(JSON.stringify(errors));
    const device = mobile ? 'mobile' : 'desktop';
    await p.screenshot({ path: path.join(output, device + '.png') });
    reports.push({ device, viewport, ...report, errors });
    console.log('PASS ' + device + ' ' + JSON.stringify(report));
    await context.close();
  }
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify({ version, reports }, null, 2) + '\n',
  );
} finally {
  await browser.close();
}
