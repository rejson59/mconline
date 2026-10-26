/**
 * Wioski (update 1.6) – proceduralne osady w świecie.
 *
 * Układ osady jest w pełni deterministyczny: komórka siatki 224×224 bloki ma
 * (albo i nie) jedno miejsce na wioskę, a wszystko – drogi, domy, zagrody,
 * studnia – wynika z haszy pozycji i ziarna świata. Dzięki temu każdy chunk
 * może wygenerować „swój” wycinek wioski niezależnie od sąsiadów, a gracz
 * wraca do tych samych budynków po każdym wczytaniu zapisu.
 */
import { B, doorPair } from './blocks';
import { CH, CS } from './constants';

/** Odstęp między kandydatami na wioskę. */
export const VILLAGE_CELL = 224;
const MARGIN = 56;

export interface VillageSurface {
  h: number;
  biome: string;
}

export interface VillageContext {
  seed: number;
  flat: boolean;
  sea: number;
  surface: (x: number, z: number) => VillageSurface;
}

export type BuildingKind = 'house' | 'library' | 'smith' | 'farm' | 'well' | 'lamp' | 'hay' | 'plaza';

export interface VillageBuilding {
  kind: BuildingKind;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Strona, w którą patrzą drzwi: 0 = północ (−Z), 1 = wschód (+X), 2 = południe (+Z), 3 = zachód (−X). */
  face: number;
  variant: number;
  /** Local foundation height; each plot follows its own terrain. */
  y?: number;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Village {
  key: string;
  gx: number;
  gz: number;
  x: number;
  z: number;
  /** Poziom studni; pozostałe budynki dopasowują się do terenu. */
  y: number;
  radius: number;
  biome: string;
  desert: boolean;
  buildings: VillageBuilding[];
  /** Ubite ścieżki i plac (prostokąty włącznie). */
  yards: Rect[];
}

function hash(x: number, y: number, z: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 144665) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// 2.19: wioski stają tam, gdzie w Minecraftcie – na otwartych równinach,
// sawannie, pustyni i tundrze. W środku gęstego lasu wyglądałyby jak
// wycięty plac, a nie osada.
const OK_BIOMES = new Set(['Równiny', 'Sawanna', 'Pustynia', 'Tundra']);

// Memoizacja: ten sam świat pyta o te same komórki bardzo często (generator,
// minimapa, spawn mobów).
// Context-keyed: flat and natural worlds with the same seed must not share plots.
const cache = new WeakMap<VillageContext, Map<string, Village | null>>();
function cached(ctx: VillageContext, key: string, make: () => Village | null): Village | null {
  let entries = cache.get(ctx);
  if (!entries) { entries = new Map(); cache.set(ctx, entries); }
  if (entries.has(key)) return entries.get(key)!;
  if (entries.size > 512) entries.clear();
  const v = make();
  entries.set(key, v);
  return v;
}

// ------------------------------------------------------------------ układ

function pushRect(out: Rect[], x0: number, z0: number, x1: number, z1: number) {
  out.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
}

function overlaps(a: Rect, b: Rect, pad = 1): boolean {
  return a.x0 - pad <= b.x1 && a.x1 + pad >= b.x0 && a.z0 - pad <= b.z1 && a.z1 + pad >= b.z0;
}

/** Prostokąt zajęty przez budynek razem z okapem dachu. */
function footprint(b: VillageBuilding): Rect {
  return { x0: b.x - 1, z0: b.z - 1, x1: b.x + b.w, z1: b.z + b.d };
}

function inside(v: { x: number; z: number; radius: number }, r: Rect): boolean {
  return Math.abs((r.x0 + r.x1) / 2 - v.x) <= v.radius - 3 && Math.abs((r.z0 + r.z1) / 2 - v.z) <= v.radius - 3;
}

function layout(gx: number, gz: number, x: number, z: number, radius: number, ctx: VillageContext, desert: boolean): Village {
  const rnd = (n: number) => hash(x, n, z, ctx.seed ^ 0x5f3a);
  const buildings: VillageBuilding[] = [];
  const yards: Rect[] = [];

  // Drogi na krzyż + plac wokół studni.
  pushRect(yards, x - radius + 2, z - 1, x + radius - 2, z + 1);
  pushRect(yards, x - 1, z - radius + 2, x + 1, z + radius - 2);
  pushRect(yards, x - 3, z - 3, x + 3, z + 3);

  // Studnia w środku – serce osady.
  buildings.push({ kind: 'well', x: x - 3, z: z - 3, w: 7, d: 7, face: 0, variant: 0 });

  // Place pod budynki: cztery narożniki placu plus parcele wzdłuż dróg.
  const lots: [number, number][] = [
    [5, 5], [-14, 5], [5, -14], [-14, -14],
    [-14, -8], [10, -8], [-8, -14], [-8, 10],
    [12, 5], [-21, -14], [12, -14], [-21, 5],
  ];
  let houses = 0;
  let farms = 0;
  let smiths = 0;
  let libraries = 0;

  for (let i = 0; i < lots.length; i++) {
    const roll = rnd(40 + i * 7);
    if (roll < 0.24) continue; // pusta parcela – czasem tylko siano albo latarnia
    const [ox, oz] = lots[i];
    let kind: BuildingKind;
    if (roll < 0.58) kind = 'house';
    else if (roll < 0.72) kind = 'farm';
    else if (roll < 0.79 && smiths < 1) kind = 'smith';
    else if (roll < 0.86 && libraries < 1) kind = 'library';
    else if (roll < 0.93) kind = 'hay';
    else kind = houses > 2 && farms > 0 ? 'lamp' : 'house';

    const wide = kind === 'farm' || kind === 'smith' || kind === 'library';
    const w = wide ? 9 : 7;
    const d = kind === 'house' && rnd(41 + i * 7) < 0.4 ? 9 : 7;
    const bx = kind === 'lamp' || kind === 'hay' ? x + ox + 2 : x + ox;
    const bz = kind === 'lamp' || kind === 'hay' ? z + oz + 2 : z + oz;
    const face = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 3 : 1) : oz > 0 ? 0 : 2;
    const b: VillageBuilding = { kind, x: bx, z: bz, w: kind === 'lamp' || kind === 'hay' ? 2 : w, d: kind === 'lamp' || kind === 'hay' ? 2 : d, face, variant: Math.floor(rnd(60 + i) * 4) };
    const fp = footprint(b);
    if (!inside({ x, z, radius }, fp)) continue;
    if (yards.some((r) => overlaps(fp, r, 0))) continue;
    if (buildings.some((o) => overlaps(fp, footprint(o), 0))) continue;
    buildings.push(b);
    if (kind === 'house') houses++;
    if (kind === 'farm') farms++;
    if (kind === 'smith') smiths++;
    if (kind === 'library') libraries++;
    // Ścieżka od drzwi do najbliższej drogi.
    const door = doorCell(b);
    const dx = Math.abs(ox) > Math.abs(oz);
    if (dx) pushRect(yards, Math.min(door.x, x), b.z + Math.floor(d / 2), Math.max(door.x, x), b.z + Math.floor(d / 2));
    else pushRect(yards, b.x + Math.floor(w / 2), Math.min(door.z, z), b.x + Math.floor(w / 2), Math.max(door.z, z));
  }

  // Latarnie wzdłuż głównych dróg.
  for (let i = 0; i < 6; i++) {
    const lamp = { kind: 'lamp' as BuildingKind, x: 0, z: 0, w: 1, d: 1, face: 0, variant: 0 };
    const step = Math.floor(radius * 0.55);
    const spots: [number, number][] = [
      [x + step, z + 2], [x - step, z + 2], [x + step, z - 2], [x - step, z - 2],
      [x + 2, z + step], [x - 2, z + step], [x + 2, z - step], [x - 2, z - step],
    ];
    const [sx, sz] = spots[i % spots.length];
    lamp.x = sx;
    lamp.z = sz;
    if (buildings.some((o) => overlaps(footprint(lamp), footprint(o), 0))) continue;
    if (yards.some((r) => overlaps({ x0: sx, z0: sz, x1: sx, z1: sz }, r, 0))) continue;
    if (!inside({ x, z, radius }, { x0: sx, z0: sz, x1: sx, z1: sz })) continue;
    buildings.push(lamp);
  }

  // Dzwon na placu (raz na wioskę) – ozdoba i punkt orientacyjny.
  if (rnd(12) < 0.75) {
    const bx = x + (rnd(13) < 0.5 ? -5 : 5);
    const bz = z + (rnd(14) < 0.5 ? -5 : 5);
    if (!buildings.some((o) => overlaps({ x0: bx, z0: bz, x1: bx, z1: bz }, footprint(o), 0))) {
      buildings.push({ kind: 'plaza', x: bx, z: bz, w: 1, d: 1, face: 0, variant: 0 });
    }
  }

  const key = `${ctx.seed}:${gx},${gz}`;
  return { key, gx, gz, x, z, y: 0, radius, biome: '', desert, buildings, yards };
}

/** Komórka z drzwiami danego budynku. */
export function doorCell(b: VillageBuilding): { x: number; z: number } {
  if (b.face === 0) return { x: b.x + Math.floor(b.w / 2), z: b.z };
  if (b.face === 2) return { x: b.x + Math.floor(b.w / 2), z: b.z + b.d - 1 };
  if (b.face === 1) return { x: b.x + b.w - 1, z: b.z + Math.floor(b.d / 2) };
  return { x: b.x, z: b.z + Math.floor(b.d / 2) };
}

// ------------------------------------------------------------- generator

/** Wioska w danej komórce siatki albo null, gdy teren na nią nie pozwala. */
export function villageInCell(gx: number, gz: number, ctx: VillageContext): Village | null {
  const key = `${ctx.seed}:${gx},${gz}`;
  return cached(ctx, key, () => {
    const chance = hash(gx, 11, gz, ctx.seed);
    if (chance > 0.62) return null;
    const x = Math.round(gx * VILLAGE_CELL + MARGIN + hash(gx, 12, gz, ctx.seed) * (VILLAGE_CELL - 2 * MARGIN));
    const z = Math.round(gz * VILLAGE_CELL + MARGIN + hash(gx, 13, gz, ctx.seed) * (VILLAGE_CELL - 2 * MARGIN));
    const info = ctx.surface(x, z);
    let y = info.h;
    if (!ctx.flat) {
      if (!OK_BIOMES.has(info.biome)) return null;
      if (info.h <= ctx.sea + 2 || info.h > 98) return null;
      // 2.19: osada staje tylko na w miarę równym terenie – próbki z całego
      // placu (nie tylko okręgu), żeby nie wybrać zbocza ani urwiska.
      let min = 1e9;
      let max = -1e9;
      let sum = 0;
      let n = 0;
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const s = ctx.surface(x + dx * 9, z + dz * 9).h;
          min = Math.min(min, s);
          max = Math.max(max, s);
          sum += s;
          n++;
        }
      if (max - min > 9) return null;
      y = Math.round(sum / n);
      if (y <= ctx.sea + 2 || y > 96) return null;
    }
    const radius = 20 + Math.floor(hash(gx, 15, gz, ctx.seed) * 8);
    const desert = info.biome === 'Pustynia';
    const v = layout(gx, gz, x, z, radius, ctx, desert);
    v.y = y;
    v.biome = info.biome;
    for (const b of v.buildings) {
      const door = doorCell(b);
      b.y = b.kind === 'well' ? y : ctx.surface(door.x, door.z).h;
    }
    return v;
  });
}

/** Wioski, których obszar obejmuje podany prostokąt (włącznie z marginesem). */
export function villagesOverlapping(x0: number, z0: number, x1: number, z1: number, ctx: VillageContext): Village[] {
  const out: Village[] = [];
  const gx0 = Math.floor((x0 - 48) / VILLAGE_CELL);
  const gx1 = Math.floor((x1 + 48) / VILLAGE_CELL);
  const gz0 = Math.floor((z0 - 48) / VILLAGE_CELL);
  const gz1 = Math.floor((z1 + 48) / VILLAGE_CELL);
  for (let gz = gz0; gz <= gz1; gz++)
    for (let gx = gx0; gx <= gx1; gx++) {
      const v = villageInCell(gx, gz, ctx);
      if (!v) continue;
      if (v.x + v.radius + 4 < x0 || v.x - v.radius - 4 > x1) continue;
      if (v.z + v.radius + 4 < z0 || v.z - v.radius - 4 > z1) continue;
      out.push(v);
    }
  return out;
}

/** Wioska, na terenie której stoi dany punkt (promień zabudowy + 3). */
export function villageAt(x: number, z: number, ctx: VillageContext): Village | null {
  for (const v of villagesOverlapping(x, z, x, z, ctx)) {
    if (Math.hypot(x - v.x, z - v.z) <= v.radius + 3) return v;
  }
  return null;
}

/** Najbliższa wioska w promieniu `cells` komórek siatki (dla /village i spawnu). */
export function nearestVillage(x: number, z: number, ctx: VillageContext, cells = 3): { village: Village; dist: number } | null {
  const gx = Math.floor(x / VILLAGE_CELL);
  const gz = Math.floor(z / VILLAGE_CELL);
  let best: Village | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= cells; r++) {
    // Najbliższy możliwy środek w pierścieniu r jest oddalony o (r-1) komórek,
    // więc gdy gorzej już być nie może – kończymy.
    if (best && (r - 1) * VILLAGE_CELL > bestD) break;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const v = villageInCell(gx + dx, gz + dz, ctx);
        if (!v) continue;
        const d = Math.hypot(v.x - x, v.z - z);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
  }
  return best ? { village: best, dist: bestD } : null;
}

/** Czy punkt leży na ścieżce lub placu wioski. */
export function onYard(v: Village, x: number, z: number): boolean {
  for (const r of v.yards) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  return false;
}

function groundBlock(v: Village, x: number, z: number): number {
  if (onYard(v, x, z)) return v.desert ? B.SANDSTONE : B.PATH;
  return v.desert ? B.SAND : B.GRASS;
}

/** Miejsca, w których mogą pojawiać się mieszkańcy (drogi i plac). */
export function villageSpawnSpots(v: Village, ctx?: VillageContext): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const steps = [6, 11, 16];
  for (const s of steps) {
    out.push({ x: v.x + s, y: v.y + 1, z: v.z + 2 });
    out.push({ x: v.x - s, y: v.y + 1, z: v.z - 2 });
    out.push({ x: v.x + 2, y: v.y + 1, z: v.z + s });
    out.push({ x: v.x - 2, y: v.y + 1, z: v.z - s });
  }
  out.push({ x: v.x + 4, y: v.y + 1, z: v.z + 4 });
  out.push({ x: v.x - 4, y: v.y + 1, z: v.z - 4 });
  if (ctx) for (const spot of out) spot.y = villageGroundAt(v, spot.x, spot.z, ctx) + 1;
  return out;
}

// -------------------------------------------------------------- zapis do chunka

export interface VillageApplyResult {
  /** 1 = kolumna należy do wioski (dekoracje i drzewa mają ją pominąć). */
  mask: Uint8Array;
  /** Poziom gruntu wioski w każdej zajętej kolumnie (0 = brak wioski). */
  ground: Uint8Array;
  /** Najwyższy blok wioski w tym chunku. */
  top: number;
}

type SetBlock = (x: number, y: number, z: number, id: number) => void;

/** Rodzaj dachu zależny od biomu i funkcji budynku. */
interface RoofStyle {
  deck: number; // pełne bloki połaci
  stair: number; // ID schodów w kierunku północnym (baza)
  ridge: number; // najwyższy blok kalenicy
}

function roofStyleFor(v: Village, style: 'planks' | 'library' | 'smith'): RoofStyle {
  if (v.desert) return { deck: B.SANDSTONE, stair: B.SANDSTONE_STAIRS_N, ridge: B.SANDSTONE_SLAB };
  if (style === 'smith') return { deck: B.COBBLE, stair: B.COBBLE_STAIRS_N, ridge: B.STONE_SLAB };
  if (style === 'library') return { deck: B.PLANKS, stair: B.OAK_STAIRS_N, ridge: B.OAK_SLAB };
  return { deck: B.PLANKS, stair: B.OAK_STAIRS_N, ridge: B.OAK_SLAB };
}

/**
 * Dwuspadowy dach z okapem.
 *
 * 2.20: wcześniej był to płaski „naleśnik” z desek nad ścianami – domy
 * wyglądały jak betonowe bunkry. Teraz kalenica biegnie wzdłuż dłuższej
 * ściany, a połać schodzi stopniami ze schodów (jak w Minecrafcie).
 */
function gableRoof(b: VillageBuilding, set: SetBlock, baseY: number, st: RoofStyle) {
  const alongX = b.w >= b.d;
  const span = alongX ? b.d : b.w;
  const length = alongX ? b.w : b.d;
  const center = (span - 1) / 2;
  for (let a = -1; a <= length; a++) {
    for (let c = -1; c <= span; c++) {
      const rise = Math.min(c + 1, span - c);
      const x = b.x + (alongX ? a : c);
      const z = b.z + (alongX ? c : a);
      const facing = alongX ? (c < center ? 2 : 0) : (c < center ? 1 : 3);
      // Hollow 45-degree roof, closed timber gables, slab ridge and one-block eaves.
      if (a === 0 || a === length - 1) {
        for (let h = 0; h < rise; h++) set(x, baseY + h, z, st.deck);
      }
      set(x, baseY + rise, z, c === center ? st.ridge : st.stair + facing);
    }
  }
}

function house(v: Village, b: VillageBuilding, set: SetBlock, style: 'planks' | 'library' | 'smith') {
  const floor = b.y ?? v.y;
  const wall = v.desert ? B.SANDSTONE : B.PLANKS;
  const corner = v.desert ? B.SANDSTONE : v.biome === 'Sawanna' ? B.ACACIA_LOG : B.LOG;
  const plinth = v.desert ? B.SANDSTONE : B.COBBLE;
  const h = 3;
  const door = doorCell(b);
  const st = roofStyleFor(v, style);
  for (let x = 0; x < b.w; x++)
    for (let z = 0; z < b.d; z++) {
      const edge = x === 0 || z === 0 || x === b.w - 1 || z === b.d - 1;
      // Podmurówka z bruku wokół domu (w środku – podłoga z desek).
      set(b.x + x, floor, b.z + z, edge ? plinth : v.desert ? B.SANDSTONE : B.PLANKS);
      if (!edge) continue;
      const isCorner = (x === 0 || x === b.w - 1) && (z === 0 || z === b.d - 1);
      const isDoor = b.x + x === door.x && b.z + z === door.z;
      // Ościeżnica: słupki z bali po bokach drzwi.
      const besideDoor =
        (b.face === 0 || b.face === 2 ? Math.abs(b.x + x - door.x) : Math.abs(b.z + z - door.z)) === 1 &&
        (b.face === 0 ? z === 0 : b.face === 2 ? z === b.d - 1 : b.face === 1 ? x === b.w - 1 : x === 0);
      for (let y = floor + 1; y <= floor + h; y++) {
        set(b.x + x, y, b.z + z, isCorner || besideDoor ? corner : wall);
      }
      if (isDoor) {
        set(door.x, floor + 1, door.z, doorPair(b.face, false, false));
        set(door.x, floor + 2, door.z, doorPair(b.face, false, true));
      } else if (wallMid(b, x, z) && style !== 'smith') {
        set(b.x + x, floor + 2, b.z + z, B.GLASS); // okno
      }
      if (style === 'library' && !isCorner && !besideDoor && (x === 0 || x === b.w - 1 || z === 0 || z === b.d - 1)) {
        if (!isDoor && (x + z) % 3 !== 0) set(b.x + x, floor + 1, b.z + z, B.BOOKSHELF);
      }
    }
  // Płaski strop pod dachem – wnętrze ma sufit, a nie widok na krokwie.
  for (let x = 0; x < b.w; x++) for (let z = 0; z < b.d; z++) set(b.x + x, floor + h + 1, b.z + z, st.deck);
  if (v.desert) {
    // Vanilla desert houses have sandstone roof terraces with low parapets.
    for (let x = 0; x < b.w; x++) for (let z = 0; z < b.d; z++) {
      if (x === 0 || z === 0 || x === b.w - 1 || z === b.d - 1) {
        set(b.x + x, floor + h + 2, b.z + z, B.SANDSTONE_SLAB);
      }
    }
  } else {
    gableRoof(b, set, floor + h + 1, st);
  }

  // Wnętrze
  const mx = b.x + Math.floor(b.w / 2);
  const mz = b.z + Math.floor(b.d / 2);
  if (style === 'smith') {
    set(b.x + 1, floor + 1, b.z + 1, B.FURNACE);
    set(b.x + 2, floor + 1, b.z + 1, B.FURNACE_ON);
    for (let h = 2; h <= 8; h++) set(b.x + 2, floor + h, b.z + 1, B.BRICK);
    set(b.x + 2, floor + 9, b.z + 1, B.CAMPFIRE);
    set(b.x + b.w - 2, floor + 1, b.z + 1, B.LOOT_CHEST);
    set(b.x + 1, floor + 1, b.z + b.d - 2, B.CRAFTING);
    set(b.x + b.w - 2, floor + 1, b.z + b.d - 2, B.ANVIL); // kowadło
  } else {
    // 2.29: łóżko to dwa bloki – w chacie stawiamy stopę przy ścianie i
    // wezgłowie w głąb izby, jak w waniliowej wiosce.
    set(b.x + 1, floor + 1, b.z + 1, B.BED_S);
    set(b.x + 1, floor + 1, b.z + 2, B.BED_HEAD_S);
    set(b.x + b.w - 2, floor + 1, b.z + b.d - 2, B.CHEST);
    if (b.variant % 3 === 0) set(b.x + b.w - 2, floor + 1, b.z + 1, B.FURNACE);
    else if (b.variant % 3 === 1) set(b.x + b.w - 2, floor + 1, b.z + 1, B.CRAFTING);
    else set(b.x + 1, floor + 1, b.z + b.d - 2, B.CRAFTING);
  }
  // Lampka pod sufitem – wcześniej stała w powietrzu pochodnia na wysokości
  // ściany, która wyglądała jak błąd.
  set(mx, floor + h, mz, B.LANTERN);
  // Latarnia przy wejściu: słupek z płotu + latarnia, ukośnie od drzwi, żeby
  // nie zastawiać przejścia.
  const outX = door.x + (b.face === 1 ? 1 : b.face === 3 ? -1 : 0);
  const outZ = door.z + (b.face === 2 ? 1 : b.face === 0 ? -1 : 0);
  const latX = door.x + (b.face === 0 || b.face === 2 ? 1 : 0) + (outX !== door.x ? outX - door.x : 0);
  const latZ = door.z + (b.face === 1 || b.face === 3 ? 1 : 0) + (outZ !== door.z ? outZ - door.z : 0);
  set(latX, floor, latZ, B.COBBLE);
  set(latX, floor + 1, latZ, B.FENCE);
  set(latX, floor + 2, latZ, B.FENCE);
  set(latX, floor + 3, latZ, B.LANTERN);
}

/** Czy ściana w tym miejscu jest w połowie długości (miejsce na okno). */
function wallMid(b: VillageBuilding, x: number, z: number): boolean {
  if (x === 0 || x === b.w - 1) return z === Math.floor((b.d - 1) / 2) || z === Math.floor(b.d / 2);
  return x === Math.floor((b.w - 1) / 2) || x === Math.floor(b.w / 2);
}

function farm(v: Village, b: VillageBuilding, set: SetBlock) {
  const floor = b.y ?? v.y;
  // ogrodzenie z przejściem od strony wioski
  for (let x = 0; x < b.w; x++)
    for (let z = 0; z < b.d; z++) {
      const edge = x === 0 || z === 0 || x === b.w - 1 || z === b.d - 1;
      const gap =
        (b.face === 0 && z === 0 && x >= Math.floor(b.w / 2) - 1 && x <= Math.floor(b.w / 2)) ||
        (b.face === 2 && z === b.d - 1 && x >= Math.floor(b.w / 2) - 1 && x <= Math.floor(b.w / 2)) ||
        (b.face === 1 && x === b.w - 1 && z >= Math.floor(b.d / 2) - 1 && z <= Math.floor(b.d / 2)) ||
        (b.face === 3 && x === 0 && z >= Math.floor(b.d / 2) - 1 && z <= Math.floor(b.d / 2));
      if (edge) {
        if (!gap) set(b.x + x, floor, b.z + z, B.FENCE);
        continue;
      }
      const channel = (x - 1) % 3 === 0;
      if (channel) {
        set(b.x + x, floor, b.z + z, B.WATER);
        set(b.x + x, floor + 1, b.z + z, B.AIR);
        continue;
      }
      set(b.x + x, floor, b.z + z, B.FARMLAND);
      const roll = hash(b.x + x, 5, b.z + z, v.gx * 31 + v.gz);
      set(b.x + x, floor + 1, b.z + z, roll < 0.72 ? B.CROP3 : roll < 0.86 ? B.CROP2 : B.CROP1);
    }
  // siano w narożniku
  set(b.x + 1, floor + 1, b.z + b.d - 2, B.HAY);
  set(b.x + 2, floor + 1, b.z + b.d - 2, B.HAY);
  set(b.x + 1, floor + 2, b.z + b.d - 2, B.HAY);
}

function well(v: Village, b: VillageBuilding, set: SetBlock) {
  const floor = b.y ?? v.y;
  const cx = b.x + 3;
  const cz = b.z + 3;
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      const ring = Math.max(Math.abs(x), Math.abs(z));
      if (ring === 3) {
        set(cx + x, floor, cz + z, B.COBBLE);
        continue;
      }
      if (ring === 2) {
        set(cx + x, floor, cz + z, B.COBBLE);
        set(cx + x, floor + 1, cz + z, B.COBBLE);
        set(cx + x, floor + 2, cz + z, B.COBBLE);
        continue;
      }
      set(cx + x, floor - 1, cz + z, B.WATER);
      set(cx + x, floor, cz + z, B.WATER);
      set(cx + x, floor + 1, cz + z, B.AIR);
      set(cx + x, floor + 2, cz + z, B.AIR);
    }
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as [number, number][]) {
    set(cx + dx, floor + 1, cz + dz, B.FENCE);
    set(cx + dx, floor + 2, cz + dz, B.FENCE);
    set(cx + dx, floor + 3, cz + dz, B.FENCE);
  }
  // 2.20: daszek studni – cztery coraz mniejsze warstwy desek (piramida),
  // a nie jedna płaska płyta wisząca na słupkach.
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      const ring = Math.max(Math.abs(x), Math.abs(z));
      if (ring === 3) set(cx + x, floor + 4, cz + z, B.PLANKS);
      if (ring <= 2) set(cx + x, floor + 5, cz + z, B.PLANKS);
      if (ring <= 1) set(cx + x, floor + 6, cz + z, B.OAK_SLAB);
    }
  set(cx, floor + 6, cz, B.OAK_SLAB);
  set(cx, floor + 4, cz, B.LANTERN);
}

function hayPile(v: Village, b: VillageBuilding, set: SetBlock) {
  const floor = b.y ?? v.y;
  set(b.x, floor + 1, b.z, B.HAY);
  set(b.x + 1, floor + 1, b.z, B.HAY);
  set(b.x, floor + 1, b.z + 1, B.HAY);
  set(b.x + 1, floor + 1, b.z + 1, B.HAY);
  set(b.x, floor + 2, b.z, B.HAY);
  set(b.x + 1, floor + 2, b.z + 1, B.HAY);
}

function lamp(v: Village, b: VillageBuilding, set: SetBlock) {
  const floor = b.y ?? v.y;
  set(b.x, floor, b.z, B.COBBLE);
  set(b.x, floor + 1, b.z, B.FENCE);
  set(b.x, floor + 2, b.z, B.FENCE);
  set(b.x, floor + 3, b.z, B.LANTERN);
}

function plazaWithBell(v: Village, b: VillageBuilding, set: SetBlock) {
  const floor = b.y ?? v.y;
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      set(b.x + x, floor, b.z + z, B.COBBLE);
      if (x === 0 && z === 0) continue;
      if (Math.abs(x) === 2 && Math.abs(z) === 2) {
        set(b.x + x, floor + 1, b.z + z, B.FENCE);
        set(b.x + x, floor + 2, b.z + z, B.FENCE);
        set(b.x + x, floor + 3, b.z + z, B.PLANKS);
      }
    }
  set(b.x, floor + 1, b.z, B.BELL);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.max(Math.abs(x), Math.abs(z)) === 2) set(b.x + x, floor + 4, b.z + z, B.PLANKS);
  set(b.x, floor + 5, b.z, B.PLANKS);
}

function writeBuilding(v: Village, b: VillageBuilding, set: SetBlock) {
  switch (b.kind) {
    case 'house':
      house(v, b, set, 'planks');
      break;
    case 'library':
      house(v, b, set, 'library');
      break;
    case 'smith':
      house(v, b, set, 'smith');
      break;
    case 'farm':
      farm(v, b, set);
      break;
    case 'well':
      well(v, b, set);
      break;
    case 'hay':
      hayPile(v, b, set);
      break;
    case 'lamp':
      lamp(v, b, set);
      break;
    case 'plaza':
      plazaWithBell(v, b, set);
      break;
  }
}

/**
 * Wypisuje wycinek wsi należący do chunka (cx, cz).
 * `data` to surowa tablica chunka: (y * CS + z) * CS + x.
 */
/** Local grading only: no circular plateau, no random one-block bumps. */
export function villageGroundAt(v: Village, x: number, z: number, ctx: VillageContext): number {
  const natural = ctx.surface(x, z).h;
  let target = natural;
  let strongest = 0;
  for (const b of v.buildings) {
    const pad = b.kind === 'plaza' ? 2 : 0;
    const dx = Math.max(b.x - pad - x, 0, x - (b.x + b.w - 1 + pad));
    const dz = Math.max(b.z - pad - z, 0, z - (b.z + b.d - 1 + pad));
    const distance = Math.max(dx, dz);
    const influence = Math.max(0, 1 - distance / 4);
    if (influence > strongest) {
      strongest = influence;
      const smooth = influence * influence * (3 - 2 * influence);
      target = Math.round(natural + ((b.y ?? v.y) - natural) * smooth);
    }
  }
  return target;
}

export function applyVillages(data: Uint16Array | Uint8Array, ccx: number, ccz: number, ctx: VillageContext): VillageApplyResult {
  const mask = new Uint8Array(CS * CS);
  const ground = new Uint8Array(CS * CS);
  let top = 0;
  const ox = ccx * CS, oz = ccz * CS;
  const villages = villagesOverlapping(ox, oz, ox + CS - 1, oz + CS - 1, ctx);
  const put = (x: number, y: number, z: number, id: number) => {
    const lx = x - ox, lz = z - oz;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= CH) return;
    data[(y * CS + lz) * CS + lx] = id;
    mask[lz * CS + lx] = 1;
    if (y > top) top = y;
  };
  for (const v of villages) {
    for (let z = oz; z < oz + CS; z++) for (let x = ox; x < ox + CS; x++) {
      const natural = ctx.surface(x, z).h;
      const target = villageGroundAt(v, x, z, ctx);
      const plot = v.buildings.find((b) => x >= b.x - 1 && x <= b.x + b.w && z >= b.z - 1 && z <= b.z + b.d);
      const yard = onYard(v, x, z);
      if (!plot && !yard && target === natural) continue;
      // Solid local foundations, including the old surface layer (no buried grass).
      for (let y = Math.max(1, Math.min(natural, target) - 2); y < target; y++) {
        put(x, y, z, v.desert ? B.SANDSTONE : B.DIRT);
      }
      put(x, target, z, groundBlock(v, x, z));
      for (let y = target + 1; y <= Math.max(natural, target + (plot ? 12 : 2)); y++) put(x, y, z, B.AIR);
      ground[(z - oz) * CS + x - ox] = target;
    }
    // All terrain first, all buildings second; independent of chunk generation order.
    for (const b of v.buildings) writeBuilding(v, b, put);
  }
  return { mask, ground, top };
}
