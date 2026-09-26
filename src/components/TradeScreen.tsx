import { useEffect, useState } from 'react';
import type { Game, TradeRow } from '../game/engine';
import { displayName, stackLimit } from '../game/items';
import { PROFESSIONS, VILLAGER_LEVEL_NAMES } from '../game/trading';
import type { Stack } from '../game/inventory';
import { TooltipBody } from '../utils/tooltip';

function ItemChip({ stack, icons, have, ok }: { stack: Stack; icons: Record<number, string>; have?: number; ok?: boolean }) {
  return (
    <span className="relative flex items-center gap-1" title={displayName(stack.id)}>
      <img src={icons[stack.id]} className="pixelated" width={26} height={26} draggable={false} />
      <span className="text-sm font-semibold" style={{ color: ok === false ? '#a02020' : '#1c1c1c' }}>
        ×{stack.count}
      </span>
      {have !== undefined && (
        <span className="text-[11px]" style={{ color: ok ? '#2a6a2a' : '#8a3a3a' }}>
          (masz {have})
        </span>
      )}
    </span>
  );
}

/** Jedna oferta mieszkańca: co oddajesz → co dostajesz + pasek zapasów. */
function OfferRow({
  game,
  row,
  icons,
  onDone,
  onHover,
}: {
  game: Game;
  row: TradeRow;
  icons: Record<number, string>;
  onDone: () => void;
  onHover: (text: string | null) => void;
}) {
  const { offer, left, max, blocked } = row;
  const disabled = blocked !== 'ok';
  const inv = game.inventory;
  const reason = blocked === 'uses' ? 'Zapasy wyczerpane' : blocked === 'items' ? 'Brak towaru' : '';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (game.tradeWith(row.index)) onDone(); }}
      onMouseEnter={() =>
        onHover(
          `${offer.give.map((g) => `${g.count}× ${displayName(g.id)}`).join(' + ')} → ${offer.get.count}× ${displayName(offer.get.id)}` +
            (reason ? `\n${reason}` : '')
        )
      }
      onMouseLeave={() => onHover(null)}
      className="flex w-full items-center justify-between gap-3 border-2 border-[#555] px-3 py-2 text-left"
      style={{
        background: disabled ? '#a9a9a9' : offerBackground(left, max),
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span className="flex flex-wrap items-center gap-2">
        {offer.give.map((g, i) => (
          <ItemChip key={`g${i}`} stack={g} icons={icons} have={inv.countOf(g.id)} ok={inv.countOf(g.id) >= g.count} />
        ))}
        <span className="text-lg text-[#333]">→</span>
        <ItemChip stack={offer.get} icons={icons} />
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-[11px] text-[#333]">
          {left}/{max}
        </span>
        <span className="h-1.5 w-16 border border-[#555]" style={{ background: '#6d6d6d' }}>
          <span className="block h-full" style={{ width: `${(left / max) * 100}%`, background: left > 0 ? '#5fbf46' : '#b03030' }} />
        </span>
      </span>
      {reason && <span className="ml-2 shrink-0 text-[11px] text-[#7a2020]">{reason}</span>}
    </button>
  );
}

/** Zielone tło oferty – ciemniejsze, gdy zapasy się kończą. */
function offerBackground(left: number, max: number): string {
  if (left <= 0) return '#bdbdbd';
  return left / max > 0.5 ? '#9fd39a' : '#c8d79a';
}

export default function TradeScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;
  const mob = game.tradeMob;

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  const profession = mob?.trade ? PROFESSIONS[mob.trade.profession] : null;
  const level = game.tradeLevel();
  const rows = game.tradeRows();
  const restock = Math.ceil(game.tradeRestockIn());

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.closeTrade();
      }}
    >
      <div className="mc-panel flex max-h-[94vh] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-baseline justify-between gap-6">
          <span className="flex items-center gap-2 text-lg font-semibold">
            <span style={{ width: 12, height: 12, background: profession?.color ?? '#4f8a3a', border: '2px solid #333' }} />
            {game.tradeTitle()}
          </span>
          <span className="text-xs text-[#444]">
            {VILLAGER_LEVEL_NAMES[level - 1]} · poziom {level} · uzupełnienie za {restock}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#444]">Doświadczenie mieszkańca</span>
          <span className="h-2 w-40 border-2 border-[#555] bg-[#7d7d7d]">
            <span className="block h-full bg-[#3dba3d]" style={{ width: `${Math.round(game.tradeProgress() * 100)}%` }} />
          </span>
        </div>

        <div className="flex w-[520px] max-w-full flex-col gap-2">
          {rows.map((r) => (
            <OfferRow key={r.offer.key} game={game} row={r} icons={icons} onDone={refresh} onHover={setHover} />
          ))}
          {rows.length === 0 && (
            <div className="border-2 border-[#777] bg-[#8b8b8b] px-3 py-4 text-center text-sm text-[#333]">
              Ten mieszkaniec nie ma teraz nic do zaoferowania.
            </div>
          )}
        </div>

        <div className="max-w-[520px] text-xs text-[#333]">
          Mieszkańcy płacą szmaragdami za surowce i sprzedają towary, których nie zdobędziesz od ręki. Każda wymiana zużywa
          zapas oferty i daje mieszkańcowi doświadczenie – po awansie odblokowuje lepsze oferty. Po pewnym czasie zapasy wracają.
          {game.mode === 'creative' ? ' W trybie kreatywnym towar jest darmowy.' : ''}
        </div>

        <div className="text-sm font-semibold">Ekwipunek</div>
        <div className="grid grid-cols-9">
          {inv.slots.map((s, i) => (
            <div
              key={i}
              className="mc-slot cursor-pointer"
              onMouseDown={(e) => { e.preventDefault(); inv.clickSlot(i, e.button === 2); refresh(); }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseEnter={() => setHover(s ? `${displayName(s.id)}${s.count > 1 ? ` ×${s.count}` : ''}` : null)}
              onMouseLeave={() => setHover(null)}
            >
              {s && <img src={icons[s.id]} className="pixelated pointer-events-none" width={34} height={34} draggable={false} />}
              {s && s.count > 1 && <span className="mc-count">{s.count}</span>}
              {s?.ench && <span className="ench-glint" />}
              {s && stackLimit(s.id) === 1 && s.dur !== undefined && <span className="dur-bar"><i style={{ width: '100%', background: '#3dba3d' }} /></span>}
            </div>
          ))}
        </div>
      </div>

      {hover && !inv.cursor && (
        <div
          className="pointer-events-none fixed z-50 max-w-[320px] px-2 py-1 text-sm"
          style={{ left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a', border: '2px solid #2a0f5f', whiteSpace: 'pre-line' }}
        >
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
