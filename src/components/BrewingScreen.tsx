import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import type { Stack } from '../game/inventory';
import { TooltipBody } from '../utils/tooltip';
import { I, displayName } from '../game/items';
import { BREW_TIME, BREWING_INGREDIENTS, POTIONS, brewResult, type BrewingState } from '../game/brewing';
import Slot from './Slot';

/**
 * 2.4 „Godzina alchemika” – statyw alchemiczny.
 *
 * Trzy fiolki, cup na składnik i podstawa na paliwo. Reguły warzenia żyją
 * w game/brewing.ts, ekran tylko je pokazuje i puszcza kursor między slotami.
 */
function LabeledSlot({
  stack,
  icons,
  onClick,
  onHover,
  label,
  active,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
  label?: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={active ? { boxShadow: '0 0 10px 2px rgba(150,220,120,0.8)' } : undefined}>
        <Slot stack={stack} icons={icons} onClick={onClick} onHover={onHover} imgSize={34} showCount />
      </div>
      {label && <div className="text-center text-[11px] text-[#333]">{label}</div>}
    </div>
  );
}

/** What a full batch would turn each bottle into (for the hint line). */
function brewPreview(s: BrewingState): string | null {
  if (!s.ingredient) return null;
  const next = s.bottles
    .map((b) => (b ? brewResult(b.id, s.ingredient!.id) : null))
    .filter((id): id is number => id !== null && id !== 0);
  if (!next.length) return null;
  const names = [...new Set(next)].map((id) => POTIONS[id]?.name ?? '').join(', ');
  return names;
}

export default function BrewingScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;
  const stand = game.currentBrewing();

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    window.addEventListener('mousemove', mm);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.clearInterval(id);
    };
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!stand) return null;
  const frac = Math.max(0, Math.min(1, stand.progress / BREW_TIME));
  const lit = stand.progress > 0;
  const preview = brewPreview(stand);
  const noFuel = stand.fuel === null;
  const hasFuelLeft = stand.fuelLeft > 0 || (stand.fuel !== null && stand.fuel.id === I.BLAZE_ROD);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-2"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.closeInventory();
      }}
    >
      <div className="mc-panel flex max-h-[94dvh] w-[min(440px,96vw)] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Statyw alchemiczny</div>
          <div className="text-xs text-[#444]">
            Paliwo: {stand.fuel ? `${stand.fuel.count} × różdżka` : 'brak'}
            {stand.fuelLeft > 0 ? ` (+${stand.fuelLeft} zapas)` : ''}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <LabeledSlot stack={stand.bottles[0]} icons={icons} label="Fiolka 1" active={lit} onHover={setHover} onClick={(r) => { game.clickBrewing('b0', r); refresh(); }} />
            <LabeledSlot stack={stand.bottles[1]} icons={icons} label="Fiolka 2" active={lit} onHover={setHover} onClick={(r) => { game.clickBrewing('b1', r); refresh(); }} />
            <LabeledSlot stack={stand.bottles[2]} icons={icons} label="Fiolka 3" active={lit} onHover={setHover} onClick={(r) => { game.clickBrewing('b2', r); refresh(); }} />
          </div>
          <div className="flex flex-col items-center gap-2 px-1">
            <div className="text-2xl text-[#333]">→</div>
            <div className="h-16 w-4 border-2 border-[#373737] bg-[#2a2a2a]">
              <div
                className="w-full"
                style={{
                  height: `${frac * 100}%`,
                  marginTop: `${(1 - frac) * 100}%`,
                  background: lit ? 'linear-gradient(0deg,#3dba3d,#9be86a)' : '#444',
                  transition: 'height 120ms linear',
                }}
              />
            </div>
            <div className="text-[11px] text-[#444]">{lit ? 'Warzenie…' : 'Gotowy'}</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LabeledSlot stack={stand.ingredient} icons={icons} label="Składnik" active={lit} onHover={setHover} onClick={(r) => { game.clickBrewing('ingredient', r); refresh(); }} />
            <div className="h-5" />
            <LabeledSlot stack={stand.fuel} icons={icons} label="Paliwo (różdżka)" active={lit} onHover={setHover} onClick={(r) => { game.clickBrewing('fuel', r); refresh(); }} />
          </div>
        </div>

        <div className="min-h-[16px] text-center text-xs text-[#333]">
          {noFuel
            ? 'Dość płomiennej różdżki, aby rozpalić kocioł.'
            : lit
              ? `Baza gotowa na: ${preview ?? 'brak'}.`
              : hasFuelLeft
                ? preview
                  ? `Nalej fiolki z wodą i warzy: ${preview}.`
                  : 'Dołóż fiolkę z wodą albo zaczarowany napój.'
                : 'Paliwo się skończyło – dołóż różdżkę.'}
        </div>

        <div className="max-w-[400px] text-xs text-[#333]">
          Fiolka napełnia się nad wodą (PPM na fiolce przy źródełku). Brodawka Netheru daje zaczarowany napój, z którego powstaną mocne eliksiry. Jedna różdżka = 3 warzenia.
        </div>

        <details className="border border-stone-500 p-2 text-xs text-[#292929]">
          <summary className="cursor-pointer">Przepisy i działanie napojów</summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {[I.WATER_BOTTLE, I.POTION_AWKWARD].flatMap((base) => [...BREWING_INGREDIENTS].map((ingredient) => {
              const output = brewResult(base, ingredient);
              return output === null ? null : (
                <li key={`${base}-${ingredient}`}>
                  {displayName(base)} + {displayName(ingredient)} → {POTIONS[output].name}: {POTIONS[output].desc}
                </li>
              );
            }))}
          </ul>
        </details>

        <div className="grid grid-cols-9">
          {inv.slots.map((s, i) => (
            <Slot
              key={i}
              stack={s}
              icons={icons}
              onHover={setHover}
              onClick={(r) => {
                inv.clickSlot(i, r);
                refresh();
              }}
            />
          ))}
        </div>
      </div>
      {hover && !inv.cursor && (
        <div className="pointer-events-none fixed z-50 max-w-[320px] px-2 py-1 text-sm" style={{ left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a', border: '2px solid #2a0f5f', whiteSpace: 'pre-line' }}>
          <TooltipBody text={hover} />
        </div>
      )}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 17, top: mouse.y - 17 }}>
          <img src={icons[inv.cursor.id]} width={34} height={34} className="pixelated" />
          {inv.cursor.count > 1 && <span className="mc-count">{inv.cursor.count}</span>}
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm mc-text opacity-80">E / Esc – zamknij</div>
    </div>
  );
}
