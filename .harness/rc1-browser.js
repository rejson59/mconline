#!/usr/bin/env node
/** Browser integration test using an actual 2.8 RC1 export, never a synthetic
 * v6 save. Outside this checkout: `git archive e6be017 | tar -x -C /path/to/rc1`;
 * install dependencies and run its Vite on port 5174. Run current Vite on 5173.
 * Use the Chromium environment variables described in browser.js.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const mod = process.env.BLOCKCRAFT_CHROMIUM_MODULE;
const packaged = mod ? (await import(mod)).default : null;
const executablePath = packaged ? await packaged.executablePath() : process.env.CHROME_BIN || chromium.executablePath();
if (!existsSync(executablePath)) throw new Error('Missing Chromium: set CHROME_BIN or BLOCKCRAFT_CHROMIUM_MODULE');
const args = packaged ? [...packaged.args, '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] :
  ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const launch = () => chromium.launch({ executablePath, args, headless: true, timeout: 30000 });
const rc1Url = process.env.RC1_URL || 'http://localhost:5174/';
const currentUrl = process.env.BROWSER_URL || 'http://localhost:5173/';
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; };
const open = async (page) => {
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 2,
    undefined, { timeout: 60000 });
  await page.getByRole('button', { name: 'Kliknij, aby grać' }).click();
};
const quit = async (page) => {
  await page.evaluate(() => window.blockcraft.game.setUI('paused'));
  await page.getByRole('button', { name: 'Zapisz i wyjdź do menu' }).evaluate((b) => b.click());
  await page.getByRole('button', { name: 'Eksport zapisów' }).waitFor();
};
const download = async (page) => {
  const [file] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Eksport zapisów' }).click(),
  ]);
  return JSON.parse(await readFile(await file.path(), 'utf8'));
};
const digest = () => {
  const w = window.blockcraft.game.homeWorld;
  let hash = 2166136261;
  for (const id of w.getChunk(-28, 2).data) hash = Math.imul(hash ^ id, 16777619) >>> 0;
  return { hash, version: w.terrainVersion, block: w.getBlock(4, 110, 4) };
};
let browser = await launch();
try {
  const oldContext = await browser.newContext({ acceptDownloads: true });
  const old = await oldContext.newPage();
  const oldErrors = [];
  old.on('pageerror', (err) => oldErrors.push(err.message));
  await old.goto(rc1Url);
  check(await old.getByText('WERSJA 2.8 RC1', { exact: true }).isVisible(), 'unmodified RC1 menu');
  await old.getByRole('button', { name: 'Nowy świat', exact: true }).click();
  await old.getByPlaceholder('np. Wyspa').fill('Eksport RC1');
  await old.getByPlaceholder('np. 12345 lub dowolny tekst').fill('12345');
  await old.getByRole('button', { name: 'Tryb gry: Przetrwanie' }).click();
  await old.getByRole('button', { name: 'Stwórz świat' }).click();
  await open(old);
  check(await old.evaluate(() => window.blockcraft.game.renderer.getContext().getParameter(0x1F02).startsWith('WebGL 2')),
    'actual RC1 runs in WebGL2');
  const original = await old.evaluate(() => {
    const g = window.blockcraft.game;
    g.world.setBlock(4, 110, 4, 10); // a player edit remains after export
    g.save();
    let hash = 2166136261;
    for (const id of g.homeWorld.getChunk(-28, 2).data) hash = Math.imul(hash ^ id, 16777619) >>> 0;
    return { hash, version: g.homeWorld.terrainVersion, block: g.world.getBlock(4, 110, 4) };
  });
  check(original.version === 6 && original.block === 10 && original.hash === 1367259331,
    `RC1 real world has unvisited v6 terrain and a player edit: ${JSON.stringify(original)}`);
  await quit(old);
  const archived = await download(old);
  check(archived.blockcraft === 1 && archived.saves?.length === 1 &&
    archived.saves[0].terrainVersion === 6 && archived.saves[0].mods,
    'RC1 actually exports a v6 save (not a modified RC3 fixture)');
  check(oldErrors.length === 0, `RC1 browser errors: ${oldErrors.join('; ')}`);
  await oldContext.close();
  await browser.close(); // serverless Chromium uses --single-process
  browser = await launch();

  const currentContext = await browser.newContext({ acceptDownloads: true });
  const page = await currentContext.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', async (dialog) => {
    if (!dialog.message().includes('Zaimportowano światów: 1')) errors.push(dialog.message());
    await dialog.accept();
  });
  await page.goto(currentUrl);
  check(await page.getByText('WERSJA 2.8 RC3', { exact: true }).isVisible(), 'new menu is RC3');
  await page.locator('input[type=file]').setInputFiles({ name: 'rc1.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archived)) });
  await page.getByText('Eksport RC1').first().waitFor();
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('blockcraft-saves-v2'))[0].terrainVersion === 6),
    'RC3 imports real RC1 export without upgrading its generator');
  await page.locator('button').filter({ hasText: 'Eksport RC1' }).first().click();
  await open(page);
  const migrated = await page.evaluate(digest);
  check(migrated.version === 6 && migrated.block === 10 && migrated.hash === original.hash,
    `RC3 keeps RC1 block edit and unvisited terrain: ${JSON.stringify(migrated)}`);
  await quit(page);
  const exported = await download(page);
  check(exported.saves[0].terrainVersion === 6 &&
    JSON.stringify(exported.saves[0].mods) === JSON.stringify(archived.saves[0].mods),
    'RC3 export round-trip retains RC1 generator and modifications');
  check(errors.length === 0, `RC3 browser errors: ${errors.join('; ')}`);
  await currentContext.close();
  console.log(`Rzeczywisty eksport RC1 → import/eksport RC3: ${checks} sprawdzeń, 0 błędów.`);
} finally {
  await browser.close();
}
