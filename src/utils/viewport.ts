/**
 * 2.15: jeden wspólny pomiar **widocznego** ekranu.
 *
 * Po wejściu w pełny ekran (zwłaszcza gdy przeglądarka dodatkowo obraca obraz
 * przez `screen.orientation.lock`) jednostki `dvh`/`vh` potrafią przez chwilę
 * – a na niektórych telefonach na stałe – pokazywać wysokość sprzed obrotu.
 * Wtedy `#root` jest dwa razy wyższy niż ekran: dolne przyciski lądują poza
 * widokiem, drążek przestaje reagować, a płótno gry jest przycięte (wygląda
 * jak przybliżona kamera).
 *
 * Dlatego aplikacja trzyma się **pikseli zmierzonych z `visualViewport`**
 * (a gdy go nie ma – z `window`), a nie jednostek viewportu.
 */

type Cleanup = () => void;

export interface ViewportSize {
  width: number;
  height: number;
}

/** Rozmiar faktycznie widocznego obszaru (CSS px). Nigdy nie zwraca 0/NaN. */
export function visibleViewport(): ViewportSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  const vv = window.visualViewport;
  const w = Math.round(vv?.width || window.innerWidth || 0);
  const h = Math.round(vv?.height || window.innerHeight || 0);
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

/**
 * Zapisuje wysokość widocznego ekranu w `--bc-app-height`. CSS używa jej jako
 * zapasu, gdyby `100%`/`dvh` znów skłamały. Zwraca zmierzoną wysokość.
 */
export function applyViewportHeight(): number {
  if (typeof document === 'undefined' || !document.documentElement) return 0;
  const { height } = visibleViewport();
  try {
    document.documentElement.style.setProperty('--bc-app-height', `${height}px`);
  } catch {
    /* starsze przeglądarki – zostaje CSS-owy zapas */
  }
  return height;
}

/**
 * Woła `cb` po każdej zmianie rozmiaru okna, orientacji, pełnego ekranu albo
 * paska adresu. Wywołania są sklejane do jednej klatki, więc w czasie animacji
 * obrotu nie ma setek przeliczeń.
 */
export function onViewportChange(cb: () => void): Cleanup {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  let frame = 0;
  const run = () => {
    frame = 0;
    applyViewportHeight();
    try {
      cb();
    } catch {
      /* pojedynczy odbiorca nie może zepsuć pomiaru innym */
    }
  };
  const schedule = () => {
    if (frame) return;
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(run);
    else frame = window.setTimeout(run, 16) as unknown as number;
  };
  const events: [EventTarget, string][] = [
    [window, 'resize'],
    [window, 'orientationchange'],
    [window, 'pageshow'],
  ];
  const vv = window.visualViewport;
  if (vv) {
    events.push([vv, 'resize'], [vv, 'scroll']);
  }
  if (typeof document !== 'undefined') {
    events.push([document, 'fullscreenchange'], [document, 'webkitfullscreenchange']);
  }
  for (const [target, type] of events) target.addEventListener(type, schedule);
  run();
  return () => {
    for (const [target, type] of events) target.removeEventListener(type, schedule);
    if (frame) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      else clearTimeout(frame);
    }
  };
}

/**
 * Po wejściu/wyjściu z pełnego ekranu przeglądarki potrzebują od kilkudziesięciu
 * do kilkuset milisekund na ustalenie nowego viewportu (animacja, obrót).
 * Wysyłamy wtedy kilka „sztucznych” zdarzeń `resize`, żeby każdy komponent,
 * który mierzy się klasycznie, dostał szansę na poprawkę.
 */
export function pokeLayout(): Cleanup {
  if (typeof window === 'undefined') return () => {};
  applyViewportHeight();
  const poke = () => {
    applyViewportHeight();
    try {
      window.dispatchEvent(new Event('resize'));
    } catch {
      /* brak konstruktora Event – trudno */
    }
  };
  poke();
  const timers = [60, 180, 420, 900].map((ms) => window.setTimeout(poke, ms));
  return () => {
    for (const t of timers) clearTimeout(t);
  };
}
