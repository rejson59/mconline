/**
 * BlockCraft 2.28 – „mods wbudowane”: wydajność renderowania i symulacji.
 *
 * Wszystkie reguły, które da się policzyć bez GPU, siedzą w tym module
 * (czyste funkcje + mały automat), żeby testy headless sprawdzały je
 * dokładnie tak, jak działają w grze. Silnik (engine.ts) tylko je woła.
 *
 * Odpowiedniki modów do Minecrafta:
 *  • `chunkBuildScore` / `sortChunkOffsets` – Sodium: budowa chunków
 *    w kolejności „najpierw to, co widać” (bliżej i na wprost kamery),
 *    zamiast po samym promieniu.
 *  • `entityTickInterval` / `shouldTickEntity` – Entity Culling: moby
 *    daleko od gracza aktualizują AI i fizykę rzadziej, więc setki modeli
 *    nie zjadają klatki.
 *  • `lodRing` – Distant Horizons: tanie pasmo terenu w oddali.
 *  • `FrameGovernor` – automatyczna regulacja jakości (jak presety
 *    w Sodium/ImmediatelyFast): mierzy czas klatki i dobiera budżet.
 */

/** Minimalny czas klatki w ms dla danego FPS (0 = bez limitu). */
export function frameBudgetMs(fps: number): number {
  return fps > 0 ? 1000 / fps : 0;
}

/**
 * Wygładzony czas klatki (EMA). `alpha` 0,1 = reaguje w ~10 klatek, więc
 * pojedynczy „zacięty” frame nie zmienia od razu ustawień.
 */
export function smoothFrameMs(prev: number, sample: number, alpha = 0.1): number {
  if (!Number.isFinite(sample) || sample <= 0) return prev;
  if (prev <= 0) return sample;
  return prev + (sample - prev) * alpha;
}

/**
 * Ocena chunka przy budowie siatki (Sodium-like).
 *
 * Im mniejsza wartość, tym szybciej chunk trafia do kolejki. Liczy się
 * odległość od gracza oraz to, czy chunk jest przed kamerą: te z tyłu
 * dostają karę (i tak zaraz znikną z widoku), a te na wprost – premię.
 * `fx`/`fz` to znormalizowany kierunek patrzenia (bez składowej Y).
 */
export function chunkBuildScore(dx: number, dz: number, fx: number, fz: number): number {
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-3) return 0;
  // Rzut na kierunek patrzenia: 1 = dokładnie przed graczem, −1 = za plecami.
  const facing = (dx / dist) * fx + (dz / dist) * fz;
  const penalty = (1 - facing) * 0.9; // do 1,8 „bloku” kary za tył
  return dist + penalty;
}

/**
 * Kolejność budowy chunków: najpierw blisko i na wprost kamery.
 * Zwraca nową tablicę (nie modyfikuje wejścia – silnik trzyma `offsets`
 * jako źródło prawdy).
 */
export function sortChunkOffsets(
  offsets: readonly (readonly [number, number])[],
  fx: number,
  fz: number
): [number, number][] {
  return offsets
    .map(([dx, dz]) => [dx, dz, chunkBuildScore(dx, dz, fx, fz)] as [number, number, number])
    .sort((a, b) => a[2] - b[2])
    .map(([dx, dz]) => [dx, dz] as [number, number]);
}

/**
 * Co ile klatek aktualizować moba (Entity Culling).
 *
 * Blisko gracza (do 32 bloków) – każda klatka, bo tam widać każdy ruch.
 * Dalej (32–64) – co drugą, jeszcze dalej (64–96) – co trzecią, a poza
 * 96 blokami – co szóstą. Gdy mob jest w ogóle poza zasięgiem wzroku,
 * wystarczy mu rzadszy tick – i tak nikt tego nie zobaczy.
 */
export function entityTickInterval(distance: number): number {
  if (distance <= 32) return 1;
  if (distance <= 64) return 2;
  if (distance <= 96) return 3;
  return 6;
}

/** Czy w tej klatce wypada tick moba? `frame` rośnie o 1 co klatkę. */
export function shouldTickEntity(frame: number, distance: number): boolean {
  const interval = entityTickInterval(distance);
  return interval <= 1 || frame % interval === 0;
}

/** Poziom szczegółowości terenu w oddali: im dalej, tym grubsza siatka. */
export function lodStepFor(distance: number): number {
  if (distance <= 160) return 4;
  if (distance <= 320) return 8;
  return 16;
}

/** Zasięg pasma LOD w blokach (Distant Horizons renderuje „za horyzontem”). */
export function lodRange(renderDistance: number, chunkSize: number): number {
  return Math.max(chunkSize * (renderDistance + 2), chunkSize * renderDistance * 4);
}

/**
 * Automat jakości – odpowiednik presetów z modów wydajnościowych.
 *
 * Dostaje czas klatki i zwraca mnożniki, których silnik używa do:
 *  • budżetu budowy chunków (`chunkScale`),
 *  • częstotliwości ticków mobów (`entityScale`),
 *  • zasięgu pasma LOD (`lodScale`).
 *
 * Reguła jest celowo ospała: schodzimy w dół dopiero po ~1,5 s słabych
 * klatek, a wracamy po ~3 s dobrych, żeby obraz nie „pływał”.
 */
export interface PerfProfile {
  /** 0,4 = oszczędnie, 1 = pełna jakość. Skaluje budżet budowy chunków. */
  chunkScale: number;
  /** 1 = normalnie, 3 = moby tickują trzy razy rzadziej. */
  entityScale: number;
  /** 0,45 = krótsze pasmo LOD, 1 = pełne. */
  lodScale: number;
  /**
   * 2.32: ile z ZASIĘGU renderowania faktycznie rysujemy (1 = wszystko).
   *
   * To najskuteczniejsza dźwignia na słabym GPU: mniejszy zasięg to mniej
   * siatek do przesłania wierzchołkami i mniej pikseli do wypełnienia.
   * Chunki zostają w pamięci (nie ma ponownego generowania), tylko znikają
   * z rysowania – dokładnie tak, jak suwak „Render Distance” w grze.
   */
  drawScale: number;
  /** 2.32: górny limit skali rozdzielczości (1 = tyle, ile w ustawieniach). */
  resScale: number;
  /** 2.32: mnożnik cząsteczek i deszczu (1 = pełne). */
  particleScale: number;
  /** Etykieta do HUD/dziennika. */
  label: 'minimalny' | 'oszczędny' | 'zrównoważony' | 'pełny';
}

export type PerfTier = 'full' | 'balanced' | 'eco' | 'minimal';

export const PERF_PROFILES: Record<PerfTier, PerfProfile> = {
  full: { chunkScale: 1, entityScale: 1, lodScale: 1, drawScale: 1, resScale: 1, particleScale: 1, label: 'pełny' },
  balanced: { chunkScale: 0.8, entityScale: 1.5, lodScale: 0.85, drawScale: 0.9, resScale: 1, particleScale: 0.75, label: 'zrównoważony' },
  eco: { chunkScale: 0.55, entityScale: 2, lodScale: 0.6, drawScale: 0.75, resScale: 0.9, particleScale: 0.5, label: 'oszczędny' },
  minimal: { chunkScale: 0.4, entityScale: 3, lodScale: 0.45, drawScale: 0.6, resScale: 0.8, particleScale: 0.25, label: 'minimalny' },
};

/** Kolejność stopni – od najlepszego do najbardziej oszczędnego. */
export const PERF_ORDER: PerfTier[] = ['full', 'balanced', 'eco', 'minimal'];

/**
 * 2.32: ile chunków w każdą stronę naprawdę rysować.
 *
 * Dla bazowego zasięgu 6 i profilu oszczędnego wychodzi 4 – czyli 81 chunków
 * zamiast 169, ponad dwa razy mniej pracy dla karty graficznej. Nigdy nie
 * schodzimy poniżej 2 (widok 5×5), bo świat robi się wtedy zbyt ciasny.
 */
export function drawDistanceChunks(base: number, profile: PerfProfile): number {
  return Math.max(2, Math.min(base, Math.round(base * profile.drawScale)));
}

/**
 * 2.32: skala rozdzielczości z limitu profilu.
 *
 * `resScale` z profilu jest górnym limitem dla dynamicznej rozdzielczości –
 * w trybie minimalnym gra nie renderuje więcej niż 80% pikseli, nawet gdy
 * klatki są szybkie (na „ziemniaku” i tak by się to nie utrzymało).
 */
export function profileResScale(userScale: number, profile: PerfProfile): number {
  return Math.max(0.4, Math.min(1, userScale * profile.resScale));
}

export class FrameGovernor {
  /** Wygładzony czas klatki w ms. */
  frameMs = 0;
  /** Bieżący profil. */
  profile: PerfProfile = PERF_PROFILES.full;
  /** 0 = pełny, 3 = minimalny. Łatwiej porównywać niż obiekty profilu. */
  tier: PerfTier = 'full';
  private badFor = 0;
  private goodFor = 0;

  constructor(private readonly targetMs = 1000 / 60) {}

  update(sampleMs: number, dt: number): PerfProfile {
    this.frameMs = smoothFrameMs(this.frameMs, sampleMs, 0.08);
    // Klatka „zła” to wyraźnie więcej niż 60 FPS (albo 30 na telefonie,
    // gdzie i tak nie ma sensu walczyć o więcej). 2.32: przy włączonym
    // limicie klatek próg liczymy od limitu – 33 ms przy capie 30 FPS to
    // sukces, a nie powód do zjeżdżania z jakości.
    const bad = this.frameMs > Math.max(this.targetMs * 1.5, 20, this.capMs * 1.25);
    // 2.32: próg „dobra” bierzemy też z limitu klatek – przy 30 FPS cap
    // klatka 33 ms jest idealna, a nie „za wolna”, jak przy limicie 60.
    const goodMs = Math.max(this.targetMs * 1.08, 15, this.capMs * 0.95);
    const good = this.frameMs < goodMs;
    this.badFor = bad ? this.badFor + dt : 0;
    this.goodFor = good ? this.goodFor + dt : 0;

    if (this.badFor > 1.5) {
      this.badFor = 0;
      this.step(1, 0);
      this.goodFor = 0;
    } else if (this.goodFor > 3) {
      this.goodFor = 0;
      this.step(-1, 0);
      this.badFor = 0;
    }
    return this.profile;
  }

  /**
   * 2.32: ręczne dobranie stopnia (suwak „Jakość”) i limit klatek.
   *
   * `capMs` to czas klatki, do którego automat dąży – przy limicie 30 FPS
   * nie ma sensu zjeżdżać z jakości, bo klatka 33 ms to sukces, nie porażka.
   */
  capMs = 0;
  setFpsCap(fps: number) {
    this.capMs = fps > 0 ? 1000 / fps : 0;
  }

  private step(delta: number, from: number) {
    const idx = Math.max(0, Math.min(PERF_ORDER.length - 1, PERF_ORDER.indexOf(this.tier) + delta + from));
    const tier = PERF_ORDER[idx];
    this.tier = tier;
    this.profile = PERF_PROFILES[tier];
  }

  reset() {
    this.frameMs = 0;
    this.badFor = 0;
    this.goodFor = 0;
    this.tier = 'full';
    this.profile = PERF_PROFILES.full;
  }
}
