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
  await page.getByText('WERSJA 2.8 RC2', { exact: true }).waitFor();
  check((await page.title()).startsWith('BlockCraft 2.8 RC2'), '2.8: tytuł i oznaczenie kandydata są spójne w grze');
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
  await createWorld(page, 'WebGL-v7', 12345, true);
  const info = await gameInfo(page);
  check(info.version === 7 && info.mode === 'creative' && info.webgl.startsWith('WebGL 2'), 'PC: WebGL2, nowy świat v7 i Creative');
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
  // 2.8 navigation: open the map with the real keyboard shortcut, inspect
  // surveyed tiles, and place a waypoint on the visited central chunk.
  await page.keyboard.press('k');
  await page.getByRole('heading', { name: 'Punkty podróży' }).waitFor();
  check(await page.evaluate(() => window.blockcraft.game.ui === 'waypoints' &&
    window.blockcraft.game.discovery.count('overworld') > 0),
    'PC: K otwiera mapę z naprawdę odkrytymi polami');
  await screenshot(page, 'desktop-map');
  await page.getByRole('button', { name: 'Zaznacz środek mapy' }).click();
  check(await page.evaluate(() => window.blockcraft.game.waypoints.length > 0 &&
    !!window.blockcraft.game.activeWaypointId), 'PC: mapa tworzy i śledzi znacznik');
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
  // The real use action opens the biome compass, and a nearby lake is found
  // without waiting for any off-screen chunk generation.
  await page.evaluate(() => {
    const g = window.blockcraft.game;
    g.inventory.slots[0] = { id: 352, count: 1 }; g.selected = 0;
    g.tryUse();
  });
  await page.getByRole('heading', { name: 'Kompas biomów' }).waitFor();
  check(await page.evaluate(() => window.blockcraft.game.ui === 'biomeCompass'),
    'PC: użycie prawdziwego przedmiotu otwiera kompas biomów');
  await page.getByLabel('Szukany biom').selectOption('Jezioro');
  await page.getByRole('button', { name: 'Szukaj biomu' }).click();
  await page.getByRole('button', { name: 'Zaznacz i śledź na HUD' }).waitFor({ timeout: 30000 });
  await screenshot(page, 'desktop-compass');
  await page.getByRole('button', { name: 'Zaznacz i śledź na HUD' }).click();
  check(await page.evaluate(() => window.blockcraft.game.waypoints.some((w) => w.name === 'Biom: Jezioro') &&
    window.blockcraft.game.ui === 'playing'), 'PC: kompas dopisuje biomowy cel do nawigacji');
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
    `PC: wygenerowana komora v7 z pochodnią: ${JSON.stringify(cave)}`);
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
  // Full ascent with the actual game loop and real held W + Space. Start in a
  // deterministic dry chamber; the route crosses multiple chunk boundaries.
  const ascent = await page.evaluate(async () => {
    const { caveNode, caveEntrance } = await import('/src/game/caves.ts');
    const g = window.blockcraft.game, w = g.world;
    const node = caveNode(w.seed, -3, 0);
    const mouth = caveEntrance(w.seed, -3, 0, (x, z) => w.surface(x, z).h,
      (x, z) => w.villageAt(x, z) !== null);
    if (!mouth) return null;
    g.setRenderDistance(2);
    g.flying = false;
    g.body.pos.set(node.x + 0.5, node.y - 2 + 0.001, node.z + 0.5);
    g.body.vel.set(0, 0, 0);
    g.yaw = -Math.atan2(mouth.x - node.x, node.z - mouth.z);
    g.pitch = 0; g.fallStart = g.body.pos.y;
    return { node, mouth };
  });
  check(!!ascent, 'PC: sucha komora ma istniejące wyjście na powierzchnię');
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  try {
    await page.waitForFunction(({ node, mouth }) => {
      const p = window.blockcraft.game.body.pos;
      const dx = mouth.x - node.x, dz = mouth.z - node.z;
      return ((p.x - node.x) * dx + (p.z - node.z) * dz) / (dx * dx + dz * dz) >= 0.97;
    }, ascent, { timeout: 180000, polling: 500 });
  } catch (error) {
    const position = await page.evaluate(({ node, mouth }) => {
      const g = window.blockcraft.game, p = g.body.pos;
      const dx = mouth.x - node.x, dz = mouth.z - node.z;
      return { x: p.x, y: p.y, z: p.z, progress: ((p.x - node.x) * dx + (p.z - node.z) * dz) / (dx * dx + dz * dz),
        lateral: ((p.z - node.z) * dx - (p.x - node.x) * dz) / Math.hypot(dx, dz),
        ui: g.ui, flying: g.flying, onGround: g.body.onGround, hitWall: g.body.hitWall, frames: g.renderer.info.render.frame };
    }, ascent);
    throw new Error(`PC: pełne wejście po pochylni nie powiodło się: ${JSON.stringify(position)}`, { cause: error });
  }
  await page.keyboard.up('Space');
  await page.keyboard.up('w');
  const climbed = await page.evaluate(({ mouth }) => {
    const p = window.blockcraft.game.body.pos;
    return { x: p.x, y: p.y, z: p.z, surface: mouth.y - 3 };
  }, ascent);
  check(climbed.y >= climbed.surface - 3 && walked.ui === 'playing',
    `PC: W + spacja wychodzą prawdziwą pochylnią v7 do światła: ${JSON.stringify(climbed)}`);
  await screenshot(page, 'desktop-cave-exit');
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
  // The spyglass must mark a real visible block through the keyboard action,
  // then release zoom when RMB is released (not get stuck at 24° FOV).
  await page.evaluate(() => {
    const g = window.blockcraft.game;
    g.inventory.slots[0] = { id: 247, count: 1 }; g.selected = 0;
    g.yaw = -Math.PI / 2; g.pitch = 0;
  });
  await page.mouse.click(640, 360, { button: 'right' }); // reacquire pointer lock if needed
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.blockcraft.game.isZooming(), undefined, { timeout: 5000 });
  // Pointer-lock events can arrive after mouse.down and change the camera.
  // Wait for them, then re-aim at the wall before invoking the real G shortcut.
  await page.waitForTimeout(450);
  const spyglassTarget = await page.evaluate(() => {
    const g = window.blockcraft.game;
    g.yaw = -Math.PI / 2; g.pitch = 0;
    g.camera.rotation.set(0, g.yaw, 0); g.refreshTarget();
    return g.target && { x: g.target.x, y: g.target.y, z: g.target.z };
  });
  check(spyglassTarget?.x === 2, `PC: lorneta celuje w ścianę: ${JSON.stringify(spyglassTarget)}`);
  await page.keyboard.press('g');
  const spyglassMark = await page.evaluate(() => {
    const g = window.blockcraft.game;
    return { yaw: g.yaw, pitch: g.pitch, zoom: g.isZooming(),
      active: g.activeWaypointId, marks: g.waypoints.filter((w) => w.name.startsWith('Namierzono:')) };
  });
  check(spyglassMark.marks.some((w) => w.id === spyglassMark.active),
    `PC: lorneta G namierza widoczny blok: ${JSON.stringify(spyglassMark)}`);
  await screenshot(page, 'desktop-spyglass');
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => !window.blockcraft.game.isZooming(), undefined, { timeout: 5000 });
  check(await page.evaluate(() => !window.blockcraft.game.isZooming()), 'PC: puszczenie PPM kończy przybliżenie');
  check(await page.evaluate(() => window.blockcraft.game.save()), 'PC: zapis świata v7');
  await exitToMenu(page);
  await page.locator('button').filter({ hasText: 'WebGL-v7' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0, undefined, { timeout: 60000 });
  check((await gameInfo(page)).version === 7, 'PC: ponowne otwarcie świata v7');
  check(await page.evaluate(() => { const b = window.blockcraft.game.world.getBlock(2, 112, 0); return b >= 427 && b <= 430; }),
    'PC: postawiony obraz nadal istnieje po zapisie i odczycie');
  check(await page.evaluate(() => window.blockcraft.game.waypoints.some((w) =>
    w.name.startsWith('Namierzono:') && w.id === window.blockcraft.game.activeWaypointId)),
    'PC: cel lornety i jego aktywna nawigacja przeżywają wczytanie świata');
  await page.getByRole('button', { name: 'Kliknij, aby grać' }).click();
  await exitToMenu(page);
  // RC1 saves keep v6 chunk geometry, including unexplored chunks. Only new
  // worlds use v7. This mutation stays in this disposable browser context.
  await page.evaluate(() => {
    const key = 'blockcraft-saves-v2', saves = JSON.parse(localStorage.getItem(key));
    saves[0].terrainVersion = 6; saves[0].pos = [0.5, 65, 0.5]; saves[0].mods = {};
    localStorage.setItem(key, JSON.stringify(saves));
  });
  await page.reload();
  await page.locator('button').filter({ hasText: 'WebGL-v7' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0,
    undefined, { timeout: 60000 });
  check(await page.evaluate(() => {
    const w = window.blockcraft.game.homeWorld;
    let hash = 2166136261;
    for (const block of w.getChunk(-28, 2).data) hash = Math.imul(hash ^ block, 16777619) >>> 0;
    return w.terrainVersion === 6 && hash === 1367259331;
  }), 'PC: zapis RC1 v6 odtwarza identyczny, wcześniej niezbadany chunk');
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
  await page.locator('button').filter({ hasText: 'WebGL-v7' }).first().click();
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
  await page.locator('button').filter({ hasText: 'WebGL-v7' }).first().click();
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 0, undefined, { timeout: 60000 });
  check(await page.evaluate(() => window.blockcraft.game.homeWorld.terrainVersion === 4 &&
    window.blockcraft.game.homeWorld.surface(-544, -1200).biome === 'Płaskowyż'),
    'PC: dawny świat v4 nie zmienia niezbadanej doliny w jezioro');
  check(desktopErrors.length === 0, `PC: błędy JS/dialogi: ${desktopErrors.join('; ')}`);
  await pc.close();
  console.log('PC: renderowanie i zgodność zapisów v7/v6/v5/v4 OK');
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
  check(mobileInfo.mode === 'survival' && mobileInfo.touch && mobileInfo.version === 7 &&
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
  check(phoneCave.block === 0 && phoneCave.version === 7 && phoneCave.ms === 6 && phoneCave.limit === 2,
    `Telefon: podziemna komora na niskim presecie ${JSON.stringify(phoneCave)}`);
  await mobile.waitForTimeout(500);
  await screenshot(mobile, 'mobile-cave');
  await mobile.getByRole('button', { name: 'Punkty podróży' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'waypoints'),
    'Dotyk: otwarcie mapy przyciskiem ekranowym');
  await screenshot(mobile, 'mobile-map');
  await mobile.getByRole('button', { name: 'Zaznacz środek mapy' }).tap();
  check(await mobile.evaluate(() => !!window.blockcraft.game.activeWaypointId && window.blockcraft.game.waypoints.length === 1),
    'Dotyk: zaznaczenie odkrytego miejsca na mapie');
  await mobile.getByRole('button', { name: 'Wróć do gry' }).tap();
  await mobile.evaluate(() => {
    const g = window.blockcraft.game;
    g.inventory.slots[0] = { id: 352, count: 1 }; g.selected = 0;
  });
  await mobile.getByRole('button', { name: '▣' }).tap();
  await mobile.getByRole('heading', { name: 'Kompas biomów' }).waitFor();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'biomeCompass'),
    'Dotyk: ekranowy przycisk używa prawdziwego kompasu biomów');
  await mobile.getByLabel('Szukany biom').selectOption('Tajga');
  await mobile.getByRole('button', { name: 'Szukaj biomu' }).tap();
  await mobile.getByRole('button', { name: 'Zaznacz i śledź na HUD' }).waitFor({ timeout: 30000 });
  await screenshot(mobile, 'mobile-compass');
  await mobile.getByRole('button', { name: 'Zaznacz i śledź na HUD' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.waypoints.some((w) =>
    w.name === 'Biom: Tajga' && w.id === window.blockcraft.game.activeWaypointId) &&
    window.blockcraft.game.ui === 'playing'),
    'Dotyk: znaleziony biom trafia do aktywnej nawigacji HUD');
  await mobile.evaluate(() => {
    const g = window.blockcraft.game;
    g.inventory.slots[0] = { id: 247, count: 1 }; g.selected = 0;
    g.yaw = -Math.PI / 2; g.pitch = 0;
    g.world.setBlock(-36, 35, -45, 3);
    g.world.setBlock(-36, 36, -45, 3);
    g.buildChunk(-3, -3);
  });
  await mobile.getByRole('button', { name: '▣' }).tap();
  await mobile.waitForFunction(() => window.blockcraft.game.isZooming());
  await mobile.getByRole('button', { name: /Zaznacz cel/ }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.waypoints.some((w) =>
    w.name.startsWith('Namierzono:') && w.id === window.blockcraft.game.activeWaypointId)),
    'Dotyk: lorneta oznacza widoczny blok ekranowym przyciskiem');
  await mobile.getByRole('button', { name: '▣' }).tap();
  await mobile.waitForFunction(() => !window.blockcraft.game.isZooming());
  await mobile.getByRole('button', { name: '🎒' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'inventory'), 'Dotyk: otwieranie ekwipunku');
  await screenshot(mobile, 'mobile-inventory');
  await mobile.evaluate(() => window.blockcraft.game.setUI('playing'));
  await mobile.getByRole('button', { name: '⏸' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.ui === 'paused'), 'Dotyk: pauza');
  await screenshot(mobile, 'mobile-pause');
  await mobile.getByRole('button', { name: 'Opcje...' }).tap();
  const beforeDetail = await mobile.evaluate(() => ({
    width: window.blockcraft.game.atlasTex.image.width,
    effect: window.blockcraft.game.gfx.effectDetail,
  }));
  await mobile.getByRole('button', { name: /Tekstury: Oszczędne/ }).tap();
  await mobile.getByRole('button', { name: /Efekty: Oszczędne/ }).tap();
  await mobile.waitForFunction((width) => window.blockcraft.game.atlasTex.image.width > width &&
    window.blockcraft.game.gfx.effectDetail === 'full', beforeDetail.width);
  check(beforeDetail.effect === 'low' && await mobile.evaluate(() =>
    window.blockcraft.game.atlasTex.image.width > 0 && window.blockcraft.game.gfx.effectDetail === 'full'),
  'Dotyk: zmiana szczegółowości tekstur GPU i efektów działa bez restartu świata');
  await mobile.getByRole('button', { name: /Jakość: Auto/ }).tap();
  await mobile.waitForFunction(() => JSON.parse(localStorage.getItem('blockcraft-settings')).quality === 'auto');
  check(await mobile.evaluate(() => JSON.parse(localStorage.getItem('blockcraft-settings')).quality === 'auto'),
    'Dotyk: Auto zapisuje wybór do ustawień');
  await screenshot(mobile, 'mobile-quality');
  await mobile.getByRole('button', { name: 'Gotowe' }).tap();
  check(await mobile.evaluate(() => window.blockcraft.game.save()), 'Telefon emulowany: zapis świata');
  check(mobileErrors.length === 0, `Telefon emulowany: błędy JS/dialogi: ${mobileErrors.join('; ')}`);
  await phone.close();
  console.log(`WebGL2: ${checks} sprawdzeń, 0 błędów. Urządzenie dotykowe było emulowane w Chromium.`);
} finally {
  await browser.close();
}
