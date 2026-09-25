import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { displayName } from '../game/items';
import type { Stack } from '../game/inventory';

function Slot({
  stack,
  icons,
  onClick,
  onHover,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
}) {
  return (
    <div
      className="mc-slot cursor-pointer"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.(e.button === 2);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHover?.(stack ? displayName(stack.id) : null)}
      onMouseLeave={() => onHover?.(null)}
    >
      {stack && <img src={icons[stack.id]} className="pixelated pointer-events-none" width={32} height={32} draggable={false} />}
      {stack && stack.count > 1 && <span className="mc-count">{stack.count}</span>}
    </div>
  );
}

export default function ChestScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;
  const chest = game.currentChest();

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!chest) return null;

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
        <div className="text-lg font-semibold">Skrzynia</div>
        <div className="grid grid-cols-9">
          {chest.slots.map((s, i) => (
            <Slot key={i} stack={s} icons={icons} onHover={setHover} onClick={(r) => { game.clickChest(i, r); refresh(); }} />
          ))}
        </div>
        <div className="text-sm font-semibold">Ekwipunek</div>
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
