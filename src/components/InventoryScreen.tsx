import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { CREATIVE_BLOCKS } from '../game/blocks';
import { RECIPES, type Stack } from '../game/inventory';
import { CREATIVE_ITEMS, displayName, stackLimit } from '../game/items';
import { ARMOR, armorPoints, ARMOR_SLOT_NAMES } from '../game/armor';

function Slot({
  stack,
  icons,
  onClick,
  onHover,
  showCount = true,
  highlight = false,
}: {
  stack: Stack | null;
  icons: Record<number, string>;
  onClick?: (right: boolean) => void;
  onHover?: (name: string | null) => void;
  showCount?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="mc-slot cursor-pointer"
      style={highlight ? { outline: '2px solid #fff', zIndex: 1 } : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.(e.button === 2);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHover?.(stack ? displayName(stack.id) : null)}
      onMouseLeave={() => onHover?.(null)}
    >
      {stack && <img src={icons[stack.id]} className="pixelated pointer-events-none" width={34} height={34} draggable={false} />}
      {stack && showCount && stack.count > 1 && <span className="mc-count">{stack.count}</span>}
    </div>
  );
}

export default function InventoryScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'blocks' | 'items'>('blocks');
  const [onlyReady, setOnlyReady] = useState(false);
  const inv = game.inventory;
  const creative = game.mode === 'creative';
  const gridMatch = creative ? null : inv.gridMatch(!!game.craftingTable);
  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  const clickSlot = (i: number, right: boolean) => {
    inv.clickSlot(i, right);
    refresh();
  };

  const hotbar = (
    <div className="flex gap-0">
      {inv.slots.slice(0, 9).map((s, i) => (
        <Slot key={i} stack={s} icons={icons} onClick={(r) => clickSlot(i, r)} onHover={setHover} showCount={!creative} highlight={i === game.selected} />
      ))}
    </div>
  );

  const pool = tab === 'blocks' ? CREATIVE_BLOCKS : CREATIVE_ITEMS;
  const filtered = pool.filter((id) => displayName(id).toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        // clicking outside panel with cursor in creative -> delete
        if (e.target === e.currentTarget && inv.cursor && creative) {
          inv.cursor = null;
          refresh();
        }
      }}
    >
      <div className="flex max-h-[94vh] flex-wrap items-start justify-center gap-4 overflow-y-auto p-3">
        <div className="mc-panel p-4">
          {creative ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex gap-2 text-lg font-semibold">
                  <button type="button" className={tab === 'blocks' ? 'underline' : 'opacity-60'} onClick={() => setTab('blocks')}>Bloki</button>
                  <button type="button" className={tab === 'items' ? 'underline' : 'opacity-60'} onClick={() => setTab('items')}>Przedmioty</button>
                </div>
                <input
                  className="mc-input !w-44 !py-1 !text-sm"
                  placeholder="Szukaj..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="mb-3 grid max-h-[300px] grid-cols-9 overflow-y-auto" style={{ width: 9 * 44 + 18 }}>
                {filtered.map((id) => (
                  <Slot
                    key={id}
                    stack={{ id, count: 64 }}
                    icons={icons}
                    showCount={false}
                    onHover={setHover}
                    onClick={() => {
                      if (inv.cursor) inv.cursor = null;
                      else inv.cursor = { id, count: stackLimit(id) === 1 ? 1 : 64 };
                      refresh();
                    }}
                  />
                ))}
              </div>
              <div className="mb-1 text-sm">Kliknij blok, a potem slot paska. Klik poza oknem usuwa trzymany blok.</div>
              {hotbar}
            </>
          ) : (
            <>
              <div className="mb-2 text-lg font-semibold">Ekwipunek</div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex gap-0">
                  {game.armor.map((s, i) => (
                    <Slot
                      key={i}
                      stack={s}
                      icons={icons}
                      onClick={() => {
                        game.clickArmorSlot(i);
                        refresh();
                      }}
                      onHover={(name) =>
                        setHover(
                          name
                            ? `${name} · ${ARMOR_SLOT_NAMES[i]}${ARMOR[s!.id]?.points ? ` (+${ARMOR[s!.id]!.points} pkt pancerza)` : ''}`
                            : ARMOR_SLOT_NAMES[i]
                        )
                      }
                    />
                  ))}
                </div>
                <span className="text-xs opacity-70">Pancerz: {armorPoints(game.armor)} pkt</span>
              </div>
              <div className="mb-3 grid grid-cols-9">
                {inv.slots.slice(9, 36).map((s, i) => (
                  <Slot key={i + 9} stack={s} icons={icons} onClick={(r) => clickSlot(i + 9, r)} onHover={setHover} />
                ))}
              </div>
              {hotbar}
              <div className="mt-2 text-xs opacity-80">LPM: weź/połóż stos · PPM: połowa / jeden</div>
            </>
          )}
        </div>

        {!creative && (
          <div className="mc-panel w-[330px] p-4">
            <div className="mb-1 flex items-center justify-between text-lg font-semibold">
              <span>{game.craftingTable ? 'Stół rzemieślniczy' : 'Wytwarzanie'}</span>
              <button type="button" className="text-xs underline" onClick={() => setOnlyReady((v) => !v)}>{onlyReady ? 'Wszystkie' : 'Tylko możliwe'}</button>
            </div>

            {/* crafting grid: 2x2 by hand, 3x3 at the table */}
            <div className="mb-3 flex items-center gap-3">
              <div className="grid grid-cols-3 gap-0" style={{ width: 3 * 44 }}>
                {inv.grid.map((cell, i) => {
                  const row = Math.floor(i / 3), col = i % 3;
                  const enabled = game.craftingTable || (row < 2 && col < 2);
                  return (
                    <div key={i} style={{ opacity: enabled ? 1 : 0.25 }}>
                      <Slot
                        stack={enabled ? cell : null}
                        icons={icons}
                        onHover={setHover}
                        onClick={(r) => { if (enabled) { inv.clickGrid(i, r); refresh(); } }}
                      />
                    </div>
                  );
                })}
              </div>
              <span className="text-2xl">→</span>
              <Slot
                stack={gridMatch ? { ...gridMatch.out } : null}
                icons={icons}
                showCount
                onHover={setHover}
                onClick={() => {
                  if (!gridMatch) return;
                  const cur = inv.cursor;
                  if (cur && (cur.id !== gridMatch.out.id || cur.dur !== undefined)) return;
                  const room = cur ? stackLimit(cur.id) - cur.count : stackLimit(gridMatch.out.id);
                  if (room <= 0) return;
                  const made = inv.craftGrid(!!game.craftingTable);
                  if (!made) return;
                  const take = Math.min(made.count, room);
                  if (cur) { cur.count += take; }
                  else inv.cursor = { id: made.id, count: take, dur: made.dur };
                  if (made.count > take) inv.add(made.id, made.count - take, made.dur);
                  game.onCraft(made.id);
                  refresh();
                }}
              />
            </div>
            <div className="mb-2 text-xs opacity-80">
              {game.craftingTable
                ? 'Ułóż składniki wzorem w siatce 3×3 i weź wynik. Pasują też wzory narzędzi: np. 3 deski nad 2 patykami = kilof.'
                : 'Siatka 2×2 – ułóż składniki i weź wynik. Stoł rzemieślniczy (4 deski) odblokowuje siatkę 3×3.'}
            </div>
            {!game.craftingTable && <div className="mb-2 text-xs">Narzędzia, łóżko i piec wymagają stołu (PPM na stół). Piec przetapia rudy – PPM na piec.</div>}
            <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
              {RECIPES.filter((r) => !onlyReady || (inv.canCraft(r) && !(r.table && !game.craftingTable))).map((r, i) => {
                const needTable = r.table && !game.craftingTable;
                const can = inv.canCraft(r) && !needTable;
                return (
                  <button
                    key={i}
                    disabled={!can}
                    onClick={() => {
                      if (inv.craft(r)) { game.onCraft(r.out.id); refresh(); }
                    }}
                    className="flex w-full items-center gap-2 border-2 border-[#555] px-2 py-1 text-left"
                    style={{ background: can ? '#9fd39a' : '#a9a9a9', opacity: needTable ? 0.55 : 1, cursor: can ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHover(displayName(r.out.id))}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div className="flex items-center gap-1">
                      {r.inputs.map((inp, j) => (
                        <div key={j} className="relative">
                          <img src={icons[inp.id]} width={26} height={26} className="pixelated" />
                          <span className="absolute -bottom-1 right-0 text-xs font-bold text-white mc-text">{inp.count}</span>
                        </div>
                      ))}
                    </div>
                    <span className="text-lg">→</span>
                    <div className="relative">
                      <img src={icons[r.out.id]} width={30} height={30} className="pixelated" />
                      <span className="absolute -bottom-1 right-0 text-xs font-bold text-white mc-text">{r.out.count}</span>
                    </div>
                    <span className="ml-1 truncate text-sm text-[#222]">{displayName(r.out.id)}</span>
                    {r.table && <span className="ml-auto text-xs">🛠</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hover && !inv.cursor && (
        <div className="pointer-events-none fixed z-50 px-2 py-1 text-sm" style={{ left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a', border: '2px solid #2a0f5f', color: '#fff' }}>
          {hover}
        </div>
      )}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 17, top: mouse.y - 17 }}>
          <img src={icons[inv.cursor.id]} width={34} height={34} className="pixelated" />
          {!creative && inv.cursor.count > 1 && <span className="mc-count">{inv.cursor.count}</span>}
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm mc-text opacity-80">E / Esc – zamknij</div>
    </div>
  );
}
