import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/engine';
import { ITEMS } from '../game/items';
import type { Settings } from '../utils/settings';

/** True on phones/tablets – 2.5: tylko pomocniczo, tryb wybiera utils/input. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  return 'ontouchstart' in window || (nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches === true;
}

const STICK_RADIUS = 62;
const JOINT_BASE = { x: 96, y: -118 }; // środek stałego drążka (od lewej / od dołu)
const HOLD_MS = 250;
const TAP_MOVE_PX = 14;

interface PointerInfo {
  kind: 'move' | 'look';
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  downAt: number;
  moved: boolean;
  /** tryb gestu dla 'look': '' nic, 'break' kopanie, 'draw' naciąganie łuku */
  gesture: '' | 'break' | 'draw';
  holdTimer: number | null;
}

function buzz(ms: number, enabled: boolean) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* brak wsparcia */
  }
}

interface BtnProps {
  label: string;
  size?: number;
  active?: boolean;
  opacity?: number;
  fontSize?: number;
  hint?: string;
  onDown: () => void;
  onUp?: () => void;
  haptics: boolean;
}

/** Okrągły przycisk akcji – duży, półprzezroczysty, „majstrowany” pod palec. */
function ActionButton({ label, size = 62, active, opacity = 0.66, fontSize = 22, hint, onDown, onUp, haptics }: BtnProps) {
  const [held, setHeld] = useState(false);
  return (
    <button
      title={hint}
      aria-label={hint || label}
      className="pointer-events-auto flex select-none items-center justify-center border-2 border-black mc-text"
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        fontSize,
        touchAction: 'none',
        opacity: held ? 0.95 : active ? 0.92 : opacity,
        background: active ? 'rgba(110,160,90,0.65)' : 'rgba(70,70,70,0.55)',
        transform: held ? 'scale(0.93)' : 'scale(1)',
        transition: 'transform 60ms',
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setHeld(true);
        buzz(8, haptics);
        onDown();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setHeld(false);
        onUp?.();
      }}
      onPointerCancel={() => {
        setHeld(false);
        onUp?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/**
 * BlockCraft 2.0 – sterowanie dotykowe inspirowane wersją kieszonkową:
 *  • drążek ruchu (stały albo pojawiający się pod palcem), pchnięcie do oporu = sprint,
 *  • przeciąganie po ekranie = rozglądanie się,
 *  • tryb „Tapnij”: krótkie tapnięcie stawia blok / używa przedmiotu / atakuje moba,
 *    przytrzymanie kopie blok pod palcem (celownik leci za palcem, nie na środek),
 *  • tryb „Przyciski”: klasyczne ⛏ i ▣ celujące w środek ekranu,
 *  • łuk: przytrzymaj i puść w obu trybach,
 *  • podwójne tapnięcie skoku w trybie kreatywnym = latanie; ↗ = rzut przedmiotu.
 */
export default function TouchControls({
  game,
  settings,
  onInventory,
  onPause,
  onChat,
  onWaypoints,
}: {
  game: Game;
  settings: Settings;
  onInventory: () => void;
  onPause: () => void;
  onChat: () => void;
  onWaypoints: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, PointerInfo>());
  const lastForwardTap = useRef(0);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [sprintPush, setSprintPush] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [sneaking, setSneaking] = useState(false);
  const [flying, setFlying] = useState(game.flying);
  const [creative, setCreative] = useState(game.mode === 'creative');
  const [holdRing, setHoldRing] = useState<{ x: number; y: number; p: number } | null>(null);
  const lastJumpTap = useRef(0);
  // Wysokość viewportu dla stałej podkładki drążka (zanim gracz dotknie ekranu).
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const fixedBase = { x: JOINT_BASE.x + 10, y: vh + JOINT_BASE.y - 24 };

  // Odświeżaj stan latania / trybu gry (silnik zmienia je bez wiedzy Reacta).
  useEffect(() => {
    const t = setInterval(() => {
      setFlying(game.flying);
      setCreative(game.mode === 'creative');
    }, 250);
    return () => clearInterval(t);
  }, [game]);

  // Opuszczanie ekranu nigdy nie może zostawić „wciśniętych” klawiszy.
  useEffect(() => {
    const stop = () => {
      pointers.current.clear();
      setStick(null);
      setJumping(false);
      setBreaking(false);
      setPlacing(false);
      setSneaking(false);
      setHoldRing(null);
      game.keys.clear();
      game.mouseLeft = false;
      game.mouseRight = false;
      game.touchAim = null;
      game.sprinting = false;
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
      stop();
    };
  }, [game]);

  const setMoveKeys = (dx: number, dy: number) => {
    const k = game.keys;
    const dead = 0.25;
    if (dy < -dead) k.add('KeyW');
    else k.delete('KeyW');
    if (dy > dead) k.add('KeyS');
    else k.delete('KeyS');
    if (dx < -dead) k.add('KeyA');
    else k.delete('KeyA');
    if (dx > dead) k.add('KeyD');
    else k.delete('KeyD');
    // Pchnięcie drążka do oporu = sprint (jak w wersji kieszonkowej).
    const deep = dy < -0.92;
    game.sprinting = deep || (game.sprinting && dy < -0.55);
    setSprintPush(deep);
  };

  const ndc = (x: number, y: number) => {
    const rect = rootRef.current!.getBoundingClientRect();
    return { x: (x / rect.width) * 2 - 1, y: -(y / rect.height) * 2 + 1 };
  };

  const startHold = (info: PointerInfo) => {
    const sel = game.selectedStack();
    // Łuk w dłoni: przytrzymanie naciąga, puszczenie strzela – oba tryby.
    if (sel && ITEMS[sel.id]?.tool === 'bow') {
      info.gesture = 'draw';
      game.touchAim = ndc(info.lastX, info.lastY);
      game.mouseRight = true;
      return;
    }
    info.gesture = 'break';
    game.mouseLeft = true;
    game.touchAim = ndc(info.lastX, info.lastY);
    game.refreshTarget();
    game.tryAttack(); // najpierw cios – mob pod palcem, potem zwykłe kopanie
    setBreaking(true);
    setHoldRing({ x: info.lastX, y: info.lastY, p: 0 });
  };

  const endGesture = (info: PointerInfo) => {
    if (info.holdTimer !== null) {
      clearTimeout(info.holdTimer);
      info.holdTimer = null;
    }
    if (info.gesture === 'break') {
      game.mouseLeft = false;
      game.breakProgress = 0;
      game.touchAim = null;
      setBreaking(false);
      setHoldRing(null);
    } else if (info.gesture === 'draw') {
      // 2.5: najpierw puszczamy cięciwę – silnik wystrzeli strzałę w KIERUNKU
      // PALCA w tej samej klatce i dopiero wtedy czyści cel dotyku. Wcześniej
      // oba działy się naraz i strzała leciała zawsze w środek ekranu.
      game.mouseRight = false;
    } else if (info.gesture === '' && settings.touchMode === 'tap' && !info.moved && performance.now() - info.downAt < HOLD_MS) {
      // Krótkie tapnięcie: postaw blok / użyj / zjedz / zaatakuj moba.
      // 2.5: okno tapu = okno przytrzymania – wcześniej tap trwał do 260 ms,
      // a przytrzymanie startowało po 250 ms, więc ostatnie 10 ms tapu
      // „gubilo się” jako niechciany cios.
      const n = ndc(info.lastX, info.lastY);
      game.touchTap(n.x, n.y);
      buzz(6, settings.haptics);
    }
    info.gesture = '';
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = rootRef.current;
    if (!el || game.ui !== 'playing') return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Licz od faktycznej warstwy gry, nie od window.innerHeight — mobilny pasek
    // adresu potrafi zmienić te wartości w środku gestu.
    const base = settings.joystickFixed ? { x: JOINT_BASE.x + 10, y: rect.height + JOINT_BASE.y - 24 } : { x: 0, y: 0 };
    // W trybie stałym cała dolna lewa ćwiartka aktywuje drążek. Wcześniej
    // trzeba było trafić w mały okrąg, co na telefonie wyglądało jak całkiem
    // zepsuty ruch (szczególnie przy pasku adresu zmieniającym wysokość ekranu).
    const moveZone = settings.joystickFixed
      ? (x < Math.min(rect.width * 0.46, base.x + STICK_RADIUS * 2.25) && y > rect.height * 0.42)
      : x < rect.width * 0.46 && y > rect.height * 0.32;
    // 2.5: drugi palec w strefie drążka (np. otarta dłoń) NIE zrywa ruchu –
    // drążek jest tylko jeden, dodatkowy dotyk w strefie to rozglądanie.
    // Wcześniej drugi dotyk podmieniał drążek, a jego puszczenie zatrzymywało
    // też pierwszy, więc postać stawała w miejscu.
    const moveTaken = [...pointers.current.values()].some((p) => p.kind === 'move');
    const kind: PointerInfo['kind'] = moveZone && !moveTaken ? 'move' : 'look';
    const info: PointerInfo = {
      kind,
      originX: kind === 'move' && !settings.joystickFixed ? x : base.x,
      originY: kind === 'move' && !settings.joystickFixed ? y : base.y,
      lastX: x,
      lastY: y,
      startX: x,
      startY: y,
      downAt: performance.now(),
      moved: false,
      gesture: '',
      holdTimer: null,
    };
    pointers.current.set(e.pointerId, info);
    if (info.kind === 'move') {
      setStick({ x: info.originX, y: info.originY, dx: 0, dy: 0 });
      buzz(5, settings.haptics);
    } else if (settings.touchMode === 'tap') {
      // Timer przytrzymania – dopiero wtedy zaczyna się kopanie.
      info.holdTimer = window.setTimeout(() => {
        if (pointers.current.get(e.pointerId) === info && !info.moved && game.ui === 'playing') startHold(info);
      }, HOLD_MS);
    }
    // Capture on the actual event owner (not a stale ref) keeps multi-touch
    // stable in Safari when its address bar appears/disappears.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const info = pointers.current.get(e.pointerId);
    const el = rootRef.current;
    if (!info || !el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (info.kind === 'move') {
      let dx = x - info.originX;
      let dy = y - info.originY;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      // Drugie szybkie pchnięcie do przodu = zablokowany sprint.
      if (dy < -STICK_RADIUS * 0.9) {
        const now = performance.now();
        if (now - lastForwardTap.current < 320) game.sprinting = true;
        lastForwardTap.current = now;
      }
      setMoveKeys(dx / STICK_RADIUS, dy / STICK_RADIUS);
      setStick({ x: info.originX, y: info.originY, dx, dy });
    } else if (info.kind === 'look') {
      // 2.5: lorneta spowalnia też rozglądanie palcem (jak mysz na PC).
      const s = 0.006 * settings.sensitivity * (game.isZooming() ? 0.4 : 1);
      game.yaw -= (x - info.lastX) * s;
      game.pitch -= (y - info.lastY) * s;
      game.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, game.pitch));
      const travel = Math.hypot(x - info.startX, y - info.startY);
      if (travel > TAP_MOVE_PX) info.moved = true;
      if (info.gesture === 'break') {
        info.lastX = x;
        info.lastY = y;
        game.touchAim = ndc(x, y); // celownik podąża za palcem
        // 2.5: pierścień zawsze podąża za palcem (wcześniej polegał na
        // możliwie nieaktualnym stanie z zamknięcia renderowania).
        setHoldRing({ x, y, p: game.breakProgress });
      } else if (info.gesture === 'draw') {
        info.lastX = x;
        info.lastY = y;
        // 2.5: naciągnięty łuk celuje tam, gdzie jest palec (wcześniej
        // trafiał w punkt przytrzymania i nie dało się wycelować).
        game.touchAim = ndc(x, y);
      }
    }
    info.lastX = x;
    info.lastY = y;
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const info = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (!info) return;
    if (info.kind === 'move') {
      setStick(null);
      setSprintPush(false);
      setMoveKeys(0, 0);
      game.sprinting = false;
    } else {
      endGesture(info);
    }
  };

  // 2.5: pełny ekran – odrzucenie obietnicy (iOS Safari) nie może zostać
  // jako „unhandled rejection” w konsoli.
  const toggleFullscreenSafe = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.()?.catch?.(() => {});
      else void document.documentElement.requestFullscreen?.()?.catch?.(() => {});
    } catch {
      /* niektóre przeglądarki mobilne nie pozwalają */
    }
  };

  // Podgląd postępu kopania dla pierścienia pod palcem.
  useEffect(() => {
    if (!breaking) return;
    const t = setInterval(() => {
      setHoldRing((r) => (r ? { ...r, p: game.breakProgress } : r));
    }, 90);
    return () => clearInterval(t);
  }, [breaking, game]);

  const pressJump = (down: boolean) => {
    setJumping(down);
    if (down) {
      const now = performance.now();
      if (creative && now - lastJumpTap.current < 350) {
        game.toggleFly();
        lastJumpTap.current = 0;
        game.keys.delete('Space');
        setJumping(false);
        return;
      }
      lastJumpTap.current = now;
      game.keys.add('Space');
    } else {
      game.keys.delete('Space');
    }
  };

  const pressBreak = (down: boolean) => {
    setBreaking(down);
    game.mouseLeft = down;
    if (down) {
      game.refreshTarget();
      game.tryAttack();
    } else game.breakProgress = 0;
  };

  const pressPlace = (down: boolean) => {
    setPlacing(down);
    game.mouseRight = down;
    if (down) {
      // refreshTarget natychmiast przelicza cel, a updateInteraction (już
      // z wciśniętym mouseRight) wykonuje tryUse dokładnie raz.
      game.placeCooldown = 0;
      game.refreshTarget();
    }
  };

  const pressSneak = (down: boolean) => {
    setSneaking(down);
    if (down) game.keys.add('ShiftLeft');
    else game.keys.delete('ShiftLeft');
  };

  const btn = 'pointer-events-auto flex select-none items-center justify-center border-2 border-black mc-text';
  const btnStyle = { background: 'rgba(70,70,70,0.55)', borderRadius: 9999, touchAction: 'none' as const };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* drążek – stała podkładka zawsze widoczna */}
      {settings.joystickFixed && !stick && (
        <div
          className="pointer-events-none absolute flex items-center justify-center"
          style={{
            left: fixedBase.x - STICK_RADIUS,
            top: fixedBase.y - STICK_RADIUS,
            width: STICK_RADIUS * 2,
            height: STICK_RADIUS * 2,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.30)',
            background: 'rgba(0,0,0,0.22)',
          }}
        >
          <div className="text-[11px] opacity-50 mc-text">RUCH</div>
        </div>
      )}

      {/* wizualizacja drążka */}
      {stick && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: stick.x - STICK_RADIUS,
            top: stick.y - STICK_RADIUS,
            width: STICK_RADIUS * 2,
            height: STICK_RADIUS * 2,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.4)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: STICK_RADIUS + stick.dx - 24,
              top: STICK_RADIUS + stick.dy - 24,
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: sprintPush ? 'rgba(255,230,120,0.75)' : 'rgba(255,255,255,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: sprintPush ? 16 : 12,
              fontWeight: 700,
              color: '#222',
            }}
          >
            {sprintPush ? '>>' : ''}
          </div>
        </div>
      )}

      {/* pierścień postępu kopania pod palcem */}
      {holdRing && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: holdRing.x - 30,
            top: holdRing.y - 30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '3px dashed rgba(255,255,255,0.35)',
            background: `conic-gradient(rgba(255,255,255,0.45) ${Math.round(holdRing.p * 360)}deg, rgba(255,255,255,0.06) 0deg)`,
          }}
        />
      )}

      {/* Obrona dostępna także bez klawiatury, również w trybie tap. */}
      <div className="pointer-events-none absolute right-3 flex gap-2" style={{ top: vh < 530 ? 72 : 136 }}>
        <ActionButton label="↝" hint="Unik" size={48} onDown={() => game.tryDodge()} haptics={settings.haptics} />
        <ActionButton label="🛡" hint="Parowanie tarczą" size={48} onDown={() => game.tryTimedGuard()} haptics={settings.haptics} />
        {ITEMS[game.selectedStack?.()?.id ?? 0]?.tool === 'bow' && (
          <ActionButton label="➟" hint="Wybierz strzałę" size={48} onDown={() => game.cycleArrowAmmo()} haptics={settings.haptics} />
        )}
      </div>

      {/* przyciski akcji – diament pod prawym kciukiem */}
      <div
        className="pointer-events-none absolute"
        style={{ right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 126px)', width: 160, height: settings.touchMode === 'buttons' ? 216 : 148 }}
      >
        <div className="absolute" style={{ right: 0, bottom: 0 }}>
          <ActionButton label={flying ? '⤒' : '⬆'} size={72} fontSize={26} opacity={jumping ? 1 : 0.7} onDown={() => pressJump(true)} onUp={() => pressJump(false)} haptics={settings.haptics} />
        </div>
        <div className="absolute" style={{ right: 84, bottom: 6 }}>
          <ActionButton label={sneaking ? '⇩' : '⇣'} size={56} active={sneaking} onDown={() => pressSneak(!sneaking)} haptics={settings.haptics} />
        </div>
        {/* A decoy must be usable on touch as well as with keyboard Q. */}
        <div className="absolute" style={{ right: 8, bottom: 80 }}>
          <ActionButton label="↗" hint="Rzuć przedmiot" size={48} onDown={() => game.dropItem()} haptics={settings.haptics} />
        </div>
        {creative && (
          <div className="absolute" style={{ right: 94, bottom: 76 }}>
            <ActionButton
              label="✈"
              size={54}
              active={flying}
              onDown={() => {
                game.toggleFly();
                setFlying(game.flying);
              }}
              haptics={settings.haptics}
            />
          </div>
        )}
        {settings.touchMode === 'buttons' && (
          <>
            <div className="absolute" style={{ right: 86, bottom: 148 }}>
              <ActionButton label="▣" size={58} opacity={placing ? 1 : 0.66} onDown={() => pressPlace(true)} onUp={() => pressPlace(false)} haptics={settings.haptics} />
            </div>
            <div className="absolute" style={{ right: 8, bottom: 148 }}>
              <ActionButton label="⛏" size={58} opacity={breaking ? 1 : 0.66} onDown={() => pressBreak(true)} onUp={() => pressBreak(false)} haptics={settings.haptics} />
            </div>
          </>
        )}
      </div>

      {/* pasek górny: pauza, ekwipunek, czat, pełny ekran */}
      <div className="pointer-events-none absolute left-3 flex gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button
          className={btn}
          style={{ ...btnStyle, width: 50, height: 50, fontSize: 20, opacity: 0.75 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            buzz(6, settings.haptics);
            onPause();
          }}
        >
          ⏸
        </button>
        <button
          className={btn}
          style={{ ...btnStyle, width: 50, height: 50, fontSize: 19, opacity: 0.75 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            buzz(6, settings.haptics);
            onInventory();
          }}
        >
          🎒
        </button>
        <button
          className={btn}
          style={{ ...btnStyle, width: 50, height: 50, fontSize: 18, opacity: 0.75 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onChat();
          }}
        >
          💬
        </button>
        <button
          aria-label="Punkty podróży"
          className={btn}
          style={{ ...btnStyle, width: 50, height: 50, fontSize: 18, opacity: 0.75 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            buzz(6, settings.haptics);
            onWaypoints();
          }}
        >
          📍
        </button>
        <button
          className={btn}
          style={{ ...btnStyle, width: 50, height: 50, fontSize: 17, opacity: 0.75 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            toggleFullscreenSafe();
          }}
        >
          ⛶
        </button>
      </div>

      {game.isZooming() && (
        <button className="pointer-events-auto absolute left-1/2 top-16 z-40 -translate-x-1/2 border-2 border-yellow-300 bg-stone-900/90 px-3 py-2 text-sm mc-text"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); game.markSpyglass(); }}>
          ⌖ Zaznacz cel
        </button>
      )}

      {/* krótka ściągka trybu tap – pod paskiem górnym, żeby nie zasłaniać HUD-u */}
      {settings.touchMode === 'tap' && vh >= 530 && (
        <div className="pointer-events-none absolute left-3 max-w-[240px] text-[12px] leading-tight opacity-55 mc-text" style={{ top: 92 }}>
          tapnij = postaw / użyj<br />przytrzymaj = kop<br />przeciągnij = rozglądaj się
        </div>
      )}
    </div>
  );
}
