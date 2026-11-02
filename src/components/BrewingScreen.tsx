import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { I } from '../game/items';
import { POTIONS, brewResult, brewingFrame, type BrewingState } from '../game/brewing';
import { BREWING, CONTAINER, containerInvSlot } from '../game/containerLayout';
import { guiSprite } from '../game/art/uiSprites';
import { GuiInventory, GuiOverlay, GuiSlot, GuiWindow, useCursorPos, useGuiScale } from './GuiContainer';

/**
 * 2.28: statyw alchemiczny 1:1 jak `BrewingStandScreen` z Minecrafta.
 *
 * Panel `gui/container/brewing_stand.png` (176 × 166): trzy fiolki w literę V,
 * składnik u góry, płomienny proszek w lewym górnym slocie, pęcherzyki `bubbles.png`
 * (12 × 29) rosnące od dołu, pionowy pasek warzenia `brew_progress.png`
 * (9 × 28) i poziomy pasek paliwa `fuel_length.png` (18 × 4) – wszystkie
 * na waniliowych współrzędnych.
 */
function brewPreview(s: BrewingState): string | null {
  if (!s.ingredient) return null;
  const next = s.bottles
    .map((b) => (b ? brewResult(b.id, s.ingredient!.id) : null))
    .filter((id): id is number => id !== null && id !== 0);
  if (!next.length) return null;
  return [...new Set(next)].map((id) => POTIONS[id]?.name ?? '').join(', ');
}

/** Warstwy sprite'a, które rosną od dołu (przycinamy górną część obrazka). */
function rising(sprite: string | null, x: number, y: number, w: number, h: number, visible: number, axis: 'bottom'|'top'|'left' = 'bottom') {
  if (!sprite || visible <= 0) return null;
  const clip = axis === 'bottom' ? `inset(${h-visible}px 0 0 0)` : axis === 'top' ? `inset(0 0 ${h-visible}px 0)` : `inset(0 ${w-visible}px 0 0)`;
  return (
    <div
      key={`${x},${y}`} data-java-brew-crop={`${axis}:${visible}`}
      style={{
        position: 'absolute', left: x, top: y, width: w, height: h,
        backgroundImage: `url(${sprite})`, backgroundSize: `${w}px ${h}px`,
        clipPath: clip, imageRendering: 'pixelated', pointerEvents: 'none',
      }}
    />
  );
}

export default function BrewingScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const mouse = useCursorPos();
  const scale = useGuiScale(CONTAINER.maxScale);
  const stand = game.currentBrewing();

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!stand) return null;

  const frame = brewingFrame(stand), lit = frame.lit;
  const preview = brewPreview(stand);
  const noFuel = stand.fuel === null;
  const hasFuelLeft = stand.fuelLeft > 0 || stand.fuel?.id === I.BLAZE_POWDER;
  const slots = Array.from({ length: 36 }, (_, i) => containerInvSlot(i));
  const hint = noFuel && !hasFuelLeft
    ? 'Potrzebny płomienny proszek.'
    : lit
      ? `Warzenie… ${preview ?? ''}`
      : hasFuelLeft
        ? preview
          ? `Gotowe do warzenia: ${preview}.`
          : 'Dołóż butelkę wody albo klarowną miksturę.'
        : 'Paliwo się skończyło – dołóż płomienny proszek.';

  return (
    <>
      <GuiWindow game={game} onChange={refresh} sprite={BREWING.sprite} title={BREWING.title} scale={scale} onClose={() => game.closeInventory()}>
        {stand.bottles.map((b, i) => {
          const p = BREWING.bottles[i];
          return (
            <GuiSlot slotArea="brewing" slotIndex={i}
              key={i}
              x={p.x}
              y={p.y}
              stack={b}
              icons={icons}
              onHover={setHover}
              onAction={(a) => { game.inventoryAction('brewing', i, a); refresh(); }}
              onClick={(r) => { game.clickBrewing((['b0', 'b1', 'b2'] as const)[i], r); refresh(); }}
            />
          );
        })}
        <GuiSlot slotArea="brewing" slotIndex={3}
          x={BREWING.ingredient.x}
          y={BREWING.ingredient.y}
          stack={stand.ingredient}
          icons={icons}
          onHover={setHover}
          onAction={(a) => { game.inventoryAction('brewing', 3, a); refresh(); }}
          onClick={(r) => { game.clickBrewing('ingredient', r); refresh(); }}
        />
        <GuiSlot slotArea="brewing" slotIndex={4}
          x={BREWING.fuel.x}
          y={BREWING.fuel.y}
          stack={stand.fuel}
          icons={icons}
          dim={noFuel}
          onHover={(t) => setHover(`${t ?? 'Paliwo'}${hasFuelLeft ? `\n§7zapas: ${stand.fuelLeft}` : ''}`)}
          onAction={(a) => { game.inventoryAction('brewing', 4, a); refresh(); }}
          onClick={(r) => { game.clickBrewing('fuel', r); refresh(); }}
        />

        {/* Pęcherzyki i postęp warzenia – jak `blit` w waniliowym ekranie. */}
        {lit && rising(guiSprite('brewing_bubbles'), BREWING.bubbles.x, BREWING.bubbles.y, BREWING.bubbles.w, BREWING.bubbles.h, frame.bubbles)}
        {rising(guiSprite('brewing_progress'), BREWING.progress.x, BREWING.progress.y, BREWING.progress.w, BREWING.progress.h, frame.progress, 'top')}
        {rising(
          guiSprite('brewing_fuel'),
          BREWING.fuelBar.x,
          BREWING.fuelBar.y,
          BREWING.fuelBar.w,
          BREWING.fuelBar.h,
          frame.fuel,
          'left'
        )}

        {/* Keep guidance accessible without adding non-native text to the panel. */}
        <span className="sr-only" role="status">{hint}</span>

        <GuiInventory game={game} icons={icons} slots={slots} onHover={setHover} onChange={refresh} />
      </GuiWindow>
      <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </>
  );
}
