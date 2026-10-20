/**
 * 2.13: pełny ekran i orientacja pozioma.
 *
 * BlockCraft na telefonie gra się w poziomie – tak jak Minecraft Pocket
 * Edition. Przeglądarki pozwalają wymusić orientację tylko w pełnym ekranie
 * (Screen Orientation API), więc jedno przycisk robi dwie rzeczy naraz:
 * wchodzi w pełny ekran i blokuje poziom. Gdy przeglądarka tego nie umie
 * (np. iPhone z zablokowaną rotacją), zostaje czytelna nakładka „obróć
 * telefon”, a gra nigdy nie rzuca wyjątkiem w konsoli.
 */

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary' | 'portrait' | 'any') => Promise<void>;
  unlock?: () => void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

/**
 * Czy urządzenie ma ekran dotykowy (telefon/tablet).
 * Laptop z ekranem dotykowym ma zwykle „hover: hover” i mysz – nie chcemy
 * mu włączać telefonowego trybu poziomego tylko dlatego, że ma touch.
 */
export function isTouchScreen(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  const points = nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0;
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    if (window.matchMedia('(hover: none)').matches) return true;
    if (window.matchMedia('(any-pointer: fine)').matches) return false;
  }
  return 'ontouchstart' in window || points > 0;
}

/**
 * „Telefonowy” kształt ekranu: dotyk i krótszy bok <= 820 px. Dzięki temu
 * laptop z ekranem dotykowym nie dostaje wymuszonego poziomu.
 */
export function isPhoneScreen(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isTouchScreen()) return false;
  const w = window.screen?.width ?? window.innerWidth;
  const h = window.screen?.height ?? window.innerHeight;
  return Math.min(w, h) <= 820;
}

/** Czy ekran jest obecnie pionowy (czysta funkcja – łatwo testować). */
export function isPortraitSize(width: number, height: number): boolean {
  return height > width;
}

export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return isPortraitSize(window.innerWidth, window.innerHeight);
}

export function canLockOrientation(): boolean {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
  return typeof (screen.orientation as LockableOrientation | undefined)?.lock === 'function';
}

/** Próbuje zablokować poziom; `false` = przeglądarka nie pozwoliła. */
export async function lockLandscape(): Promise<boolean> {
  if (!canLockOrientation()) return false;
  try {
    await (screen.orientation as LockableOrientation).lock!('landscape');
    return true;
  } catch {
    // Najczęstszy powód: brak pełnego ekranu (wymagany w Chrome) albo iOS.
    return false;
  }
}

export function unlockOrientation(): void {
  try {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  } catch {
    /* brak wsparcia */
  }
}

export function inFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(document.fullscreenElement || (document as FullscreenDocument).webkitFullscreenElement);
}

export async function requestFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const el = (document.documentElement ?? document.body) as FullscreenElement | undefined;
  if (!el) return false;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    /* użytkownik odmówił albo przeglądarka nie wspiera */
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if ((document as FullscreenDocument).webkitFullscreenElement) {
      await (document as FullscreenDocument).webkitExitFullscreen?.();
    }
  } catch {
    /* już wyszliśmy */
  }
}

export interface LandscapeResult {
  fullscreen: boolean;
  locked: boolean;
}

/**
 * Wejście w pełny ekran + blokada poziomu. Kolejność jest istotna:
 * Chrome pozwala zablokować orientację dopiero PO wejściu w pełny ekran.
 */
export async function enterLandscapeMode(): Promise<LandscapeResult> {
  const fullscreen = inFullscreen() ? true : await requestFullscreen();
  const locked = await lockLandscape();
  return { fullscreen, locked };
}

/** Przycisk ⛶: pełny ekran + poziom, a drugie kliknięcie wraca do okna. */
export async function toggleFullscreenLandscape(): Promise<LandscapeResult> {
  if (inFullscreen()) {
    unlockOrientation();
    await exitFullscreen();
    return { fullscreen: false, locked: false };
  }
  return enterLandscapeMode();
}

/**
 * Ponowna próba blokady po zmianie pełnego ekranu – przeglądarki potrafią
 * skasować blokadę po wyjściu i wejściu w fullscreen.
 */
export function watchLandscape(onChange?: (fullscreen: boolean) => void): () => void {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return () => {};
  let wasFull = inFullscreen();
  const sync = () => {
    const full = inFullscreen();
    if (full === wasFull) return;
    wasFull = full;
    if (full) void lockLandscape();
    else unlockOrientation();
    onChange?.(full);
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  return () => {
    document.removeEventListener('fullscreenchange', sync);
    document.removeEventListener('webkitfullscreenchange', sync);
  };
}

/** Nazwa klucza w sessionStorage – „graj w pionie mimo to” działa do zamknięcia karty. */
export const PORTRAIT_DISMISS_KEY = 'blockcraft-portrait-ok';

export function portraitDismissed(): boolean {
  try {
    return sessionStorage.getItem(PORTRAIT_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPortrait(): void {
  try {
    sessionStorage.setItem(PORTRAIT_DISMISS_KEY, '1');
  } catch {
    /* prywatny tryb przeglądarki */
  }
}
