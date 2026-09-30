#!/usr/bin/env node
/** Real WebGL smoke run. Start `npm run dev -- --host 0.0.0.0` first.
 * Browser executable must be installed separately; no 70 MB binary in Git.
 * CHROME_BIN=/path/to/chrome npm run test:browser
 * On bare serverless Chromium, set BLOCKCRAFT_CHROMIUM_MODULE to the absolute
 * path of an installed @sparticuz/chromium module and LD_LIBRARY_PATH as needed.
 * Optional: BROWSER_SCREENSHOTS=/some/outside-repo/dir to keep screenshots.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const packagePath = process.env.BLOCKCRAFT_CHROMIUM_MODULE;
const packaged = packagePath ? (await import(packagePath)).default : null;
const binary = packaged ? await packaged.executablePath() :
  process.env.CHROME_BIN || (existsSync(chromium.executablePath()) ? chromium.executablePath() : '');
if (!binary || !existsSync(binary)) {
  console.error('Brak Chromium. Ustaw CHROME_BIN lub BLOCKCRAFT_CHROMIUM_MODULE; uruchom też serwer Vite.');
  process.exit(2);
}
const url = process.env.BROWSER_URL || 'http://localhost:5173/';
const shots = process.env.BROWSER_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const screenshot = async (page, name) => {
  if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) });
};
const args = packaged ? [...packaged.args, '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] :
  ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const launchBrowser = () => chromium.launch({ executablePath: binary, args, headless: true, timeout: 30000 });
let browser = await launchBrowser();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const attachErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', async (d) => { errors.push(`Dialog: ${d.message()}`); await d.accept(); });
  return errors;
};
const createWorld = async (page, name, seed, creative = false, touch = false) => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: 'Nowy świat', exact: true }).click();
  await page.getByPlaceholder('np. Wyspa').fill(name);
  await page.getByPlaceholder('np. 12345 lub dowolny tekst').fill(String(seed));
  if (creative) await page.getByRole('button', { name: 'Tryb gry: Przetrwanie' }).click();
  await page.getByRole('button', { name: 'Stwórz świat' }).click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 2,
    undefined, { timeout: 60000 });
  await page.getByRole('button', { name: touch ? 'Dotknij, aby grać' : 'Kliknij, aby grać' }).click();
};
const gameInfo = (page) => page.evaluate(() => {
  const g = window.blockcraft.game;
  const gl = g.renderer.getContext();
  return { mode: g.mode, version: g.homeWorld.terrainVersion,
    webgl: gl.getParameter(gl.VERSION), frames: g.renderer.info.render.frame,
    calls: g.renderer.info.render.calls, touch: g.touchInput };
});
const exitToMenu = async (page) => {
  await page.evaluate(() => window.blockcraft.game.setUI('paused'));
  await page.getByRole('button', { name: 'Zapisz i wyjdź do menu' }).evaluate((b) => b.click());
  await page.getByRole('button', { name: 'Nowy świat', exact: true }).waitFor({ timeout: 30000 });
};

try {
  const pc = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await pc.newPage();
  const desktopErrors = attachErrors(page);
  await createWorld(page, 'WebGL-v6', 12345, true);
  const info = await gameInfo(page);
  check(info.version === 6 && info.mode === 'creative' && info.webgl.startsWith('WebGL 2'), 'PC: WebGL2, nowy świat v6 i Creative');
  for (const [name, x, z] of [
    ['Ośnieżone szczyty', -108, -152], ['Płaskowyż', -408, -960],
    ['Głęboka dolina', -576, -960], ['Wąwóz', 912, -240],
    ['Jezioro', -544, -1200], ['Rzeka', -551, -1245],
  ]) {
    const site = await page.evaluate(([xx, zz]) => {
      const g = window.blockcraft.game, s = g.world.surface(xx, zz);
      g.flying = true;
      g.body.pos.set(xx + 0.5, s.h + 8, zz + 0.5);
      g.body.vel.set(0, 0, 0); g.pitch = -0.48; g.fallStart = s.h + 8;
      return { biome: s.biome, water: g.world.getBlock(xx, 62, zz) };
    }, [x, z]);
    check(site.biome === name, `PC: widoczna lokalizacja ${name}`);
    if (name === 'Rzeka' || name === 'Jezioro') check(site.water === 9, `${name}: rzeczywisty blok wody`);
    await page.waitForTimeout(450);
    await screenshot(page, `desktop-${x}-${z}`);
  }
  check((await gameInfo(page)).frames > info.frames + 6, 'PC: świat renderuje następne klatki');
  // Look at a real underground room in the renderer; this is not just a
  // detached pure-function generator test. Torch makes the dark geometry
  // inspectable in screenshots, and the dry tunnel joins the next cell.
  const cave = await page.evaluate(() => {
    const g = window.blockcraft.game, w = g.world;
    const [x, y, z] = [-40, 36, -45];
    g.flying = true;
    g.body.pos.set(x + 0.5, y - 1.9995, z + 0.5);
    g.body.vel.set(0, 0, 0);
    g.yaw = -Math.PI / 2; g.pitch = 0;
    w.setBlock(x + 2, y - 2, z, 44); // a real torch on the chamber floor
    g.buildChunk(Math.floor(x / 16), Math.floor(z / 16));
    return { room: w.getBlock(x, y, z), roof: w.getBlock(x, y + 4, z),
      height: w.surface(x, z).h, torch: w.getBlock(x + 2, y - 2, z) };
  });
  check(cave.room === 0 && cave.roof === 0 && cave.height > 50 && cave.torch === 44,
    `PC: wygenerowana komora v6 z pochodnią: ${JSON.stringify(cave)}`);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.blockcraft.game; g.yaw = -Math.PI / 2; g.pitch = 0; g.camera.rotation.set(0, g.yaw, 0); });
  await screenshot(page, 'desktop-cave');
  await page.evaluate(() => { const g = window.blockcraft.game; g.flying = false; g.yaw = -Math.PI / 2; g.pitch = 0; });
  await page.keyboard.down('w');
  await page.waitForTimeout(1800);
  await page.keyboard.up('w');
  const walked = await page.evaluate(() => ({ x: window.blockcraft.game.body.pos.x,
    y: window.blockcraft.game.body.pos.y, ui: window.blockcraft.game.ui }));
  check(walked.x > -38 && walked.y > 20 && walked.ui === 'playing',
    `PC: prawdziwe W porusza się w komorze: ${JSON.stringify(walked)}`);
  await page.evaluate(() => window.blockcraft.game.openInventory(false));
  check((await page.locator('body').innerText()).includes('Bloki'), 'Creative: otwarto rzeczywisty ekwipunek');
  await screenshot(page, 'desktop-inventory');
  // Select a decorative block through the actual Creative inventory, not by
  // injecting an item into the hotbar; then aim at a wall and place it.
  await page.getByPlaceholder('Szukaj...').fill('Obraz: krajobraz');
  await page.locator('.inventory-main-panel .grid .mc-slot').first().click();
  await page.locator('.inventory-main-panel .flex.gap-0 .mc-slot').first().click();
  check(await page.evaluate(() => window.blockcraft.game.inventory.slots[0]?.id === 427),
    'Creative: obraz trafia z katalogu na pasek');
  const target = await page.evaluate(() => {
    const g = window.blockcraft.game;
    g.flying = true;
    g.setRenderDistance(2); // keep the close-up screenshot independent of distant chunk work
    g.body.pos.set(0.5, 111, 0.5);
    g.body.vel.set(0, 0, 0);
    for (let x = -2; x <= 4; x++) for (let z = -2; z <= 2; z++)
      g.world.setBlock(x, 110, z, 3); // test platform, stone
    for (let z = -1; z <= 1; z++) for (let y = 111; y <= 114; y++)
      g.world.setBlock(3, y, z, 3); // solid wall
    g.yaw = -Math.PI / 2;
    g.pitch = 0;
    g.setUI('playing');
    g.refreshTarget();
    return g.target && { x: g.target.x, y: g.target.y, z: g.target.z, nx: g.target.nx };
  });
  check(target?.x === 3 && target?.y === 112 && target?.z === 0 && target?.nx === -1,
    `Creative: celownik trafił w ścianę: ${JSON.stringify(target)}`);
  await page.evaluate(() => window.blockcraft.game.tryUse());
  check(await page.evaluate(() => window.blockcraft.game.world.getBlock(2, 112, 0) >= 427 &&
    window.blockcraft.game.world.getBlock(2, 112, 0) <= 430),
    'Creative: silnik faktycznie postawił obraz na ścianie');
  await page.evaluate(() => {
    const g = window.blockcraft.game;
    g.yaw = -Math.PI / 2;
    g.pitch = 0;
    g.buildChunk(0, 0);
    g.camera.rotation.set(0, -Math.PI / 2, 0);
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = window.blockcraft.game; g.yaw = -Math.PI / 2; g.pitch = 0; g.camera.rotation.set(0, g.yaw, 0); });
  await screenshot(page, 'desktop-painting');
  check(await page.evaluate(() => window.blockcraft.game.save()), 'PC: zapis świata v6');
  await exitToMenu(page);
  await page.locator('button').filter({ hasText: 'WebGL-v6' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0, undefined, { timeout: 60000 });
  check((await gameInfo(page)).version === 6, 'PC: ponowne otwarcie świata v6');
  check(await page.evaluate(() => { const b = window.blockcraft.game.world.getBlock(2, 112, 0); return b >= 427 && b <= 430; }),
    'PC: postawiony obraz nadal istnieje po zapisie i odczycie');
  await page.getByRole('button', { name: 'Kliknij, aby grać' }).click();
  await exitToMenu(page);
  // Simulate a save from before #4 and make sure it uses its original v5
  // water and cave generator. This is a copied private browser save, not an
  // unchanged historical export from a real device.
  await page.evaluate(() => {
    const key = 'blockcraft-saves-v2', saves = JSON.parse(localStorage.getItem(key));
    saves[0].terrainVersion = 5; saves[0].pos = [0.5, 65, 0.5]; saves[0].mods = {};
    localStorage.setItem(key, JSON.stringify(saves));
  });
  await page.reload();
  await page.locator('button').filter({ hasText: 'WebGL-v6' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0, undefined, { timeout: 60000 });
  check(await page.evaluate(() => window.blockcraft.game.homeWorld.terrainVersion === 5 &&
    window.blockcraft.game.homeWorld.surface(-544, -1200).biome === 'Jezioro'),
    'PC: dawny świat v5 zachowuje jezioro i starą rewizję podziemi');
  await page.getByRole('button', { name: 'Kliknij, aby grać' }).click();
  await exitToMenu(page);
  // Reuse the real serialized world shape, representing a previously saved v4
  // world (not a mutation of the user's browser storage: private context).
  await page.evaluate(() => {
    const key = 'blockcraft-saves-v2', saves = JSON.parse(localStorage.getItem(key));
    saves[0].terrainVersion = 4; saves[0].pos = [0.5, 65, 0.5]; saves[0].mods = {};
    localStorage.setItem(key, JSON.stringify(saves));
  });
  await page.reload();
  await page.locator('button').filter({ hasText: 'WebGL-v6' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0, undefined, { timeout: 60000 });
  check(await page.evaluate(() => window.blockcraft.game.homeWorld.terrainVersion === 4 &&
    window.blockcraft.game.homeWorld.surface(-544, -1200).biome === 'Płaskowyż'),
    'PC: dawny świat v4 nie zmienia niezbadanej doliny w jezioro');
  check(desktopErrors.length === 0, `PC: błędy JS/dialogi: ${desktopErrors.join('; ')}`);
  await pc.close();
  console.log('PC: renderowanie i zgodność zapisów v6/v5/v4 OK');
  await browser.close();
  browser = await launchBrowser();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await phone.newPage();
  const mobileErrors = attachErrors(mobile);
  await mobile.addInitScript(() => localStorage.setItem('blockcraft-settings', JSON.stringify({
    quality: 'low', textureDetail: 'low', effectDetail: 'low', controlMode: 'touch',
    renderDistance: 4, pixelRatio: 1, clouds: false, particles: 0.35, fpsCap: 30,
    touchMode: 'buttons', showFps: true,
  })));
  await createWorld(mobile, 'WebGL-mobile', 12345, false, true);
  const mobileInfo = await gameInfo(mobile);
  check(mobileInfo.mode === 'survival' && mobileInfo.touch && mobileInfo.version === 6 &&
    mobileInfo.webgl.startsWith('WebGL 2'), 'Telefon emulowany: WebGL2, dotyk i Survival');
  check(await mobile.evaluate(() => {
    const b = window.blockcraft.game.gfx;
    return b.chunkBudgetMs === 6 && b.chunksPerFrame === 2 && b.unloadMargin === 1 && !b.clouds;
  }), 'Telefon emulowany: faktyczne budżety niskiego presetu');
  await screenshot(mobile, 'mobile-playing');
  const phoneCave = await mobile.evaluate(() => {
    const g = window.blockcraft.game;
    g.body.pos.set(-39.5, 34.0005, -44.5);
    g.body.vel.set(0, 0, 0);
    // A test teleport is not a 30-block fall; preserve Survival health.
    g.fallStart = g.body.pos.y; g.body.onGround = true;
    g.world.setBlock(-38, 34, -45, 44);
    g.buildChunk(-3, -3);
    g.yaw = -Math.PI / 2; g.pitch = 0;
    return { block: g.world.getBlock(-40, 35, -45), version: g.world.terrainVersion,
      ms: g.gfx.chunkBudgetMs, limit: g.gfx.chunksPerFrame };
  });
  check(phoneCave.block === 0 && phoneCave.version === 6 && phoneCave.ms === 6 && phoneCave.limit === 2,
    `Telefon: podziemna komora na niskim presecie ${JSON.stringify(phoneCave)}`);
  await mobile.waitForTimeout(500);
  await screenshot(mobile, 'mobile-cave');
  await mobile.getByRole('button', { name: '🎒' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'inventory'), 'Dotyk: otwieranie ekwipunku');
  await screenshot(mobile, 'mobile-inventory');
  await mobile.evaluate(() => window.blockcraft.game.setUI('playing'));
  await mobile.getByRole('button', { name: '⏸' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'paused'), 'Dotyk: pauza');
  await screenshot(mobile, 'mobile-pause');
  check(await mobile.evaluate(() => window.blockcraft.game.save()), 'Telefon emulowany: zapis świata');
  check(mobileErrors.length === 0, `Telefon emulowany: błędy JS/dialogi: ${mobileErrors.join('; ')}`);
  await phone.close();
  console.log(`WebGL2: ${checks} sprawdzeń, 0 błędów. Urządzenie dotykowe było emulowane w Chromium.`);
} finally {
  await browser.close();
}
