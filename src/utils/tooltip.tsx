import type { Stack } from '../game/inventory';
import { displayName } from '../game/items';
import { enchList } from '../game/enchant';

/** Tooltip text for a stack: name, then §5-prefixed enchantment lines. */
export function stackTooltip(s: Stack | null | undefined, fallback = ''): string {
  if (!s) return fallback;
  const list = enchList(s);
  return list.length ? `${displayName(s.id)}\n§5${list.join('\n')}` : displayName(s.id);
}

/** Renders the §5 marker as a purple span; everything else stays default. */
export function TooltipBody({ text }: { text: string }) {
  const parts = text.split('§5');
  return (
    <>
      {parts.map((part, i) =>
        i === 0 ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} className="ench-name">
            {i > 1 ? '\n' : ''}
            {part}
          </span>
        )
      )}
    </>
  );
}
