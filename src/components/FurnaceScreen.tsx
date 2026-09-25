import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { displayName } from '../game/items';
import type { Stack } from '../game/inventory';

function Slot({
  stack,
  icons,
  onClick,
  onHover,
  label,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="mc-slot cursor-pointer"
        onMouseDown={(e) => {
          e.preventDefault();
          onClick?.(e.button === 2);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={() => onHover?.(stack ? displayName(stack.id) : label ?? null)}
        onMouseLeave={() => onHover?.(null)}
      >
        {stack && <img src={icons[stack.id]} className="pixelated pointer-events-none" width={34} height={34} draggable={false} />}
        {stack && stack.count > 1 && <span className="mc-count">{stack.count}</span>}
      </div>
      {label && <div className="text-[11px] text-[#333]">{label}</div>}
    </div>
  );
}

export default function FurnaceScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
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
  const f = game.currentFurnace();
  if (!f) return null;
  const burn = f.burnMax > 0 ? f.burn / f.burnMax : 0;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.closeInventory();
      }}
    >
      <div className="mc-panel flex max-h-[94vh] flex-col gap-3 overflow-y-auto p-4">
        <div className="text-lg font-semibold">Piec</div>
        <div className="flex items-end justify-center gap-4">
          <Slot stack={f.input} icons={icons} label="Surowiec" onHover={setHover} onClick={(r) => { game.clickFurnace('input', r); refresh(); }} />
          <div className="mb-5 flex flex-col items-center gap-1">
            <div className="h-10 w-3 border-2 border-[#373737] bg-[#2a2a2a]">
              <div className="w-full bg-orange-500" style={{ height: `${burn * 100}%`, marginTop: `${(1 - burn) * 100}%` }} />
            </div>
            <div className="h-2 w-16 border border-[#373737] bg-[#555]">
              <div className="h-full bg-[#e8c15a]" style={{ width: `${Math.min(1, f.cook) * 100}%` }} />
            </div>
          </div>
          <Slot stack={f.fuel} icons={icons} label="Paliwo" onHover={setHover} onClick={(r) => { game.clickFurnace('fuel', r); refresh(); }} />
          <div className="mb-4 text-2xl text-[#333]">→</div>
          <Slot stack={f.output} icons={icons} label="Wynik" onHover={setHover} onClick={(r) => { game.clickFurnace('output', r); refresh(); }} />
        </div>
        <div className="max-w-[360px] text-xs text-[#333]">
          Przetapia rudę żelaza i złota, piasek na szkło, bruk na kamień, mięso oraz pnie na węgiel drzewny. Paliwo: węgiel, deski, patyki, pnie.
        </div>
        <div className="grid grid-cols-9">
          {inv.slots.map((s, i) => (
            <div
              key={i}
              className="mc-slot cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                inv.clickSlot(i, e.button === 2);
                refresh();
              }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseEnter={() => setHover(s ? displayName(s.id) : null)}
              onMouseLeave={() => setHover(null)}
            >
              {s && <img src={icons[s.id]} width={32} height={32} className="pixelated" draggable={false} />}
              {s && s.count > 1 && <span className="mc-count">{s.count}</span>}
            </div>
          ))}
        </div>
      </div>
      {hover && !inv.cursor && (
        <div className="pointer-events-none fixed z-50 px-2 py-1 text-sm" style={{ left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a', border: '2px solid #2a0f5f' }}>
          {hover}
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
