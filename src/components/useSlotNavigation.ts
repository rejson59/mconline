import { useEffect, useRef, type PointerEvent } from 'react';
import type { SlotAction } from '../game/inventoryNavigation';

// Only the hovered/focused slot receives keyboard actions, not both at once.
let activeSlot: symbol | null = null;
export function slotKeyAction(code: string, ctrl = false): SlotAction | null {
  if (/^Digit[1-9]$/.test(code)) return { type: 'hotbar', index: Number(code.slice(5)) - 1 };
  return code === 'KeyQ' ? { type: 'drop', all: ctrl } : null;
}
export function useSlotNavigation(onAction?: (action: SlotAction) => void) {
  const id = useRef(Symbol('slot'));
  const action = useRef(onAction);
  action.current = onAction;
  const lastClick = useRef(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (activeSlot !== id.current || !action.current || e.repeat || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      const a = slotKeyAction(e.code, e.ctrlKey);
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      action.current(a);
    };
    window.addEventListener('keydown', key, true);
    const token = id.current;
    return () => {
      window.removeEventListener('keydown', key, true);
      if (activeSlot === token) activeSlot = null;
    };
  }, []);
  return {
    enter: () => { if (onAction) activeSlot = id.current; },
    leave: () => { if (activeSlot === id.current) activeSlot = null; lastClick.current = 0; },
    pointer: (e: PointerEvent): boolean => {
      if (!onAction || e.pointerType !== 'mouse') return false;
      if (e.shiftKey) {
        lastClick.current = 0;
        onAction({ type: 'quick' }); return true;
      }
      const now = performance.now();
      if (e.button === 0 && lastClick.current > 0 && now - lastClick.current < 250) {
        lastClick.current = 0;
        onAction({ type: 'collect' }); return true;
      }
      lastClick.current = e.button === 0 ? now : 0;
      return false;
    },
  };
}
