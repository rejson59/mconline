import { useState } from 'react';
import type { Game } from '../game/engine';
import { CHEST, chestSlot, containerInvSlot } from '../game/containerLayout';
import { GuiInventory, GuiOverlay, GuiSlot, GuiWindow, useCursorPos, useGuiScale } from './GuiContainer';

/**
 * 2.28.1: skrzynia 1:1 jak `GenericContainerScreen` z Minecrafta.
 *
 * Wanilia skleja panel z dwóch fragmentów `generic_54.png`: górną część
 * 176 × 71 i pasek ekwipunku 176 × 96 (kompilator robi z tego jeden obrazek).
 * Siatka 9 × 3 leży na (8, 18), wiersz co 18 px, a ekwipunek gracza wraca
 * na swoje miejsce (8, 84) + pasek skrótów (8, 142).
 */
export default function ChestScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const mouse = useCursorPos();
  const scale = useGuiScale(2, 84, CHEST.height);
  const chest = game.currentChest();

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!chest) return null;

  const slots = Array.from({ length: 36 }, (_, i) => containerInvSlot(i));

  return (
    <>
      <GuiWindow game={game} onChange={refresh}
        sprite={CHEST.sprite}
        title={CHEST.title}
        scale={scale}
        height={CHEST.height}
        onClose={() => game.closeInventory()}
      >
        {chest.slots.map((s, i) => {
          const p = chestSlot(i);
          return (
            <GuiSlot slotArea="chest" slotIndex={i}
              key={i}
              x={p.x}
              y={p.y}
              stack={s}
              icons={icons}
              onHover={setHover}
              onAction={(a) => { game.inventoryAction('chest', i, a); refresh(); }}
              onClick={(r) => { game.clickChest(i, r); refresh(); }}
            />
          );
        })}
        <GuiInventory game={game} icons={icons} slots={slots} onHover={setHover} onChange={refresh} />
      </GuiWindow>
      <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </>
  );
}
