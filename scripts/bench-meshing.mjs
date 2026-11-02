#!/usr/bin/env node
/** CPU meshing only; no network, no telemetry, no claim about rendered FPS. */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(root, '.cache/meshing-bench');
mkdirSync(dir, { recursive: true });
const entry = path.join(dir, 'bench.mjs');
await build({
  entryPoints: [path.join(root, '.harness/perf.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: entry,
});
const child = spawnSync(process.execPath, [entry], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(child.status ?? 1);
