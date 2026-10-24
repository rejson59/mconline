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

/**
 * 2.32: fizyczna klawiatura albo mysz podłączona do tabletu/telefonu.
 *
 * Tablet z klawiaturą i myszką Bluetooth zgłasza się jako urządzenie
 * dotykowe (`pointer: coarse`), więc gra pokazywała drążek i ignorowała
 * sprzęt. Wykrywamy go po **realnych zdarzeniach**, a nie po samym UA:
 *
 *  • `mousemove` z niezerowym `movementX`/`movementY` – tylko prawdziwa mysz
 *    (albo touchpad) przesuwa wskaźnik względnie; palec nie ma `movementX`.
 *  • `pointerdown`/`mousedown` z `pointerType === 'mouse'`.
 *  • `keydown` z kodem klawisza gry i BEZ `sourceCapabilities.firesTouchEvents`
 *    – klawiatura ekranowa Androida/iPada oznacza swoje zdarzenia jako
 *    dotykowe, więc nie przełączymy sterowania przy pisaniu na szkle.
 */
export type HardwareKind = 'keyboard' | 'mouse';

/** Klawisze, których dotknięcie naprawdę oznacza „chcę grać na klawiaturze”. */
const GAME_KEYS = /^(Key[WASDQE]|Key[EIFTK]|KeyC|Space|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Digit[1-9]|Escape|Tab)$/;

interface HardwareEvent {
  type: string;
  pointerType?: string;
  code?: string;
  key?: string;
  movementX?: number;
  movementY?: number;
  sourceCapabilities?: { firesTouchEvents?: boolean } | null;
}

/**
 * Rozpoznaje sprzęt fizyczny w zdarzeniu wejściowym. Zwraca `null`, gdy
 * zdarzenie pochodzi z ekranu dotykowego albo nie mówi nic o sprzęcie.
 */
export function hardwareHint(ev: HardwareEvent): HardwareKind | null {
  const type = ev.type;
  if (type === 'pointerdown' || type === 'mousedown') {
    return ev.pointerType === 'mouse' ? 'mouse' : null;
  }
  if (type === 'mousemove' || type === 'pointermove') {
    // `pointermove` z `pointerType: 'mouse'` to najpewniejszy sygnał –
    // palec zgłasza się jako 'touch', a zdarzenia zgodności z dotyku
    // mają `pointerType` puste. Gdy go brak (stare przeglądarki),
    // wymagamy niezerowego ruchu względnego, którego palec nie generuje.
    if (ev.pointerType) return ev.pointerType === 'mouse' ? 'mouse' : null;
    return (ev.movementX ?? 0) !== 0 || (ev.movementY ?? 0) !== 0 ? 'mouse' : null;
  }
  if (type === 'wheel') return 'mouse';
  if (type === 'keydown') {
    // Klawiatura ekranowa raportuje `firesTouchEvents` – to nie jest sprzęt.
    if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return null;
    if (!GAME_KEYS.test(ev.code ?? '')) return null;
    return 'keyboard';
  }
  return null;
}

/**
 * Czy po tylu milisekundach bez sprzętu wracamy na sterowanie dotykowe?
 *
 * Tablet z odłączoną klawiaturą ma wrócić do drążka sam – ale dopiero po
 * 15 s ciszy i po realnym użyciu palca, żeby chwilowa przerwa w grze nie
 * przestawiała sterowania.
 */
export const HARDWARE_IDLE_MS = 15000;
/** Ile dotknięć ekranu musi być po ciszy, żeby wrócić do dotyku. */
export const TOUCH_RESTORE_TAPS = 3;

export function shouldRestoreTouch(idleMs: number, touchTaps: number): boolean {
  return idleMs >= HARDWARE_IDLE_MS && touchTaps >= TOUCH_RESTORE_TAPS;
}

/** Czy dana kombinacja (tryb sterowania) powinna pokazać drążek i gesty. */
export const CONTROL_MODE_LABEL: Record<ControlMode, string> = {
  auto: 'Automat',
  desktop: 'Komputer',
  touch: 'Dotyk',
};
