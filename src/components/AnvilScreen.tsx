import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { stackTooltip, TooltipBody } from '../utils/tooltip';
import type { Stack } from '../game/inventory';
import { displayName, durabilityMax } from '../game/items';

/**
 * 2.3 „Wyprawa i ratunek” – kowadło.
 *
 * Dwa sloty wejściowe i jeden wynik. Reguły (scalanie, przemianowywanie,
 * koszt poziomów) żyją w game/anvil.ts, ekran tylko je pokazuje.
 */
function Slot({
  stack,
  icons,
  onClick,
  onHover,
  label,
  empty,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
  label?: string;
  empty?: string;
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
        onMouseEnter={() => onHover?.(stackTooltip(stack, empty ?? ''))}
        onMouseLeave={() => onHover?.(null)}
      >
        {stack && <img src={icons[stack.id]} className="pixelated pointer-events-none" width={34} height={34} draggable={false} />}
        {stack && stack.count > 1 && <span className="mc-count">{stack.count}</span>}
        {stack?.ench && <span className="ench-glint" />}
        {stack?.dur !== undefined && durabilityMax(stack.id) > 0 && (
          <span className="dur-bar"><i style={{ width: `${Math.max(0, stack.dur / durabilityMax(stack.id)) * 100}%` }} /></span>
        )}
      </div>
      {label && <div className="text-center text-[11px] text-[#333]">{label}</div>}
    </div>
  );
}

export default function AnvilScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;
  const anvil = game.currentAnvil();
  const offer = game.anvilOffer();
  const affordable = game.canAnvilTake();

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };
  if (!anvil) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-2"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.closeInventory();
      }}
    >
      <div className="mc-panel flex max-h-[94dvh] w-[min(430px,96vw)] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Kowadło</div>
          <div className="text-xs text-[#444]">Poziom: {game.xp.info().level}</div>
        </div>

        <div className="flex items-end justify-center gap-3">
          <Slot
            stack={anvil.a}
            icons={icons}
            label="Przedmiot"
            empty="Włóż przedmiot (PPM na kowadle z nim w ręku)"
            onHover={setHover}
            onClick={(r) => { game.clickAnvilSlot('a', r); refresh(); }}
          />
          <Slot
            stack={anvil.b}
            icons={icons}
            label="Do połączenia"
            empty="Drugi przedmiot tego samego typu"
            onHover={setHover}
            onClick={(r) => { game.clickAnvilSlot('b', r); refresh(); }}
          />
          <div className="mb-6 text-2xl text-[#333]">→</div>
          <Slot
            stack={offer.out}
            icons={icons}
            label={offer.cost ? `Wynik · ${offer.cost} pkt` : 'Wynik'}
            onHover={setHover}
            onClick={() => { if (affordable && game.takeAnvilResult()) refresh(); }}
          />
        </div>

        {offer.label && (
          <div className="text-center text-xs text-[#333]">
            {offer.label}
            {offer.cost > 0 && !affordable && <span className="ml-1 font-bold text-[#a02020]">— za mało poziomów</span>}
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs text-[#333]">
          <span>Nazwa przedmiotu (max 28 znaków, 1 poziom doświadczenia)</span>
          <input
            className="mc-input"
            type="text"
            value={anvil.name}
            maxLength={32}
            placeholder={anvil.a ? displayName(anvil.a.id) : '…'}
            onChange={(e) => { game.setAnvilName(e.target.value); refresh(); }}
          />
        </label>

        <div className="max-w-[380px] text-xs text-[#333]">
          Dwa zniszczone narzędzia tego samego typu można połączyć: wytrzymałości się sumują, a zaklęcia zachowują najlepszy poziom. W polu nazwy nadaj przedmiotowi własne imię.
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
              onMouseEnter={() => setHover(stackTooltip(s))}
              onMouseLeave={() => setHover(null)}
            >
              {s && <img src={icons[s.id]} width={32} height={32} className="pixelated" draggable={false} />}
              {s && s.count > 1 && <span className="mc-count">{s.count}</span>}
              {s?.ench && <span className="ench-glint" />}
            </div>
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
