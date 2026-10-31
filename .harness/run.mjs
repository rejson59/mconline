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
  { name: 'smoke', entry: path.join(here, 'smoke.ts'), label: 'Silnik (headless)' },
  { name: 'ui', entry: path.join(here, 'ui.tsx'), label: 'Interfejs (React)' },
  { name: 'account', entry: path.join(here, 'account.tsx'), label: 'Konto społeczności' },
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
