import type { Settings } from './settings';

/**
 * BlockCraft 2.5 „Wielka naprawa” – wyraźny podział wersji komputerowej i
 * dotykowej. Wcześniej wystarczył ekran dotykowy (choćby w laptopie z
 * Windows), aby gra wymusiła sterowanie mobilne: Pointer Lock nie startował,
 * więc mysz i klawiatura były martwe – na takich laptopach nie dało się
 * praktycznie grać. Teraz wersję wybiera **główny wskaźnik** urządzenia
 * („pointer: coarse” = telefon/tablet), a gracz może ją wymusić w opcjach.
 */
export type InputKind = 'desktop' | 'touch';
export type ControlMode = 'auto' | 'desktop' | 'touch';

/** Klia urządzenia na podstawie media queries i liczby punktów dotyku. */
export function detectInputKind(): InputKind {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'desktop';
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  const touchPoints = nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0;
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
  if (!mq) return touchPoints > 0 && !('onmousemove' in window) ? 'touch' : 'desktop';
  const coarse = mq('(pointer: coarse)').matches;
  const fine = mq('(pointer: fine)').matches;
  // Brak jakiegokolwiek dotyku = na pewno komputer.
  if (touchPoints <= 0) return 'desktop';
  // Główny wskaźnik to palec (telefon, tablet) = wersja dotykowa.
  if (coarse && !fine) return 'touch';
  // Urządzenie hybrydowe (laptop z ekranem dotykowym): o wersji decyduje
  // przekątna – mały ekran traktujemy jak tablet, duży jak komputer.
  if (coarse && fine) {
    const w = window.screen?.width ?? 1200;
    const h = window.screen?.height ?? 800;
    return Math.min(w, h) < 760 ? 'touch' : 'desktop';
  }
  return 'desktop';
}

/**
 * Rozstrzyga tryb sterowania dla ustawień gracza:
 *  • `auto`   – wersja wg głównego wskaźnika urządzenia,
 *  • `desktop`– wymuszona wersja PC (mysz + klawiatura + Pointer Lock),
 *  • `touch`  – wymuszona wersja mobilna (drążek, tapnięcia, gesty).
 */
export function resolveControlMode(settings: Pick<Settings, 'controlMode'>): InputKind {
  if (settings.controlMode === 'touch') return 'touch';
  if (settings.controlMode === 'desktop') return 'desktop';
  return detectInputKind();
}

/** Czy dana kombinacja (tryb sterowania) powinna pokazać drążek i gesty. */
export const CONTROL_MODE_LABEL: Record<ControlMode, string> = {
  auto: 'Automat',
  desktop: 'Komputer',
  touch: 'Dotyk',
};
