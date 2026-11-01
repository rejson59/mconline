import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Game } from '../game/engine';
import type { SlotArea } from '../game/inventoryNavigation';
type Target = { area: SlotArea; index: number; element: HTMLElement };
const read = (element: EventTarget | null): Target | null => {
  const el = element instanceof Element ? element.closest<HTMLElement>('[data-slot-area]') : null;
  return el ? { area: el.dataset.slotArea as SlotArea, index: Number(el.dataset.slotIndex), element: el } : null;
};
/** Delay held-stack placement until mouseup so dragging can distribute it atomically. */
export function useGuiInteractions(game?: Game, refresh?: () => void) {
  const drag = useRef<{ targets: Target[]; right: boolean; held: unknown } | null>(null);
  const update = useRef(refresh); update.current = refresh;
  const last = useRef({ at: 0, key: '' });
  useEffect(() => {
    const clear = () => { drag.current?.targets.forEach(t => delete t.element.dataset.dragSelected); drag.current = null; };
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d || !game) return;
      if (!e.buttons) { clear(); return; }
      const target = read(document.elementFromPoint?.(e.clientX, e.clientY) ?? e.target);
      if ((d.right || (game.inventory.cursor?.count ?? 0) > d.targets.length) && target && !d.targets.some(t => t.area === target.area && t.index === target.index) && game.canPlaceInventoryCursor(target.area, target.index)) {
        d.targets.push(target); target.element.dataset.dragSelected = 'true';
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current; if (!d || !game) return;
      if (e.button === (d.right ? 2 : 0) && d.held === game.inventory.cursor) {
        if (d.targets.length === 1) game.placeInventoryCursor(d.targets[0].area, d.targets[0].index, d.right);
        else game.distributeInventoryCursor(d.targets, d.right);
        update.current?.();
      }
      clear();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', clear); window.addEventListener('blur', clear);
    return () => { clear(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', clear); window.removeEventListener('blur', clear); };
  }, [game]);
  return (e: ReactPointerEvent) => {
    if (!game || e.pointerType !== 'mouse' || (e.button !== 0 && e.button !== 2)) return;
    const target = read(e.target), key = target ? `${target.area}:${target.index}` : '';
    const now = performance.now(), double = e.button === 0 && key === last.current.key && now - last.current.at < 250;
    last.current = { at: now, key };
    if (double || e.shiftKey || !game.inventory.cursor) return;
    if (!target || !game.canPlaceInventoryCursor(target.area, target.index)) return;
    e.preventDefault(); e.stopPropagation();
    drag.current = { targets: [target], right: e.button === 2, held: game.inventory.cursor };
    target.element.dataset.dragSelected = 'true';
  };
}
