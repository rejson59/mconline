/** Reproducible CPU microbenchmark; deliberately not an FPS benchmark. */
import { meshFingerprint as describe } from './meshFingerprint';
import { cpus, platform, arch } from 'node:os';
import { World } from '../src/game/world';
import { B } from '../src/game/blocks';

const cases = [
  ['terrain', new World(12345)],
  ['nether', new World(12345, false, true)],
  ['flat', new World(12345, true)],
  ['models', new World(9876, true)],
  ['city', new World(20261101, false, false, true)],
] as const;
const iterations = Math.max(
  2,
  Math.min(100, Math.floor(Number(process.env.BENCH_ITERATIONS) || 12)),
);
const results = [];
for (const [name, w] of cases) {
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) w.getChunk(x, z);
  if (name === 'models')
    for (const [n, id] of [
      B.TORCH,
      B.WATER,
      B.LAVA,
      B.CHEST,
      B.GLASS_PANE,
      B.RAIL,
      B.OAK_SLAB,
      B.OAK_STAIRS_N,
      B.LEAVES,
    ].entries()) {
      if (id !== undefined) w.setBlock(n + 2, 65, 6, id);
    }
  const c = w.getChunk(0, 0);
  let summary: ReturnType<typeof describe> | undefined;
  for (let i = 0; i < 3; i++) {
    const gs = w.buildMesh(c);
    summary = describe(gs);
    for (const g of gs) g.dispose();
  }
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now(),
      gs = w.buildMesh(c);
    times.push(performance.now() - start);
    for (const g of gs) g.dispose();
  }
  times.sort((a, b) => a - b);
  results.push({
    name,
    ...summary,
    iterations,
    medianMs: times[Math.floor(times.length / 2)],
    p95Ms: times[Math.ceil(times.length * 0.95) - 1],
    meanMs: times.reduce((a, b) => a + b, 0) / times.length,
  });
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      os: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      results,
    },
    null,
    2,
  ),
);
