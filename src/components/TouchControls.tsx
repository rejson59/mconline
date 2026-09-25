import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/engine';

/** True on phones/tablets (or any device with a touchscreen). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  return 'ontouchstart' in window || (nav.maxTouchPoints ?? nav.msMaxTouchPoints ?? 0) > 0;
}

const STICK_RADIUS = 58;

interface PointerInfo {
  kind: 'move' | 'look' | 'button';
  id: string;
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
}

/**
 * On-screen controls for phones and tablets: a virtual thumbstick on the left,
 * drag-to-look on the right and action buttons in the bottom-right corner.
 * Everything is driven through the public Game API, so the desktop path is
 * untouched.
 */
export default function TouchControls({ game, onInventory, onPause }: { game: Game; onInventory: () => void; onPause: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, PointerInfo>());
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [jumping, setJumping] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [sneaking, setSneaking] = useState(false);
  const lastJumpTap = useRef(0);

  useEffect(() => {
    const stop = () => {
      pointers.current.clear();
      setStick(null);
      setJumping(false);
      setBreaking(false);
      setPlacing(false);
      setSneaking(false);
      game.keys.clear();
      game.mouseLeft = false;
      game.mouseRight = false;
    };
    return stop;
  }, [game]);

  const setMoveKeys = (dx: number, dy: number) => {
    const k = game.keys;
    const dead = 0.28;
    if (dy < -dead) k.add('KeyW');
    else k.delete('KeyW');
    game.sprinting = dy < -0.86;
    if (dy > dead) k.add('KeyS');
    else k.delete('KeyS');
    if (dx < -dead) k.add('KeyA');
    else k.delete('KeyA');
    if (dx > dead) k.add('KeyD');
    else k.delete('KeyD');
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const moveZone = x < rect.width * 0.45 && y > rect.height * 0.35;
    if (moveZone) {
      pointers.current.set(e.pointerId, { kind: 'move', id: e.pointerId.toString(), originX: x, originY: y, lastX: x, lastY: y });
      setStick({ x, y, dx: 0, dy: 0 });
    } else {
      pointers.current.set(e.pointerId, { kind: 'look', id: e.pointerId.toString(), originX: x, originY: y, lastX: x, lastY: y });
    }
    el.setPointerCapture?.(e.pointerId);
    game.sprinting = false;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
      setMoveKeys(dx / STICK_RADIUS, dy / STICK_RADIUS);
      setStick({ x: info.originX, y: info.originY, dx, dy });
    } else if (info.kind === 'look') {
      const s = 0.006 * game.sensitivity;
      game.yaw -= (x - info.lastX) * s;
      game.pitch -= (y - info.lastY) * s;
      game.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, game.pitch));
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
      setMoveKeys(0, 0);
    }
  };

  const pressJump = (down: boolean) => {
    setJumping(down);
    if (down) {
      const now = performance.now();
      if (game.mode === 'creative' && now - lastJumpTap.current < 350) {
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
    if (!down) game.breakProgress = 0;
  };

  const pressPlace = (down: boolean) => {
    setPlacing(down);
    game.mouseRight = down;
    if (down) {
      game.placeCooldown = 0;
      game.tryUse();
    }
  };

  const pressSneak = (down: boolean) => {
    setSneaking(down);
    if (down) game.keys.add('ShiftLeft');
    else game.keys.delete('ShiftLeft');
  };

  const btn = 'pointer-events-auto flex select-none items-center justify-center border-2 border-black text-[15px] font-bold mc-text';
  const btnStyle = { background: 'rgba(90,90,90,0.55)', borderRadius: 9999, width: 64, height: 64, touchAction: 'none' as const };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute inset-0 z-20"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* thumbstick */}
      {stick && (
        <div className="pointer-events-none absolute" style={{ left: stick.x - STICK_RADIUS, top: stick.y - STICK_RADIUS, width: STICK_RADIUS * 2, height: STICK_RADIUS * 2, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.25)' }}>
          <div style={{ position: 'absolute', left: STICK_RADIUS + stick.dx - 22, top: STICK_RADIUS + stick.dy - 22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
        </div>
      )}

      {/* action buttons */}
      <div className="pointer-events-none absolute bottom-4 right-4 grid grid-cols-2 gap-3">
        <button className={btn} style={{ ...btnStyle, opacity: sneaking ? 1 : 0.7 }} onPointerDown={(e) => { e.stopPropagation(); pressSneak(true); }} onPointerUp={() => pressSneak(false)} onPointerCancel={() => pressSneak(false)}>
          ↑↓
        </button>
        <button className={btn} style={{ ...btnStyle, opacity: jumping ? 1 : 0.7 }} onPointerDown={(e) => { e.stopPropagation(); pressJump(true); }} onPointerUp={() => pressJump(false)} onPointerCancel={() => pressJump(false)}>
          ⤒
        </button>
        <button className={btn} style={{ ...btnStyle, opacity: breaking ? 1 : 0.7 }} onPointerDown={(e) => { e.stopPropagation(); pressBreak(true); }} onPointerUp={() => pressBreak(false)} onPointerCancel={() => pressBreak(false)}>
          ⛏
        </button>
        <button className={btn} style={{ ...btnStyle, opacity: placing ? 1 : 0.7 }} onPointerDown={(e) => { e.stopPropagation(); pressPlace(true); }} onPointerUp={() => pressPlace(false)} onPointerCancel={() => pressPlace(false)}>
          ▣
        </button>
      </div>

      {/* top-left buttons */}
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <button className={btn} style={{ ...btnStyle, width: 52, height: 52, fontSize: 22 }} onPointerDown={(e) => { e.stopPropagation(); onPause(); }}>
          ⏸
        </button>
        <button className={btn} style={{ ...btnStyle, width: 52, height: 52, fontSize: 20 }} onPointerDown={(e) => { e.stopPropagation(); onInventory(); }}>
          🎒
        </button>
      </div>
    </div>
  );
}
