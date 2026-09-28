/**
 * Enchantments – the heart of update 1.5.
 *
 * Pure data + helpers so the engine stays in charge of state and the React
 * screens only render. An enchanted stack simply carries an extra
 * `ench: { [id]: level }` map; everything else (saves, chests, drops,
 * tooltips) already copies whole stacks, so the field rides along.
 */
import type { Stack } from './inventory';
import { ITEMS, isItem } from './items';
import { B, BLOCKS } from './blocks';

export type EnchId =
  | 'efficiency'
  | 'fortune'
  | 'silktouch'
  | 'unbreaking'
  | 'sharpness'
  | 'power'
  | 'infinity'
  | 'knockback'
  | 'looting'
  | 'protection'
  | 'featherfalling'
  | 'fireward'
  | 'arrowguard'
  | 'tidewalker';

export interface EnchDef {
  id: EnchId;
  /** Polish display name. */
  name: string;
  /** Highest level the enchanting table can offer. */
  max: number;
  /** Aliases accepted by /enchant (lower-case, no diacritics). */
  keys: string[];
  /** One-line description used in the table and tooltips. */
  desc: (lvl: number) => string;
}

export const ENCHANTS: EnchDef[] = [
  { id: 'efficiency', name: 'Wydajność', max: 5, keys: ['wydajnosc', 'efficiency'],
    desc: (l) => `Kopanie jest ${l * 35}% szybsze.` },
  { id: 'fortune', name: 'Szczęście', max: 3, keys: ['szczescie', 'fortune'],
    desc: (l) => `Rudy i plony dają do ${l + 1}× więcej surowców.` },
  { id: 'silktouch', name: 'Jedwabny dotyk', max: 1, keys: ['jedwabny_dotyk', 'silktouch', 'silk_touch'],
    desc: () => 'Bloki wypadają w oryginalnej formie (kamień, szkło, ruda).' },
  { id: 'unbreaking', name: 'Niezniszczalność', max: 3, keys: ['niezniszczalnosc', 'unbreaking'],
    desc: (l) => `${Math.round(l / (l + 1) * 100)}% szans, że użycie nie zużyje wytrzymałości.` },
  { id: 'sharpness', name: 'Ostrość', max: 5, keys: ['ostrzosc', 'sharpness'],
    desc: (l) => `+${(l * 0.5 + 0.5).toFixed(1)} obrażeń w zwarciu.` },
  { id: 'power', name: 'Moc', max: 5, keys: ['moc', 'power'],
    desc: (l) => `Strzały zadają ${l * 30}% więcej obrażeń.` },
  { id: 'infinity', name: 'Nieskończoność', max: 1, keys: ['nieskonczonosc', 'infinity'],
    desc: () => 'Łuk nie zużywa strzał (musisz mieć choć jedną).' },
  { id: 'knockback', name: 'Odrzut', max: 2, keys: ['odrzut', 'knockback'],
    desc: (l) => `Cios odrzuca przeciwników ${l * 60}% mocniej.` },
  { id: 'looting', name: 'Grabież', max: 3, keys: ['grabiez', 'looting'],
    desc: (l) => `Moby zostawiają do ${l} dodatkowych przedmiotów.` },
  { id: 'protection', name: 'Ochrona', max: 4, keys: ['ochrona', 'protection'],
    desc: (l) => `Redukuje obrażenia o ${l * 4}% (łącznie z pancerzem).` },
  { id: 'featherfalling', name: 'Lekki krok', max: 4, keys: ['lekki_krok', 'feather_falling', 'featherfalling'],
    desc: (l) => `Obrażenia od upadku o ${l * 12}% mniejsze.` },
  { id: 'fireward', name: 'Osłona żaru', max: 4, keys: ['oslona_zaru', 'fireward'],
    desc: (l) => `O ${l * 8}% mniej obrażeń od lawy, magmy i ognia (nie daje pełnej odporności). Konflikt: Ochrona, Osłona strzał.` },
  { id: 'arrowguard', name: 'Osłona strzał', max: 4, keys: ['oslona_strzal', 'arrowguard'],
    desc: (l) => `O ${l * 8}% mniej obrażeń od pocisków. Konflikt: Ochrona, Osłona żaru.` },
  { id: 'tidewalker', name: 'Krok pływaka', max: 3, keys: ['krok_plywaka', 'tidewalker'],
    desc: (l) => `Ruch w wodzie o ${l * 15}% szybszy; nie zwiększa prędkości na lądzie.` },
];

const BY_ID = new Map<string, EnchDef>(ENCHANTS.map((e) => [e.id, e]));

const KEY_INDEX = new Map<string, EnchId>();
for (const e of ENCHANTS) {
  KEY_INDEX.set(e.id, e.id);
  for (const k of e.keys) KEY_INDEX.set(k, e.id);
}

export function enchDef(id: string): EnchDef | undefined {
  return BY_ID.get(id);
}

export function resolveEnch(arg: string): EnchId | null {
  const q = arg.trim().toLowerCase().replace(/\s+/g, '_');
  return KEY_INDEX.get(q) ?? null;
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** "Wydajność III" – level omitted for single-level enchantments. */
export function enchName(id: string, lvl: number): string {
  const d = enchDef(id);
  if (!d) return id;
  return d.max > 1 ? `${d.name} ${ROMAN[lvl] ?? lvl}` : d.name;
}

// ---------------------------------------------------------------- applicability
type Target = 'pick' | 'axe' | 'shovel' | 'sword' | 'spear' | 'hoe' | 'shears' | 'bow' | 'shield' | 'armor';

function targetsOf(itemId: number): Target[] {
  const it = ITEMS[itemId];
  if (it?.kind === 'tool') {
    if (it.tool === 'shears') return ['shears'];
    if (it.tool === 'bow') return ['bow'];
    if (it.tool === 'shield') return ['shield'];
    if (it.tool === 'sword' || it.tool === 'spear') return [it.tool];
    if (it.tool === 'pick' || it.tool === 'axe' || it.tool === 'shovel' || it.tool === 'hoe') return [it.tool];
    // 2.3: wędka i lorneta to narzędzia obserwacyjne – nie poddają się
    // zaklęciom, a wcześniejsze `as Target` przemycało je jako cel.
    return [];
  }
  if (it?.kind === 'armor') return ['armor'];
  return [];
}

/** Can this enchant ever appear on this item? */
export function canEnchant(itemId: number, ench: EnchId | string): boolean {
  if (!isItem(itemId)) return false;
  const t = targetsOf(itemId);
  if (!t.length) return false;
  switch (ench) {
    case 'efficiency': return t.some((x) => x === 'pick' || x === 'axe' || x === 'shovel' || x === 'hoe' || x === 'shears');
    case 'fortune': return t.some((x) => x === 'pick' || x === 'shovel' || x === 'hoe');
    case 'silktouch': return t.some((x) => x === 'pick' || x === 'axe' || x === 'shovel' || x === 'hoe');
    case 'unbreaking': return t.length > 0;
    case 'sharpness': return t.includes('sword') || t.includes('spear');
    case 'power': case 'infinity': return t.includes('bow');
    case 'knockback': case 'looting': return t.includes('sword');
    case 'protection': return t.includes('armor');
    case 'featherfalling': case 'tidewalker': return t.includes('armor') && ITEMS[itemId]?.armor?.slot === 3;
    case 'fireward': case 'arrowguard': return t.includes('armor');
    default: return false;
  }
}

/** Pairs that can never sit on the same item. */
export function conflicts(a: EnchId | string, b: EnchId | string): boolean {
  if ((a === 'silktouch' && b === 'fortune') || (a === 'fortune' && b === 'silktouch')) return true;
  return a !== b && ['protection', 'fireward', 'arrowguard'].includes(a) && ['protection', 'fireward', 'arrowguard'].includes(b);
}

/** Max enchantments one stack may carry at the table. */
export const MAX_ENCHS = 3;

// ---------------------------------------------------------------- stack helpers
export function enchLevel(s: Stack | null | undefined, id: EnchId | string): number {
  return s?.ench?.[id] ?? 0;
}

export function hasEnch(s: Stack | null | undefined, id: EnchId | string): boolean {
  return enchLevel(s, id) > 0;
}

/** True when `ench` may still be added to this stack (room, no conflict, not maxed). */
export function canAddEnch(s: Stack | null | undefined, ench: EnchId): boolean {
  if (!s || !canEnchant(s.id, ench)) return false;
  const cur = s.ench ?? {};
  const list = Object.keys(cur);
  if (list.includes(ench)) return false;
  if (list.length >= MAX_ENCHS) return false;
  if (list.some((k) => conflicts(k, ench))) return false;
  return true;
}

/** Mutates the stack: adds or upgrades the enchantment. */
export function addEnch(s: Stack, ench: EnchId, lvl: number): void {
  const d = enchDef(ench);
  if (!d || Object.keys(s.ench ?? {}).some((id) => conflicts(id, ench))) return;
  s.ench = { ...(s.ench ?? {}), [ench]: Math.max(1, Math.min(d.max, lvl)) };
}

/** Sorted "Name III" lines for tooltips (stable, definition order). */
export function enchList(s: Stack | null | undefined): string[] {
  if (!s?.ench) return [];
  return ENCHANTS.filter((d) => s.ench![d.id]).map((d) => enchName(d.id, s.ench![d.id]));
}

/** "Diamentowy kilof · Wydajność III" or the plain name. */
export function stackName(s: Stack | null | undefined): string {
  if (!s) return '';
  const ench = enchList(s);
  const base = ITEMS[s.id]?.name || BLOCKS[s.id]?.name || 'Nieznane';
  return ench.length ? `${base} · ${ench.join(', ')}` : base;
}

// ------------------------------------------------------------ table option roll
export interface EnchOption {
  ench: EnchId;
  level: number;
  /** Player levels required (and spent). */
  cost: number;
  /** Lapis lazuli consumed, 1–3 by slot. */
  lapis: number;
}

/**
 * Bookshelves in the ring around a table: rows y and y+1, 1–2 blocks away
 * horizontally, corners excluded – the classic 15-shelf layout caps it.
 * `get` is any block lookup, so the engine passes World.peekBlock and tests
 * pass a plain function.
 */
export function countShelves(get: (x: number, y: number, z: number) => number, x: number, y: number, z: number): number {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const r = Math.max(Math.abs(dx), Math.abs(dz));
      if (r < 1 || r > 2) continue;
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // corners don't count
      for (const dy of [0, 1]) if (get(x + dx, y + dy, z + dz) === B.BOOKSHELF) n++;
    }
  }
  return Math.min(15, n);
}

/**
 * The three offers an enchanting table shows. `power` is the shelf count
 * (0–15): it sets the level ceiling, slot index raises quality (and price),
 * so a fully shelved table reaches level 30 like the classic game.
 */
export function rollEnchantOptions(item: Stack | null | undefined, power: number, rand: () => number): EnchOption[] {
  if (!item) return [];
  const pool = ENCHANTS.filter((d) => canAddEnch(item, d.id));
  if (!pool.length) return [];
  const cap = Math.min(30, 3 + power * 1.8 + rand() * 4);
  const options: EnchOption[] = [];
  const taken = new Set<EnchId>();
  for (let slot = 0; slot < 3; slot++) {
    const candidates = pool.filter((c) => !taken.has(c.id));
    if (!candidates.length) break;
    // later slots are "better": stronger levels for the same enchant, higher price
    const quality = Math.min(1, 0.34 + slot * 0.28 + rand() * 0.14);
    const cand = candidates[Math.floor(rand() * candidates.length)];
    const level = Math.max(1, Math.min(cand.max, Math.round(1 + quality * (cand.max - 1))));
    const cost = Math.max(1, Math.min(30, Math.round(quality * cap)));
    options.push({ ench: cand.id, level, cost, lapis: slot + 1 });
    taken.add(cand.id);
  }
  return options;
}

// ---------------------------------------------------------------- effect maths
/** Mining speed multiplier for Wydajność. */
export function efficiencyFactor(lvl: number): number {
  if (lvl <= 0) return 1;
  return 1 + lvl * 0.35 + lvl * lvl * 0.12;
}

/** Unbreaking: how likely one use is to actually cost durability. */
export function wearChance(lvl: number): number {
  if (lvl <= 0) return 1;
  return 1 / (lvl + 1);
}

/** Sharpness bonus damage. */
export function sharpnessDamage(lvl: number): number {
  return lvl > 0 ? lvl * 0.5 + 0.5 : 0;
}

/** Power multiplier for bow arrows. */
export function powerFactor(lvl: number): number {
  return 1 + lvl * 0.3;
}

/** Extra physical push on a melee hit. */
export function knockbackFactor(lvl: number): number {
  return 1 + lvl * 0.6;
}

/** Sum of Protection levels across the equipped armor. */
export function totalProtection(equipped: (Stack | null)[]): number {
  let sum = 0;
  for (const s of equipped) sum += enchLevel(s, 'protection');
  return sum;
}

/** Multiplicative fall-damage factor from boots (0.88 per level, min 0.52). */
export function fallDamageFactor(boots: Stack | null | undefined): number {
  const lvl = enchLevel(boots, 'featherfalling');
  if (lvl <= 0) return 1;
  return Math.max(0.52, 1 - lvl * 0.12);
}

/** 3.0: source-specific armor enchantments stack across four pieces, up to 40%.
 * Old Protection retains its existing general reduction; mutually exclusive
 * protection families cannot be combined on a single piece. */
export function sourceProtection(equipped: (Stack | null)[], source: 'fire' | 'projectile'): number {
  const id = source === 'fire' ? 'fireward' : 'arrowguard';
  return Math.min(0.4, equipped.reduce((sum, piece) => sum + Math.min(4, Math.max(0, enchLevel(piece, id))) * 0.08, 0));
}

/** Speed bonus applies only when actually submerged, never to land movement. */
export function swimSpeedFactor(boots: Stack | null | undefined): number {
  return 1 + Math.min(3, Math.max(0, enchLevel(boots, 'tidewalker'))) * 0.15;
}
