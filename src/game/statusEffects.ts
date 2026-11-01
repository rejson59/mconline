/** Timed rescue/status data, in Java's 20 Hz ticks. No wall-clock/offline decay. */
export type TimedEffect = 'fire' | 'speed' | 'night' | 'strength' | 'regen' | 'absorption';
export interface SavedEffect { id: TimedEffect; ticks: number; amplifier: number }
export interface StatusSnapshot { effects: SavedEffect[]; absorption: number }
const IDS = new Set<string>(['fire','speed','night','strength','regen','absorption']);
export function isTimedEffect(id: string): id is TimedEffect { return IDS.has(id); }
export function maxAmplifier(id: string): number { return id === 'regen' || id === 'absorption' ? 1 : 0; }
export function cleanStatus(raw: unknown): StatusSnapshot {
  const out: StatusSnapshot = { effects: [], absorption: 0 };
  if (!raw || typeof raw !== 'object') return out;
  const value = raw as Record<string, unknown>;
  const seen = new Set<string>();
  for (const entry of Array.isArray(value.effects) ? value.effects.slice(0, 32) : []) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, ticks, amplifier } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !IDS.has(id) || seen.has(id) || typeof ticks !== 'number' || !Number.isFinite(ticks) || ticks < 1) continue;
    const level = typeof amplifier === 'number' && Number.isFinite(amplifier) ? Math.min(maxAmplifier(id), Math.max(0, Math.floor(amplifier))) : 0;
    out.effects.push({ id: id as TimedEffect, ticks: Math.min(72000, Math.floor(ticks)), amplifier: level }); seen.add(id);
  }
  const absorb = out.effects.find(effect => effect.id === 'absorption');
  if (absorb && typeof value.absorption === 'number' && Number.isFinite(value.absorption)) out.absorption = Math.max(0, Math.min(4 * (absorb.amplifier + 1), value.absorption));
  return out;
}
/** Effects act on their remaining duration before its decrement, as MobEffectInstance does. */
export function regenerationPulses(before: number, elapsed: number, amplifier: number): number {
  const interval = amplifier > 0 ? 25 : 50;
  const after = Math.max(0, before - elapsed);
  return Math.max(0, Math.floor(before / interval) - Math.floor(after / interval));
}
export function effectClock(remainder: number, dt: number) {
  const seconds = Math.max(0, remainder) + (Number.isFinite(dt) ? Math.max(0, dt) : 0);
  const ticks = Math.floor((seconds + 1e-10) * 20);
  return { ticks, remainder: Math.max(0, seconds - ticks / 20) };
}

/** Java HUD fades the icon (not its frame) during the last 200 ticks. */
export function effectIconOpacity(seconds: number): number {
  const ticks = Math.max(0, Math.round(seconds * 20));
  if (ticks > 200) return 1;
  const base = Math.min(.5, ticks / 100);
  const wave = Math.min(.25, Math.max(0, (10 - Math.floor(ticks / 20)) / 10 * .25));
  return Math.max(0, Math.min(1, base + Math.cos(ticks * Math.PI / 5) * wave));
}
