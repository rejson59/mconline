import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { CONTAINER, FURNACE, containerInvSlot } from '../game/containerLayout';
import { guiSprite } from '../game/art/uiSprites';
import { GuiInventory, GuiOverlay, GuiSlot, GuiWindow, useCursorPos, useGuiScale } from './GuiContainer';

/**
 * 2.28: piec 1:1 jak `FurnaceScreen` z Minecrafta.
 *
 * Panel `gui/container/furnace.png` (176 × 166): surowiec u góry, paliwo pod
 * nim, wynik po prawej. Płomień `lit_progress.png` (14 × 14) rośnie od dołu,
 * a strzałka `burn_progress.png` (24 × 16) zapełnia się od lewej – obie
 * na waniliowych współrzędnych (56, 36) i (79, 34).
 */
export default function FurnaceScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const mouse = useCursorPos();
  const scale = useGuiScale(CONTAINER.maxScale);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  const f = game.currentFurnace();
  if (!f) return null;
  const burn = f.burnMax > 0 ? Math.max(0, Math.min(1, f.burn / f.burnMax)) : 0;
  const cook = Math.max(0, Math.min(1, f.cook));
  const slots = Array.from({ length: 36 }, (_, i) => containerInvSlot(i));
  const lit = guiSprite('furnace_lit');
  const arrow = guiSprite('furnace_burn');
  const litH = Math.round(FURNACE.lit.h * burn);
  const cookW = Math.round(FURNACE.burn.w * cook);

  return (
    <>
      <GuiWindow sprite={FURNACE.sprite} title={FURNACE.title} scale={scale} onClose={() => game.closeInventory()}>
        <GuiSlot
          x={FURNACE.input.x}
          y={FURNACE.input.y}
          stack={f.input}
          icons={icons}
          onHover={setHover}
          onClick={(r) => { game.clickFurnace('input', r); refresh(); }}
        />
        <GuiSlot
          x={FURNACE.fuel.x}
          y={FURNACE.fuel.y}
          stack={f.fuel}
          icons={icons}
          onHover={setHover}
          onClick={(r) => { game.clickFurnace('fuel', r); refresh(); }}
        />
        <GuiSlot
          x={FURNACE.output.x}
          y={FURNACE.output.y}
          stack={f.output}
          icons={icons}
          onHover={setHover}
          onClick={(r) => { game.clickFurnace('output', r); refresh(); }}
        />

        {/* Płomień: wanilia rysuje dolny fragment sprite'a (od dołu do góry). */}
        {lit && litH > 0 && (
          <div
            aria-hidden
            style={{
              position: 'absolute', left: FURNACE.lit.x, top: FURNACE.lit.y + (FURNACE.lit.h - litH),
              width: FURNACE.lit.w, height: litH,
              backgroundImage: `url(${lit})`,
              backgroundSize: `${FURNACE.lit.w}px ${FURNACE.lit.h}px`,
              backgroundPosition: `0 -${FURNACE.lit.h - litH}px`,
              imageRendering: 'pixelated', pointerEvents: 'none',
            }}
          />
        )}
        {/* Strzałka postępu: widoczny lewy fragment `burn_progress.png`. */}
        {arrow && cookW > 0 && (
          <div
            aria-hidden
            style={{
              position: 'absolute', left: FURNACE.burn.x, top: FURNACE.burn.y,
              width: cookW, height: FURNACE.burn.h,
              backgroundImage: `url(${arrow})`,
              backgroundSize: `${FURNACE.burn.w}px ${FURNACE.burn.h}px`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated', pointerEvents: 'none',
            }}
          />
        )}

        <span style={{ position: 'absolute', left: 8, top: 74, fontSize: 7, lineHeight: '8px', color: '#5a5a5a' }}>
          {burn > 0 ? 'Piec pracuje…' : 'Piec wygasł – dołóż paliwo.'}
        </span>

        <GuiInventory game={game} icons={icons} slots={slots} onHover={setHover} onChange={refresh} />
      </GuiWindow>
      <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </>
  );
}
