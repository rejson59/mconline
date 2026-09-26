import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { displayName, I } from '../game/items';
import type { Stack } from '../game/inventory';
import { enchDef, enchName, type EnchOption } from '../game/enchant';
import { TooltipBody } from '../utils/tooltip';

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
        {stack?.ench && <span className="ench-glint" />}
      </div>
      {label && <div className="text-[11px] text-[#333]">{label}</div>}
    </div>
  );
}

/** One offer row: enchant name, level, cost in levels + lapis. */
function Offer({
  option,
  disabled,
  reason,
  onClick,
  onHover,
}: {
  option: EnchOption;
  disabled: boolean;
  reason: string;
  onClick: () => void;
  onHover: (text: string | null) => void;
}) {
  const def = enchDef(option.ench);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => onHover(`${enchName(option.ench, option.level)} – ${def?.desc(option.level) ?? ''}`)}
      onMouseLeave={() => onHover(null)}
      className="flex w-full items-center justify-between gap-3 border-2 border-[#555] px-3 py-2 text-left"
      style={{
        background: disabled ? '#a9a9a9' : '#9fd39a',
        opacity: disabled ? 0.65 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span className="font-semibold text-[#1c1c1c]">{enchName(option.ench, option.level)}</span>
      <span className="flex items-center gap-2 text-sm text-[#333]">
        <span className="text-[#6b3fa0]">{option.cost} pkt</span>
        <span className="text-[#2a4fa0]">{option.lapis}◆</span>
        {disabled && <span className="text-xs">{reason}</span>}
      </span>
    </button>
  );
}

export default function EnchantScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const inv = game.inventory;

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  const item = game.enchantItem;
  const options = game.enchOptions;
  const power = game.enchantPower();
  const level = game.xp.info().level;
  const lapis = inv.countOf(I.LAPIS);
  const creative = game.mode === 'creative';

  const reasonFor = (i: number): string => {
    const opt = options[i];
    if (!opt) return '';
    if (!item) return 'Wrzuć przedmiot';
    if (item && !game.canEnchantWith(i)) {
      if (!creative && level < opt.cost) return `Potrzebne ${opt.cost} pkt`;
      if (!creative && lapis < opt.lapis) return `Brak lazurytu (${opt.lapis})`;
      return 'Niedostępne';
    }
    return '';
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) game.closeInventory();
      }}
    >
      <div className="mc-panel flex max-h-[94vh] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-lg font-semibold">Stół zaklęć</span>
          <span className="text-xs text-[#444]">Biblioteczki: {power}/15 · Poziom: {level} · Lazuryt: {lapis}</span>
        </div>

        <div className="flex items-center gap-6">
          <Slot stack={item} icons={icons} label="Przedmiot" onHover={setHover} onClick={(r) => { game.clickEnchantSlot(r); refresh(); }} />
          <span className="mb-4 text-2xl text-[#333]">→</span>
          <div className="flex w-[300px] flex-col gap-2">
            {options.length === 0 && (
              <div className="border-2 border-[#777] bg-[#8b8b8b] px-3 py-4 text-center text-sm text-[#333]">
                {item ? 'Ten przedmiot nie przyjmuje żadnych zaklęć.' : 'Umieść tu narzędzie, broń lub element pancerza.'}
              </div>
            )}
            {options.map((opt, i) => (
              <Offer
                key={i}
                option={opt}
                disabled={!game.canEnchantWith(i)}
                reason={reasonFor(i)}
                onClick={() => { if (game.enchantWith(i)) refresh(); }}
                onHover={setHover}
              />
            ))}
          </div>
        </div>

        <div className="max-w-[460px] text-xs text-[#333]">
          Wybór zaklęć zależy od liczby biblioteczek ustawionych w pierścieniu wokół stołu (maks. 15) oraz twojego poziomu.
          Każde zaklęcie zużywa punkty doświadczenia i lazuryt (1–3). Item w stole czeka na ciebie – możesz go zabrać w każdej chwili.
        </div>

        <div className="text-sm font-semibold">Ekwipunek</div>
        <div className="grid grid-cols-9">
          {inv.slots.map((s, i) => (
            <Slot
              key={i}
              stack={s}
              icons={icons}
              onClick={(r) => { inv.clickSlot(i, r); refresh(); }}
              onHover={(name) => setHover(name)}
            />
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
