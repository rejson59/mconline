import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import type { Stack } from '../game/inventory';
import { displayName } from '../game/items';
import { travelRecipe } from '../game/travelCauldron';
import { stackTooltip, TooltipBody } from '../utils/tooltip';
import Slot from './Slot';

/** Compact field station, intentionally smaller than a furnace or brewing stand. */
export default function TravelCauldronScreen({ game, icons, onChange }: {
  game: Game; icons: Record<number, string>; onChange: () => void;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [, tick] = useState(0);
  const inventory = game.inventory;
  useEffect(() => {
    const move = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    const interval = window.setInterval(() => tick((n) => n + 1), 160);
    window.addEventListener('mousemove', move);
    return () => { window.removeEventListener('mousemove', move); window.clearInterval(interval); };
  }, []);
  const refresh = () => { tick((n) => n + 1); onChange(); };
  const cauldron = game.currentTravelCauldron();
  if (!cauldron) return null;
  const recipe = cauldron.input ? travelRecipe(cauldron.input.id, cauldron.ingredient?.id ?? null) : null;
  const progress = recipe ? Math.min(100, Math.round(cauldron.progress / recipe.seconds * 100)) : 0;
  const slots: { id: 'input' | 'ingredient' | 'fuel' | 'output'; label: string; stack: Stack | null }[] = [
    { id: 'input', label: 'Mięso, warzywo / fiolka', stack: cauldron.input },
    { id: 'ingredient', label: 'Łza / cukier', stack: cauldron.ingredient },
    { id: 'fuel', label: 'Patyk / węgiel', stack: cauldron.fuel },
    { id: 'output', label: 'Wynik', stack: cauldron.output },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60" onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => { if (e.target === e.currentTarget) game.closeInventory(); }}>
      <div className="mc-panel flex max-h-[94vh] w-[min(96vw,610px)] flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <h2 className="text-lg font-semibold">Kocioł podróżny</h2>
        <p className="text-xs text-[#333]">Jedna porcja na raz · patyk albo węgiel zużywa się na początku gotowania/warzenia. Postęp i zawartość zapisują się w świecie.</p>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {slots.map(({ id, label, stack }) => (
            <div key={id} className="flex flex-col items-center gap-1 text-[11px] text-[#333]">
              <Slot stack={stack} icons={icons} imgSize={34} showCount
                onHover={() => setHover(stackTooltip(stack, label))}
                onClick={(right) => { game.clickTravelCauldron(id, right); refresh(); }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="h-3 w-full border border-[#373737] bg-[#555]" role="progressbar" aria-label="Postęp kociołka" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#e8c15a]" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-center text-xs text-[#333]" role="status">
          {recipe ? `${displayName(cauldron.input!.id)} → ${displayName(recipe.output)} · ${recipe.seconds} s${!cauldron.fuel && cauldron.progress <= 0 ? ' · brak paliwa' : ''}`
            : 'Mięso, marchew lub dynia bez składnika: 5 s. Fiolka wody + łza ghasta lub cukier: 9 s. Inne przepisy wymagają stałego pieca lub statywu.'}
        </div>
        <div className="grid grid-cols-9 self-center max-w-full overflow-x-auto">
          {inventory.slots.map((s, i) => (
            <Slot key={i} stack={s} icons={icons} onHover={() => setHover(stackTooltip(s))}
              onClick={(right) => { inventory.clickSlot(i, right); refresh(); }} />
          ))}
        </div>
        <button className="self-center border border-stone-500 px-3 py-1 text-sm" onClick={() => game.closeInventory()}>Zamknij · E / Esc</button>
      </div>
      {hover && !inventory.cursor && (
        <div className="pointer-events-none fixed z-50 max-w-[min(75vw,320px)] bg-[#1a0a2a] px-2 py-1 text-sm"
          style={{ left: mouse.x + 14, top: mouse.y - 28, whiteSpace: 'pre-line' }}><TooltipBody text={hover} /></div>
      )}
      {inventory.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x + 4, top: mouse.y + 4 }}>
          <img src={icons[inventory.cursor.id]} width={36} height={36} className="pixelated" alt={displayName(inventory.cursor.id)} />
          {inventory.cursor.count > 1 && <span className="mc-count">{inventory.cursor.count}</span>}
        </div>
      )}
    </div>
  );
}
