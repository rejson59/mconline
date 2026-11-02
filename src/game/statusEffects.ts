/** Timed rescue/status data, in Java's 20 Hz ticks. No wall-clock/offline decay. */
export type TimedEffect = 'fire' | 'speed' | 'night' | 'strength' | 'regen' | 'absorption';
export interface SavedEffect { id: TimedEffect; ticks: number; amplifier: number; hidden?: SavedEffect }
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
    const effect = cleanEffect(entry);
    if (!effect || seen.has(effect.id)) continue;
    out.effects.push(effect); seen.add(effect.id);
  }
  const absorb = out.effects.find(effect => effect.id === 'absorption');
  if (absorb && typeof value.absorption === 'number' && Number.isFinite(value.absorption)) out.absorption = Math.max(0, Math.min(4 * (absorb.amplifier + 1), value.absorption));
  return out;
}
/** The supported I/II levels permit at most one strictly weaker hidden effect.
 * Bounded parsing also handles cyclic in-memory objects safely. */
function cleanEffect(raw: unknown, parent?: SavedEffect): SavedEffect | undefined {
  if (!raw || typeof raw !== 'object') return;
  const { id, ticks, amplifier, hidden } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !isTimedEffect(id) || typeof ticks !== 'number' || !Number.isFinite(ticks) || ticks < 1) return;
  const level = typeof amplifier === 'number' && Number.isFinite(amplifier) ? Math.min(maxAmplifier(id), Math.max(0, Math.floor(amplifier))) : 0;
  if (parent && (id !== parent.id || level >= parent.amplifier)) return;
  const effect: SavedEffect = { id, ticks: Math.min(72000, Math.floor(ticks)), amplifier: level };
  if (!parent && level > 0) {
    const next = cleanEffect(hidden, effect);
    if (next) effect.hidden = next;
  }
  return effect;
}

/** Java update semantics: a short stronger effect masks rather than deletes a
 * longer weaker one. Hidden durations still run down while not acting. */
export function mergeEffect(current: SavedEffect | undefined, offered: SavedEffect): SavedEffect {
  if (!current) return { ...offered };
  if (offered.amplifier > current.amplifier) {
    const hidden = offered.ticks < current.ticks ? { ...current } : current.hidden;
    return { ...offered, ...(hidden ? { hidden } : {}) };
  }
  if (offered.amplifier === current.amplifier) return { ...current, ticks: Math.max(current.ticks, offered.ticks) };
  return offered.ticks > current.ticks ? { ...current, hidden: mergeEffect(current.hidden, offered) } : { ...current };
}

/** Batch exactly across promotion boundaries; the fallback's first action is
 * the NEXT tick, not the tick which expired the stronger effect. */
export function advanceEffect(effect: SavedEffect, elapsed: number): { effect?: SavedEffect; pulses: number } {
  let current: SavedEffect | undefined = effect;
  let remaining = elapsed, pulses = 0;
  while (current && remaining > 0) {
    const ticks = Math.min(current.ticks, remaining);
    if (current.id === 'regen') pulses += regenerationPulses(current.ticks, ticks, current.amplifier);
    const hidden: SavedEffect | undefined = current.hidden && current.hidden.ticks > ticks ? { ...current.hidden, ticks: current.hidden.ticks - ticks } : undefined;
    const left: number = current.ticks - ticks;
    current = left > 0 ? { ...current, ticks: left, hidden } : hidden;
    remaining -= ticks;
  }
  return { effect: current, pulses };
}

/** Reverse natural ordering of positive, nonambient finite Java effects. */
const EFFECT_COLORS: Record<string, number> = { strength: 16762624, fire: 16750848, regen: 13458603, night: 12779366, speed: 3402751, absorption: 2445989 };
export function compareEffectIcons(a: { id: string; left: number }, b: { id: string; left: number }): number {
  const at = Math.round(a.left * 20), bt = Math.round(b.left * 20);
  return ((at <= 32147 || bt <= 32147) ? bt - at : 0) || (EFFECT_COLORS[b.id] ?? 0) - (EFFECT_COLORS[a.id] ?? 0);
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
