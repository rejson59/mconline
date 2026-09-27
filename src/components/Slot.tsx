import { useRef } from 'react';
import type { Stack } from '../game/inventory';
import { durabilityMax } from '../game/items';
import { stackTooltip } from '../utils/tooltip';

/**
 * BlockCraft 2.5 „Wielka naprawa” – wspólny slot ekwipunku dla WSZYSTKICH
 * okien (ekwipunek, skrzynia, piec, kowadło, statyw, zaklęcia, handel).
 *
 * Wcześniej sloty obsługiwały wyłącznie `onMouseDown`: na telefonie działało
 * to tylko dzięki kompatybilności tapnięć, a akcje prawego przycisku
 * (połowa stosu / pojedynczy sztuka) były na dotyku NIEDOSTĘPNE. Teraz:
 *  • klik / tapnij   – lewy przycisk (weź / połóż cały stos),
 *  • prawy przycisk  – akcja „połowa / jeden”,
 *  • przytrzymaj na dotyku (350 ms) – to samo, co prawy przycisk,
 *  • wskazówka przy najechaniu myszą działa jak dotychczas.
 */

const LONG_PRESS_MS = 350;

export default function Slot({
  stack,
  icons,
  onClick,
  onHover,
  showCount = true,
  highlight = false,
  imgSize = 34,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  /** `right = true` to akcja prawego przycisku (połowa stosu / jeden szt.). */
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
  showCount?: boolean;
  highlight?: boolean;
  imgSize?: number;
}) {
  const pressTimer = useRef<number | null>(null);
  const firedLongPress = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div
      className="mc-slot cursor-pointer"
      style={highlight ? { outline: '2px solid #fff', zIndex: 1 } : undefined}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') {
          // Mysz: LPM / PPM jak dotychczas.
          if (e.button !== 0 && e.button !== 2) return;
          e.preventDefault();
          onClick?.(e.button === 2);
          return;
        }
        // Dotyk/pióro: tap = LPM, przytrzymanie = PPM.
        e.preventDefault();
        // Przechwycenie wskaźnika, aby `pointerup` wrócił do tego slotu nawet,
        // gdy palec zjedzie o piksel w bok.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          /* stary Safari – zostaje fallback w onPointerLeave */
        }
        firedLongPress.current = false;
        clearTimer();
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = null;
          firedLongPress.current = true;
          try {
            navigator.vibrate?.(12);
          } catch {
            /* brak wsparcia */
          }
          onClick?.(true);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        const wasLong = firedLongPress.current;
        clearTimer();
        if (wasLong) {
          firedLongPress.current = false;
          return; // akcja wykonała się w długim przytrzymaniu
        }
        onClick?.(false);
      }}
      onPointerCancel={() => {
        clearTimer();
        firedLongPress.current = false;
      }}
      onPointerLeave={() => {
        clearTimer();
        firedLongPress.current = false;
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHover?.(stackTooltip(stack))}
      onMouseLeave={() => onHover?.(null)}
    >
      {stack && <img src={icons[stack.id]} className="pixelated pointer-events-none" width={imgSize} height={imgSize} draggable={false} />}
      {stack && showCount && stack.count > 1 && <span className="mc-count">{stack.count}</span>}
      {stack?.ench && <span className="ench-glint" />}
      {/* 2.5: pasek wytrzymałości w każdym slocie – wcześniej tylko na pasku
          skrótów, więc w skrzyni czy kowadle nie widać było zużycia narzędzi. */}
      {stack?.dur !== undefined && durabilityMax(stack.id) > 0 && stack.dur < durabilityMax(stack.id) && (
        <span className="dur-bar"><i style={{ width: `${Math.max(0, stack.dur / durabilityMax(stack.id)) * 100}%`, background: stack.dur / durabilityMax(stack.id) < 0.25 ? '#e04040' : '#3dba3d' }} /></span>
      )}
    </div>
  );
}
