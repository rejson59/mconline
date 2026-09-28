import type { Stack } from '../game/inventory';
import { displayName, I } from '../game/items';
import { enchList } from '../game/enchant';
import { POTIONS } from '../game/brewing';

const SPECIAL_BOOTS: Record<number, string> = {
  [I.EMBER_BOOTS]: '24% mniej obrażeń od żaru (lawa, magma, ognisko).',
  [I.TIDE_BOOTS]: '35% szybszy ruch wyłącznie w wodzie.',
  [I.SOFT_BOOTS]: '40% mniej obrażeń od upadku.',
};

/** Tooltip text for a stack: name, then §5-prefixed enchantment lines. */
export function stackTooltip(s: Stack | null | undefined, fallback = ''): string {
  if (!s) return fallback;
  const list = enchList(s);
  // 2.3: przedmiot przemieniony w kowadle ma własną nazwę (jak w klasyku).
  const name = s.name ? `§e${s.name}§r\n${displayName(s.id)}` : displayName(s.id);
  // 2.4: napoje opowiadają o swoim wzmocnieniu
  const potion = POTIONS[s.id];
  const desc = potion ? `\n§7${potion.desc}` : SPECIAL_BOOTS[s.id] ? `\n${SPECIAL_BOOTS[s.id]}` :
    s.id === I.IRON_SPEAR ? '\nZasięg 5 bloków, 7 obrażeń, 0,92 s między ciosami.' : '';
  return list.length ? `${name}\n§5${list.join('\n')}${desc}` : `${name}${desc}`;
}

/** Renders the §5 marker as a purple span; everything else stays default. */
export function TooltipBody({ text }: { text: string }) {
  const parts = text.split('§5');
  return (
    <>
      {parts.map((part, i) =>
        i === 0 ? (
          <span key={i}>{renderNames(part)}</span>
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

/** Splits a chunk on the §e / §r markers used for anvil item names. */
function renderNames(text: string) {
  return text.split(/§[er]/).map((part, i) =>
    i === 1 ? <span key={i} className="item-name">{part}</span> : <span key={i}>{part}</span>
  );
}
