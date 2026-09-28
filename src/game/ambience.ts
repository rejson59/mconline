import type { Biome } from './world';

/** Sparse ambient cues: selected at most once per ambient timer, never per
 * rendered frame. A pure selector keeps biome acoustics testable without an
 * AudioContext and prevents birds or rainfall sounds inside Nether/caves. */
export type AmbientCue = 'bird' | 'wind' | 'marsh' | 'insects' | 'surf' | 'snow' | 'sand' | 'cave' | 'nether';

export function chooseAmbient(biome: Biome, underground: boolean, raining: boolean,
  daylight: number, roll: number): AmbientCue | null {
  if (biome === 'Nether') return 'nether';
  if (underground) return 'cave';
  if (!Number.isFinite(roll)) return null;
  const chance = Math.max(0, Math.min(1, roll));
  if (raining && biome !== 'Pustynia') {
    if (biome === 'Tundra' || biome === 'Góry') return chance < 0.8 ? 'snow' : null;
    if (biome === 'Ocean' || biome === 'Plaża') return chance < 0.8 ? 'surf' : null;
    return chance < 0.65 ? 'wind' : null;
  }
  if (biome === 'Ocean' || biome === 'Plaża') return chance < 0.85 ? 'surf' : 'wind';
  if (biome === 'Tundra' || biome === 'Góry') return chance < 0.8 ? 'snow' : 'wind';
  if (biome === 'Pustynia' || biome === 'Pustkowie') return chance < 0.75 ? 'sand' : null;
  if (biome === 'Bagno') return chance < 0.75 ? 'marsh' : 'wind';
  if (biome === 'Dżungla' || biome === 'Sawanna') return chance < 0.7 ? 'insects' : 'wind';
  if (daylight > 0.55 && (biome === 'Las' || biome === 'Brzozowy las' || biome === 'Tajga' ||
      biome === 'Kwiecista łąka' || biome === 'Równiny')) return chance < 0.58 ? 'bird' : 'wind';
  return chance < 0.55 ? 'wind' : null;
}
