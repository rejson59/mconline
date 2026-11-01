import { useState } from 'react';
import type { Game } from '../game/engine';
import { I } from '../game/items';
import { enchDef, enchName, type EnchOption } from '../game/enchant';
import { CONTAINER, ENCHANT, containerInvSlot } from '../game/containerLayout';
import { guiSprite } from '../game/art/uiSprites';
import { GuiInventory, GuiOverlay, GuiSlot, GuiWindow, guiText, useCursorPos, useGuiScale } from './GuiContainer';

/**
 * 2.28: stół zaklęć 1:1 jak `EnchantmentScreen` z Minecrafta.
 *
 * Panel `gui/container/enchanting_table.png` (176 × 166), slot na przedmiot
 * i lazuryt po lewej, a po prawej trzy przyciski ofert z paczki
 * (`enchantment_slot.png`, 108 × 19) – dokładnie na wysokościach wanilii
 * (13, 32, 51). Koszt w poziomach piszemy po prawej stronie wiersza, jak gra.
 */
function Offer({
  option, index, disabled, reason, onPick, onHover,
}: {
  option: EnchOption;
  index: number;
  disabled: boolean;
  reason: string;
  onPick: () => void;
  onHover: (text: string | null) => void;
}) {
  const pos = ENCHANT.offers[index] ?? ENCHANT.offers[0];
  const def = enchDef(option.ench);
  const bg = guiSprite(disabled ? 'enchant_slot_disabled' : 'enchant_slot');
  const name = enchName(option.ench, option.level);
  const desc = def?.desc(option.level) ?? '';
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${name} – ${option.cost} poziomów, ${option.lapis} lazurytu`}
      onClick={onPick}
      onMouseEnter={() => onHover(`${name}\n§7${desc}\n§7Koszt: ${option.cost} pkt · lazuryt: ${option.lapis}${disabled && reason ? `\n§7${reason}` : ''}`)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: ENCHANT.offerW, height: ENCHANT.offerH,
        backgroundImage: bg ? `url(${bg})` : undefined,
        backgroundSize: '100% 100%', backgroundColor: bg ? undefined : disabled ? '#8b8b8b' : '#6f5a3a',
        imageRendering: 'pixelated', border: 'none', padding: 0,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.85 : 1,
        textAlign: 'left', overflow: 'hidden',
      }}
    >
      <span
        style={{
          ...guiText(disabled ? '#6a6a6a' : '#3f3f3f'),
          position: 'absolute', left: 6, top: 5, maxWidth: 74, overflow: 'hidden',
          textOverflow: 'ellipsis', fontWeight: 700,
        }}
      >
        {name}
      </span>
      <span
        style={{
          ...guiText(disabled ? '#7a7a7a' : '#2a6a1a'),
          position: 'absolute', right: 4, top: 5, fontWeight: 700,
        }}
      >
        {option.cost}
      </span>
      {/* Poziom zaklęcia – waniliowa cyfra rzymska w prawym dolnym rogu. */}
      <span style={{ ...guiText(disabled ? '#7a7a7a' : '#5a4a20'), position: 'absolute', right: 4, bottom: 3, fontSize: 6 }}>
        {['I', 'II', 'III', 'IV', 'V'][Math.min(4, Math.max(0, option.level - 1))]}
      </span>
    </button>
  );
}

export default function EnchantScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const mouse = useCursorPos();
  const scale = useGuiScale(CONTAINER.maxScale);
  const inv = game.inventory;

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  const item = game.enchantItem;
  const options = game.enchOptions;
  const power = game.enchantPower();
  const level = game.xp.info().level;
  const lapis = inv.countOf(I.LAPIS);
  const creative = game.mode === 'creative';
  const slots = Array.from({ length: 36 }, (_, i) => containerInvSlot(i));

  const reasonFor = (i: number): string => {
    const opt = options[i];
    if (!opt) return '';
    if (!item) return 'Wrzuć przedmiot';
    if (!game.canEnchantWith(i)) {
      if (!creative && level < opt.cost) return `Potrzebne ${opt.cost} pkt`;
      if (!creative && lapis < opt.lapis) return `Brak lazurytu (${opt.lapis})`;
      return 'Niedostępne';
    }
    return '';
  };

  return (
    <>
      <GuiWindow game={game} onChange={refresh} sprite={ENCHANT.sprite} title={ENCHANT.title} scale={scale} onClose={() => game.closeInventory()}>
        <GuiSlot slotArea="enchant" slotIndex={0}
          x={ENCHANT.item.x}
          y={ENCHANT.item.y}
          stack={item}
          icons={icons}
          onHover={setHover}
          onAction={(a) => { game.inventoryAction('enchant', 0, a); refresh(); }}
          onClick={(r) => { game.clickEnchantSlot(r); refresh(); }}
        />
        <GuiSlot
          x={ENCHANT.lapis.x}
          y={ENCHANT.lapis.y}
          stack={{ id: I.LAPIS, count: Math.max(0, lapis) }}
          icons={icons}
          dim={lapis === 0}
          onHover={(t) => setHover(lapis > 0 ? t : 'Lazuryt – potrzebny do zaklęć')}
        />

        {options.length === 0 && (
          <span
            style={{
              ...guiText('#3f3f3f'), position: 'absolute', left: ENCHANT.offers[0].x + 4, top: ENCHANT.offers[0].y + 4,
              width: 100, whiteSpace: 'normal', lineHeight: '9px',
            }}
          >
            {item ? 'Ten przedmiot nie przyjmuje zaklęć.' : 'Umieść narzędzie, broń lub element pancerza.'}
          </span>
        )}
        {options.slice(0, 3).map((opt, i) => (
          <Offer
            key={i}
            index={i}
            option={opt}
            disabled={!game.canEnchantWith(i)}
            reason={reasonFor(i)}
            onPick={() => { if (game.enchantWith(i)) refresh(); }}
            onHover={setHover}
          />
        ))}

        {/* Liczba biblioteczek i poziom – jak waniliowy podpis pod tytułem. */}
        <span style={{ ...guiText('#5a5a5a'), position: 'absolute', left: 8, top: 16 }}>
          Biblioteczki: {power}/15 · Poziom: {level}
        </span>

        <GuiInventory game={game} icons={icons} slots={slots} onHover={setHover} onChange={refresh} />
      </GuiWindow>
      <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </>
  );
}
