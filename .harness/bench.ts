/** Quick meshing benchmark: node --import tsx? No – bundled via the harness runner. */
import { World, CS } from '../src/game/world';

const runs = Number(process.env.BENCH_RUNS ?? 6);
let best = Infinity;
let total = 0;
for (let r = 0; r < runs; r++) {
  const w = new World(12345 + r);
  // pre-generate the 3×3 neighbourhood so buildMesh() only meshes
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) w.getChunk(dx, dz);
  const c = w.getChunk(0, 0);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) w.buildMesh(c);
  const dt = performance.now() - t0;
  best = Math.min(best, dt);
  total += dt;
}
console.log(`buildMesh ×20: best ${best.toFixed(1)} ms, avg ${(total / runs).toFixed(1)} ms (chunk ${CS}×CS×128)`);
