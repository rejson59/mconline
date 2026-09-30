#!/usr/bin/env node
/** Integration check with an actual 2.7-built export, not a save assembled
 * from the current schema. In another directory, run:
 *   mkdir legacy && git archive e15e457 | tar -x -C legacy
 *   (cd legacy && npm ci && npm run dev -- --host 0.0.0.0 --port 5174)
 * Start the current Vite on 5173. Then run this with the same browser env as
 * test:browser. The two browser contexts have independent localStorage.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const modulePath = process.env.BLOCKCRAFT_CHROMIUM_MODULE;
const packaged = modulePath ? (await import(modulePath)).default : null;
const binary = packaged ? await packaged.executablePath() : process.env.CHROME_BIN || chromium.executablePath();
if (!existsSync(binary)) throw new Error('Missing Chromium: set CHROME_BIN or BLOCKCRAFT_CHROMIUM_MODULE');
const args = packaged ? [...packaged.args, '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] :
  ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
let browser = await chromium.launch({ executablePath: binary, args, headless: true, timeout: 30000 });
const oldUrl = process.env.LEGACY_27_URL || 'http://localhost:5174/';
const newUrl = process.env.BROWSER_URL || 'http://localhost:5173/';
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const launchWorld = async (page) => {
  await page.waitForFunction(() => window.blockcraft?.game?.renderer?.info?.render?.frame > 2,
    undefined, { timeout: 60000 });
  await page.getByRole('button', { name: 'Kliknij, aby grać' }).click();
};
const quit = async (page) => {
  await page.evaluate(() => window.blockcraft.game.setUI('paused'));
  await page.getByRole('button', { name: 'Zapisz i wyjdź do menu' }).evaluate((b) => b.click());
  await page.getByRole('button', { name: 'Eksport zapisów' }).waitFor({ timeout: 30000 });
};
const downloadExport = async (page) => {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Eksport zapisów' }).click(),
  ]);
  return JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'));
};
try {
  const legacyContext = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const old = await legacyContext.newPage();
  const errors = [];
  old.on('pageerror', (e) => errors.push(e.message));
  await old.goto(oldUrl);
  check(await old.getByText('WERSJA 2.7', { exact: true }).isVisible(), 'archival menu is version 2.7');
  await old.getByRole('button', { name: 'Nowy świat', exact: true }).click();
  await old.getByPlaceholder('np. Wyspa').fill('Eksport 2.7');
  await old.getByPlaceholder('np. 12345 lub dowolny tekst').fill('12345');
  await old.getByRole('button', { name: 'Stwórz świat' }).click();
  await launchWorld(old);
  check(await old.evaluate(() => window.blockcraft.game.renderer.getContext().getParameter(0x1F02).startsWith('WebGL 2')),
    '2.7 genuinely runs in WebGL2');
  check(await old.evaluate(() => {
    const g = window.blockcraft.game;
    g.world.setBlock(4, 110, 4, 10); // glass placed in the old world
    g.save();
    return g.world.getBlock(4, 110, 4) === 10 &&
      JSON.parse(localStorage.getItem('blockcraft-saves-v2')).some((s) => s.seed === 12345 && s.mods);
  }), '2.7 saves a real block edit');
  await quit(old);
  const archived = await downloadExport(old);
  check(archived.blockcraft === 1 && archived.saves?.length === 1 &&
    archived.saves[0].seed === 12345 && archived.saves[0].mods &&
    (archived.saves[0].terrainVersion == null || archived.saves[0].terrainVersion < 6),
    `actual 2.7 exported JSON includes legacy terrain and block edits: ${JSON.stringify({
      keys: Object.keys(archived), saves: archived.saves?.length,
      seed: archived.saves?.[0]?.seed, version: archived.saves?.[0]?.terrainVersion,
      mods: !!archived.saves?.[0]?.mods,
    })}`);
  check(errors.length === 0, `2.7 browser errors: ${errors.join('; ')}`);
  await legacyContext.close();
  // Serverless Chromium uses --single-process: closing its context stops the
  // whole browser, so launch a fresh instance for the 2.8 import.
  await browser.close();
  browser = await chromium.launch({ executablePath: binary, args, headless: true, timeout: 30000 });

  const currentContext = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
  const page = await currentContext.newPage();
  const currentErrors = [];
  page.on('pageerror', (e) => currentErrors.push(e.message));
  page.on('dialog', async (dialog) => { if (!dialog.message().includes('Zaimportowano światów: 1')) currentErrors.push(dialog.message()); await dialog.accept(); });
  await page.goto(newUrl);
  await page.locator('input[type=file]').setInputFiles({ name: 'blockcraft-2.7.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archived)) });
  await page.getByText('Eksport 2.7').first().waitFor();
  check(await page.evaluate((version) => JSON.parse(localStorage.getItem('blockcraft-saves-v2'))[0].terrainVersion === version,
    archived.saves[0].terrainVersion), '2.8 imports a real 2.7 export without changing generator version');
  await page.locator('button').filter({ hasText: 'Eksport 2.7' }).first().click();
  await launchWorld(page);
  const legacyOpened = await page.evaluate(() => {
    const g = window.blockcraft.game;
    return { seed: g.homeWorld.seed, version: g.homeWorld.terrainVersion,
      block: g.world.getBlock(4, 110, 4), discoveries: g.discovery.count('overworld') };
  });
  check(legacyOpened.seed === 12345 && legacyOpened.version === 2 && legacyOpened.block === 10 &&
    legacyOpened.discoveries <= 2, `imported 2.7 world preserves terrain and placed glass: ${JSON.stringify(legacyOpened)}`);
  await quit(page);
  const exportedAgain = await downloadExport(page);
  check(exportedAgain.saves[0].terrainVersion === 2 &&
    JSON.stringify(exportedAgain.saves[0].mods) === JSON.stringify(archived.saves[0].mods),
    '2.8 export round-trip retains old terrain v2 and original block edits');
  check(currentErrors.length === 0, `2.8 browser errors: ${currentErrors.join('; ')}`);
  await currentContext.close();
  console.log(`Historyczny eksport 2.7 → import/eksport 2.8: ${checks} sprawdzeń, 0 błędów.`);
} finally {
  await browser.close();
}
