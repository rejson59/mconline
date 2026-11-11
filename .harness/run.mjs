#!/usr/bin/env node
/**
 * Headless test runner for BlockCraft.
 *
 *   npm test            # engine + UI suite
 *   npm test -- smoke   # only the engine suite
 *   npm test -- ui      # only the UI suite
 *
 * The suites are TypeScript, so they are bundled with esbuild (already a
 * dependency of Vite) and then executed by Node. No browser, no WebGL, no
 * test framework – the suites are plain scripts that count their own checks
 * and exit non-zero on the first failing group.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cache = path.join(root, 'node_modules', '.cache', 'blockcraft-tests');

const SUITES = [
  { name: 'reports442', entry: path.join(here, 'reports442.ts'), label: 'Dziesięć zgłoszeń: creeper, modele i przepisy' },
  { name: 'mobmotion', entry: path.join(here, 'mobMotion.ts'), label: 'Moby: płynność, bezpieczne pozycje i budżet symulacji' },
  { name: 'remotehands', entry: path.join(here, 'remoteHands.ts'), label: 'Obie ręce innych graczy: modele, ruch ramion i tekstury' },
  { name: 'cubepose', entry: path.join(here, 'cubeDisplay.ts'), label: 'Pięć rodzin bloków: pozy przedmiotów w rękach i dropie' },
  { name: 'trappose', entry: path.join(here, 'trapdoorPose.ts'), label: 'Włazy: oryginalne pozycje w rękach, dropie i u innych graczy' },
  { name: 'landscape', entry: path.join(here, 'landscape.tsx'), label: 'Telefon: tylko pozioma rozgrywka, bez obejścia blokady' },
  { name: 'trapitem', entry: path.join(here, 'trapdoorItem.ts'), label: 'Przedmiot włazu: ręce, drop i ikona ekwipunku' },
  { name: 'trapuv', entry: path.join(here, 'trapdoorUV.ts'), label: 'Tekstury włazów: oryginalne modele, UV i worker' },
  { name: 'traps', entry: path.join(here, 'trapStates.ts'), label: 'Włazy: trwały kierunek, połowy, stawianie i stare zapisy' },
  { name: 'panels', entry: path.join(here, 'thinPanels.ts'), label: 'Włazy i drzwi: fizyka, celownik i stawianie' },
  { name: 'fences', entry: path.join(here, 'fences.ts'), label: 'Płoty: sąsiedzi, kolizje, celownik i stawianie' },
  { name: 'movement', entry: path.join(here, 'movement.ts'), label: 'Ruch: cienkie bryły, podparcie i płoty' },
  {name:'refinements',entry:path.join(here,'refinements.ts'),label:'Złoto, receptury, łóżka, chmury i modele'},
  { name: 'shared', entry: path.join(here, 'sharedState.ts'), label: 'Wspólne skrzynie/moby: dziennik i przejęcie stanu' },
  { name: 'checkpoint', entry: path.join(here, 'profileCheckpoint.ts'), label: 'Ekwipunek: dziennik i bezpieczne odzyskiwanie' },
  { name: 'lease', entry: path.join(here, 'multiplayerLease.ts'), label: 'Multiplayer: powrót karty i sprzątanie sesji' },
  { name: 'cloud', entry: path.join(here, 'cloud.ts'), label: 'Światy kontowe, konflikt urządzeń i autoryzowana bramka' },
  { name: 'panorama', entry: path.join(here, 'panorama.tsx'), label: 'Ruchome panoramy i wybór tła menu' },
  { name: 'facing', entry: path.join(here, 'facing.ts'), label: 'Oryginalne stany pieca, tekstury i UV' },
  { name: 'furnace', entry: path.join(here, 'furnace.ts'), label: 'Piec, surowe metale i oryginalne ikony Java' },
  { name: 'native', entry: path.join(here, 'nativeAudit.ts'), label: 'Porównanie z oryginalnymi JSON Java 1.20.4' },
  { name: 'fire', entry: path.join(here, 'fire.ts'), label: 'Krzesiwo, ogień, portale i ochrona działek' },
  { name: 'meshing', entry: path.join(here, 'meshing.ts'), label: 'Asynchroniczne chunki i bezpieczny fallback' },
  { name: 'audio', entry: path.join(here, 'audio.ts'), label: 'Oryginalne efekty i mikser' },
  { name: 'smoke', entry: path.join(here, 'smoke.ts'), label: 'Silnik (headless)' },
  { name: 'ui', entry: path.join(here, 'ui.tsx'), label: 'Interfejs (React)' },
  { name: 'account', entry: path.join(here, 'account.tsx'), label: 'Ogólne konto rejson59.github.io' },
];

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const suites = wanted.length ? SUITES.filter((s) => wanted.includes(s.name)) : SUITES;

if (!suites.length) {
  console.error(`Nie znam testu „${wanted.join(', ')}”. Dostępne: ${SUITES.map((s) => s.name).join(', ')}`);
  process.exit(2);
}

for (const s of suites) {
  if (!existsSync(s.entry)) {
    console.error(`Brak pliku ${path.relative(root, s.entry)}`);
    process.exit(2);
  }
}

rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });

// 2.31: w logu CI od razu widać, na czym testy działają – bez tego diagnoza
// awarii runnera sprowadzała się do zgadywania.
console.log(`Node ${process.version} · ${process.platform}/${process.arch}`);

let failed = false;

for (const s of suites) {
  const out = path.join(cache, `${s.name}.mjs`);
  process.stdout.write(`\n▸ ${s.label}\n`);
  try {
    await esbuild.build({
      entryPoints: [s.entry],
      outfile: out,
      bundle: true,
      // Vite owns the production inline worker. Headless engine tests use the
      // synchronous path; AsyncMesher is separately exercised with a fake port.
      plugins: [{ name: 'headless-worker', setup(build) {
        build.onResolve({ filter: /\?worker&inline$/ }, () => ({ path: 'worker', namespace: 'headless-worker' }));
        build.onLoad({ filter: /.*/, namespace: 'headless-worker' }, () => ({ contents: 'export default class { constructor() { throw new Error("Worker unavailable in headless harness"); } }', loader: 'js' }));
      } }],
      format: 'esm',
      platform: 'node',
      target: 'node20',
      sourcemap: 'inline',
      logLevel: 'warning',
      // react-dom/server still calls require() for node builtins when it is
      // bundled into ESM, and optional peers (jsdom) resolve at runtime.
      banner: {
        js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
      },
      external: ['jsdom', 'canvas'],
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"development"' },
    });
  } catch (e) {
    console.error(`Bundlowanie ${s.name} nie powiodło się:`, e?.message ?? e);
    failed = true;
    continue;
  }

  const res = spawnSync(process.execPath, [out], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    failed = true;
    console.error(`✗ ${s.label}: kod ${res.status ?? 'brak'}${res.signal ? `, sygnał ${res.signal}` : ''}`);
  }
}

rmSync(cache, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
// keep the import used even when the runner exits early
void pathToFileURL;
