import { mergeable, type Stack } from './inventory';
import { stackLimit } from './items';

export type SlotAction = { type: 'quick' | 'collect' | 'offhand' } | { type: 'hotbar'; index: number } | { type: 'drop'; all: boolean };
export type SlotArea = 'inventory' | 'offhand' | 'grid' | 'armor' | 'chest' | 'furnace' | 'enchant' | 'anvil' | 'brewing';
export interface StackSlot {
  get(): Stack | null;
  set(stack: Stack | null): void;
  accepts?: (stack: Stack) => boolean;
  limit?: number;
}
export function arraySlots(slots: (Stack | null)[]): StackSlot[] {
  return slots.map((_, i) => ({ get: () => slots[i], set: (s) => { slots[i] = s; } }));
}
export function slotLimit(slot: StackSlot, stack: Stack): number {
  return slot.accepts?.(stack) === false ? 0 : Math.min(slot.limit ?? Infinity, stackLimit(stack.id));
}
/** Partial transfer, merging existing stacks before using empty cells. Never swaps. */
export function quickMove(source: StackSlot, targets: StackSlot[]): number {
  const stack = source.get();
  if (!stack) return 0;
  const before = stack.count;
  for (const empty of [false, true]) {
    for (const target of targets) {
      const existing = target.get();
      if (existing === stack || (existing === null) !== empty) continue;
      if (existing && !mergeable(existing, stack)) continue;
      const n = Math.min(stack.count, Math.max(0, slotLimit(target, stack) - (existing?.count ?? 0)));
      if (!n) continue;
      if (existing) { existing.count += n; target.set(existing); }
      else target.set({ ...stack, count: n, ...(stack.ench ? { ench: { ...stack.ench } } : {}) });
      stack.count -= n;
      if (!stack.count) { source.set(null); return before; }
    }
  }
  if (before !== stack.count) source.set(stack);
  return before - stack.count;
}
/** Atomic number-key swap: check both destinations before touching either stack. */
export function swapSlots(a: StackSlot, b: StackSlot): boolean {
  const x = a.get(), y = b.get();
  if (x === y) return false;
  if ((x && slotLimit(b, x) < x.count) || (y && slotLimit(a, y) < y.count)) return false;
  a.set(y); b.set(x);
  return true;
}
export function collectStacks(cursor: Stack | null, sources: StackSlot[]): number {
  if (!cursor) return 0;
  let moved = 0;
  for (const source of sources) {
    const s = source.get();
    if (!s || s === cursor || !mergeable(s, cursor)) continue;
    const n = Math.min(s.count, Math.max(0, stackLimit(cursor.id) - cursor.count));
    if (!n) continue;
    cursor.count += n; s.count -= n; moved += n;
    source.set(s.count ? s : null);
  }
  return moved;
}
