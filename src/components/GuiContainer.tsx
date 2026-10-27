import { useSlotNavigation } from './useSlotNavigation';
import type { SlotAction } from '../game/inventoryNavigation';
/**
 * BlockCraft 2.28 – wspólne elementy waniliowych okien kontenerów.
 *
 * Kowadło, stół zaklęć, statyw alchemiczny i piec rysują prawdziwe panele
 * z paczki (`gui/container/*.png`, 176 × 166) i te same kratki na przedmioty,
 * co `MerchantScreen`. Ten moduł trzyma z nich to, co wspólne: skalowanie,
 * slot, ramkę okna, podpowiedzi i „trzymany” przedmiot przy kursorze.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Game } from '../game/engine';
import type { Stack } from '../game/inventory';
import { displayName, durabilityMax } from '../game/items';
import { stackTooltip } from '../utils/tooltip';
import { guiSprite } from '../game/art/uiSprites';
import CloseButton from './CloseButton';

/** Bazowy rozmiar tekstu GUI (skalowany razem z panelem). */
export const GUI_FONT = 8;
const LONG_PRESS_MS = 350;

/**
 * Slot narysowany na teksturze panelu – bez własnej ramki, żeby nie zasłaniać
 * waniliowej grafiki. Prawy przycisk myszy (albo długie przytrzymanie na
 * dotyku) przekazuje `right = true` – tak działa dzielenie stosu.
 */
export function GuiSlot({
  x, y, stack, icons, dim, hit = 1, onClick, onAction, onHover, highlight,
}: {
  x: number; y: number;
  stack: Stack | null;
  icons: Record<number, string>;
  dim?: boolean;
  hit?: number;
  onClick?: (right: boolean) => void;
  onAction?: (action: SlotAction) => void;
  onHover?: (text: string | null) => void;
  /** Delikatna poświata – np. slot, na który właśnie kliknięto. */
  highlight?: boolean;
}) {
  const navigation = useSlotNavigation(onAction);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clear, []);
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={stack ? displayName(stack.id) : undefined}
      onFocus={navigation.enter}
      onBlur={navigation.leave}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.shiftKey && onAction) onAction({ type: 'quick' }); else onClick(false); }
      }}
      style={{
        position: 'absolute', left: x - hit, top: y - hit, width: 16 + hit * 2, height: 16 + hit * 2,
        cursor: onClick ? 'pointer' : 'default', touchAction: 'none',
        boxShadow: highlight ? 'inset 0 0 0 1px rgba(255,255,255,0.75)' : undefined,
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') {
          if (e.button !== 0 && e.button !== 2) return;
          e.preventDefault();
          if (!navigation.pointer(e)) onClick?.(e.button === 2);
          return;
        }
        e.preventDefault();
        held.current = false;
        try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* starsze Safari */ }
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          held.current = true;
          onClick?.(true);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        const wasHeld = held.current;
        clear();
        held.current = false;
        if (!wasHeld) onClick?.(false);
      }}
      onPointerCancel={() => { clear(); held.current = false; }}
      onPointerLeave={() => { clear(); held.current = false; }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => { navigation.enter(); onHover?.(stack ? stackTooltip(stack) : null); }}
      onMouseLeave={() => { navigation.leave(); onHover?.(null); }}
    >
      {stack && (
        <img
          src={icons[stack.id]}
          alt=""
          title={displayName(stack.id)}
          draggable={false}
          style={{
            position: 'absolute', left: hit, top: hit, width: 16, height: 16,
            imageRendering: 'pixelated', opacity: dim ? 0.4 : 1,
          }}
        />
      )}
      {/* 2.28: pasek wytrzymałości – jak w waniliowym slocie (16 × 2 px). */}
      {stack?.dur !== undefined && stack.dur < durabilityMax(stack.id) && (
        <span
          className="dur-bar"
          style={{ left: hit + 1, right: hit + 1, bottom: hit + 1, height: 2 }}
        >
          <i
            style={{
              width: `${Math.max(0, Math.min(1, stack.dur / durabilityMax(stack.id))) * 100}%`,
              background: stack.dur / durabilityMax(stack.id) < 0.25 ? '#e04040' : '#3dba3d',
            }}
          />
        </span>
      )}
      {stack && stack.count > 1 && (
        <span
          style={{
            position: 'absolute', left: hit, top: hit + 7, width: 16, textAlign: 'right',
            fontSize: GUI_FONT, lineHeight: '8px', color: '#fff', textShadow: '1px 1px 0 #3f3f3f',
          }}
        >
          {stack.count > 99 ? '99' : stack.count}
        </span>
      )}
    </div>
  );
}

/** Styl tekstu GUI – ciemny, bez cienia, jak w Minecrafcie. */
export function guiText(color = '#3f3f3f'): CSSProperties {
  return {
    color, fontSize: GUI_FONT, lineHeight: `${GUI_FONT + 1}px`, letterSpacing: 0.2,
    whiteSpace: 'nowrap', fontFamily: 'inherit',
  };
}

/** Skala okna zależna od ekranu (na telefonie panel maleje, nie ucieka). */
export function useGuiScale(maxScale: number, fitH = 84, height = 166): number {
  const [scale, setScale] = useState(2);
  useEffect(() => {
    const fit = () => {
      const byW = (window.innerWidth - 24) / 176;
      const byH = (window.innerHeight - fitH) / height;
      setScale(Math.max(0.75, Math.min(maxScale, byW, byH)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [maxScale, fitH, height]);
  return scale;
}

/**
 * Ramka okna: przyciemnione tło, panel z paczki przeskalowany do okna,
 * przycisk zamknięcia i podpowiedź na dole. Dzieci rysujemy w pikselach GUI,
 * więc współrzędne z layoutów działają bez przeliczania.
 */
export function GuiWindow({
  sprite, title, scale, onClose, children, footer = 'Shift+klik – przenieś · 1–9 – pasek · Q / Ctrl+Q – wyrzuć · E / Esc – zamknij', titleX = 8, titleY = 6,
  width = 176, height = 166,
}: {
  sprite: string;
  title: string;
  scale: number;
  onClose: () => void;
  children: ReactNode;
  footer?: string;
  titleX?: number;
  titleY?: number;
  /** Skrzynia jest o piksel niższa (176 × 167), pozostałe okna 176 × 166. */
  width?: number;
  height?: number;
}) {
  const panel = guiSprite(sprite);
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <CloseButton onClose={onClose} className="mc-close-safe absolute z-50" />
      <div style={{ width: width * scale, height: height * scale, position: 'relative' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width, height,
            transform: `scale(${scale})`, transformOrigin: 'top left',
            backgroundImage: panel ? `url(${panel})` : undefined,
            backgroundSize: '100% 100%',
            backgroundColor: '#c6c6c6',
            imageRendering: 'pixelated',
            boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
            userSelect: 'none',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span style={{ ...guiText('#3f3f3f'), position: 'absolute', left: titleX, top: titleY - 1, fontWeight: 700 }}>
            {title}
          </span>
          {children}
        </div>
      </div>
      <span className="mc-text text-sm opacity-80" style={{ position: 'relative' }}>{footer}</span>
    </div>
  );
}

/** Siatka ekwipunku gracza 9 × 3 + pasek skrótów na teksturze panelu. */
export function GuiInventory({
  game, icons, slots, onHover, onChange,
}: {
  game: Game;
  icons: Record<number, string>;
  slots: readonly { x: number; y: number }[];
  onHover: (text: string | null) => void;
  onChange: () => void;
}) {
  const inv = game.inventory;
  return (
    <>
      {inv.slots.map((s, i) => {
        const p = slots[i];
        if (!p) return null;
        return (
          <GuiSlot
            key={i}
            x={p.x}
            y={p.y}
            stack={s}
            icons={icons}
            onHover={onHover}
            onAction={(action) => { game.inventoryAction('inventory', i, action); onChange(); }}
            onClick={(right) => {
              inv.clickSlot(i, right);
              onChange();
            }}
          />
        );
      })}
    </>
  );
}

/** Podpowiedź przy kursorze + „trzymany” przedmiot (jak w wanilii). */
export function GuiOverlay({
  game, icons, hover, mouse,
}: {
  game: Game;
  icons: Record<number, string>;
  hover: string | null;
  mouse: { x: number; y: number };
}) {
  const inv = game.inventory;
  return (
    <>
      {hover && !inv.cursor && (
        <div
          className="pointer-events-none fixed z-50 max-w-[320px] px-2 py-1 text-sm"
          style={{
            left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a',
            border: '2px solid #2a0f5f', whiteSpace: 'pre-line',
          }}
        >
          {hover}
        </div>
      )}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 17, top: mouse.y - 17 }}>
          <img src={icons[inv.cursor.id]} width={34} height={34} className="pixelated" alt="" />
          {inv.cursor.count > 1 && <span className="mc-count">{inv.cursor.count}</span>}
        </div>
      )}
    </>
  );
}

/** Pozycja kursora – mysz albo ostatnie tapnięcie (dotyk nie wysyła mousemove). */
export function useCursorPos(): { x: number; y: number } {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    const pt = (e: PointerEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    window.addEventListener('pointerdown', pt, true);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('pointerdown', pt, true);
    };
  }, []);
  return mouse;
}
