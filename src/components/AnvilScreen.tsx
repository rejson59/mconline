import { useState } from 'react';
import type { Game } from '../game/engine';
import { displayName } from '../game/items';
import { ANVIL, CONTAINER, containerInvSlot } from '../game/containerLayout';
import { guiSprite } from '../game/art/uiSprites';
import { GuiInventory, GuiOverlay, GuiSlot, GuiWindow, guiText, useCursorPos, useGuiScale } from './GuiContainer';

/**
 * 2.28: kowadło 1:1 jak `AnvilScreen` z Minecrafta.
 *
 * Panel `gui/container/anvil.png` (176 × 166), dwa sloty wejściowe i wynik
 * dokładnie tam, gdzie w wanilii, pole nazwy na tle `anvil/text_field.png`
 * i koszt w poziomach pod wynikiem – zielony, gdy gracz ma dość doświadczenia,
 * czerwony, gdy brakuje. Reguły (scalanie, przemianowywanie, koszt) dalej
 * żyją w `game/anvil.ts`; ekran tylko je pokazuje.
 */
export default function AnvilScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const mouse = useCursorPos();
  const scale = useGuiScale(CONTAINER.maxScale);
  const anvil = game.currentAnvil();
  const offer = game.anvilOffer();
  const affordable = game.canAnvilTake();

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!anvil) return null;

  const field = guiSprite('anvil_text_field');
  const cost = offer.cost;
  const slots = Array.from({ length: 36 }, (_, i) => containerInvSlot(i));
  const placeholder = anvil.a ? displayName(anvil.a.id) : '';
  const title = offer.label
    ? `${offer.label}${cost > 0 && !affordable ? ' — za mało poziomów' : ''}`
    : 'Połącz dwa przedmioty tego samego typu, żeby naprawić narzędzie.';

  return (
    <>
    <GuiWindow sprite={ANVIL.sprite} title={ANVIL.title} scale={scale} onClose={() => game.closeInventory()}>
      {/* Tło pola nazwy – waniliowy sprite 110 × 16 z paczki. */}
      <div
        style={{
          position: 'absolute', left: ANVIL.field.x, top: ANVIL.field.y,
          width: ANVIL.field.w, height: ANVIL.field.h,
          backgroundImage: field ? `url(${field})` : undefined,
          backgroundSize: '100% 100%', backgroundColor: field ? undefined : '#000',
          imageRendering: 'pixelated', pointerEvents: 'none',
        }}
      />
      <input
        aria-label="Nazwa przedmiotu"
        maxLength={32}
        value={anvil.name}
        placeholder={placeholder}
        title="Nazwa przedmiotu (max 28 znaków, 1 poziom doświadczenia)"
        onChange={(e) => { game.setAnvilName(e.target.value); refresh(); }}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', left: ANVIL.name.x, top: ANVIL.name.y,
          width: ANVIL.name.w, height: ANVIL.name.h,
          background: 'transparent', border: 'none', outline: 'none',
          color: '#e0e0e0', fontSize: 8, lineHeight: '12px', padding: 0,
          fontFamily: 'inherit', textShadow: '1px 1px 0 #000',
        }}
      />

      {/* Sloty: przedmiot + drugi przedmiot + wynik. */}
      <GuiSlot
        x={ANVIL.slotA.x}
        y={ANVIL.slotA.y}
        stack={anvil.a}
        icons={icons}
        onHover={setHover}
        onClick={(r) => { game.clickAnvilSlot('a', r); refresh(); }}
      />
      <GuiSlot
        x={ANVIL.slotB.x}
        y={ANVIL.slotB.y}
        stack={anvil.b}
        icons={icons}
        onHover={setHover}
        onClick={(r) => { game.clickAnvilSlot('b', r); refresh(); }}
      />
      <GuiSlot
        x={ANVIL.output.x}
        y={ANVIL.output.y}
        stack={offer.out}
        icons={icons}
        dim={!!offer.out && !affordable}
        onHover={(t) => {
          if (!offer.out) setHover(t);
          else setHover(`${t ?? ''}\n${cost > 0 ? `Koszt: ${cost} poziomów` : 'Bez kosztu'}`.trim());
        }}
        onClick={() => { if (affordable && game.takeAnvilResult()) refresh(); }}
      />

      {/* Koszt w poziomach – wanilia rysuje go pod wynikiem, przy prawej. */}
      {cost > 0 && (
        <span
          style={{
            ...guiText(affordable ? '#80ff20' : '#ff6060'),
            position: 'absolute', right: 176 - ANVIL.cost.right, top: ANVIL.cost.y,
            textShadow: '1px 1px 0 #3f3f3f',
          }}
        >
          {cost}
        </span>
      )}

      {/* Krótki opis efektu – zamiast dużego bloku tekstu z poprzedniej wersji. */}
      <span
        style={{
          ...guiText('#5a5a5a'),
          position: 'absolute', left: ANVIL.slotA.x, top: 74,
          maxWidth: 140, whiteSpace: 'normal', lineHeight: '9px',
        }}
        title={title}
      >
        {offer.label ?? ''}
      </span>

      <GuiInventory game={game} icons={icons} slots={slots} onHover={setHover} onChange={refresh} />
    </GuiWindow>
    <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </>
  );
}
