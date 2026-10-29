import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../game/engine';
import { B, CREATIVE_BLOCKS } from '../game/blocks';
import { LOG_IDS, RECIPES, mergeable, type Recipe } from '../game/inventory';
import { filterRecipes } from '../utils/recipeSearch';
import { CREATIVE_ITEMS, displayName, stackLimit } from '../game/items';
import { TooltipBody } from '../utils/tooltip';
import { ARMOR, armorPoints, ARMOR_SLOT_NAMES } from '../game/armor';
import Slot from './Slot';
import CloseButton from './CloseButton';
import { EquippedSkinAvatar } from './SkinPicker';

/** Player inventory: standard mouse buttons, Shift transfer/crafting and hovered-slot keys. */
export default function InventoryScreen({
  game,
  icons,
  onChange,
  /** Wymusza otwartą książkę przepisów (testy, duże ekrany). */
  initialBookOpen,
}: {
  game: Game;
  icons: Record<number, string>;
  onChange: () => void;
  initialBookOpen?: boolean;
}) {
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recipeQuery, setRecipeQuery] = useState('');
  const [tab, setTab] = useState<'blocks' | 'items'>('blocks');
  const [onlyReady, setOnlyReady] = useState(false);
  // Na komputerze książka przepisów jest otwarta od razu (jak w Minecrafcie),
  // na telefonie chowamy ją, żeby plecak zmieścił się na ekranie.
  const [book, setBook] = useState(
    () => initialBookOpen ?? (typeof window !== 'undefined' && window.innerWidth >= 900)
  );
  const inv = game.inventory;
  const creative = game.mode === 'creative';
  const atTable = !!game.craftingTable;
  const gridMatch = creative ? null : inv.gridMatch(atTable);
  const skinId = game.getSkinId?.() ?? 'steve';

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    // 2.9: na dotyku nie ma „mousemove” – ikona trzymanego przedmiotu
    // zostawała w lewym górnym rogu. Tapnięcie też ustawia jej pozycję.
    const pt = (e: PointerEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', mm);
    window.addEventListener('pointerdown', pt, true);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('pointerdown', pt, true);
    };
  }, []);

  const clickSlot = (i: number, right: boolean) => {
    inv.clickSlot(i, right);
    refresh();
  };

  // The same LPM/PPM semantics as every other inventory slot.
  const clickGrid = (i: number, right: boolean) => {
    if (!inv.cursor && !inv.grid[i]) return;
    inv.clickGrid(i, right);
    refresh();
  };

  const takeResult = () => {
    if (!gridMatch) return;
    const cur = inv.cursor;
    if (cur && !mergeable(cur, gridMatch.out)) return;
    const room = cur ? stackLimit(cur.id) - cur.count : stackLimit(gridMatch.out.id);
    if (room < gridMatch.out.count) return;
    const made = inv.craftGrid(atTable);
    if (!made) return;
    if (cur) cur.count += made.count;
    else inv.cursor = { ...made, ...(made.ench ? { ench: { ...made.ench } } : {}) };
    game.onCraft(made.id);
    refresh();
  };

  const craftDirect = (recipe: Recipe) => {
    if (!inv.craft(recipe)) return;
    game.onCraft(recipe.out.id);
    refresh();
  };

  // --- 2.13: szybkie przepisy, które rozwiązują „nie mogę zrobić desek”.
  const plankRecipes = useMemo(
    () => LOG_IDS.map((logId) => RECIPES.find((r) => r.out.id === B.PLANKS && !r.table && r.inputs.length === 1 && r.inputs[0].id === logId)).filter((r): r is Recipe => !!r),
    []
  );
  const tableRecipe = useMemo(() => RECIPES.find((r) => r.out.id === B.CRAFTING), []);
  // Bez `useMemo`: plecak zmienia się w miejscu, więc świeżość jest ważniejsza
  // niż kilka tanich sprawdzeń przy każdym renderze.
  const woodName = (id: number) => (
    { [B.LOG]: 'dąb', [B.BIRCH_LOG]: 'brzoza', [B.ACACIA_LOG]: 'akacja' } as Record<number, string>
  )[id] ?? 'drewno';
  const quick: { recipe: Recipe; label: string; hint: string }[] = [];
  for (const r of plankRecipes) {
    if (inv.canCraftToInventory(r)) quick.push({ recipe: r, label: `Deski (${woodName(r.inputs[0].id)})`, hint: '1 pień → 4 deski' });
  }
  if (tableRecipe && inv.canCraftToInventory(tableRecipe)) {
    quick.push({ recipe: tableRecipe, label: 'Stół rzemieślniczy', hint: '4 deski → stół' });
  }

  const hotbar = (
    <div className="mc-inv-hotbar flex gap-0">
      {inv.slots.slice(0, 9).map((s, i) => (
        <div key={i} data-hotbar-slot={i} className="contents">
          <Slot stack={s} icons={icons} onAction={(a) => { game.inventoryAction('inventory', i, a); refresh(); }} onClick={(r) => clickSlot(i, r)} onHover={setHover} showCount={!creative} highlight={i === game.selected} />
        </div>
      ))}
    </div>
  );

  const pool = tab === 'blocks' ? CREATIVE_BLOCKS : CREATIVE_ITEMS;
  const filtered = pool.filter((id) => displayName(id).toLowerCase().includes(search.toLowerCase()));
  const recipeRows = filterRecipes(RECIPES, recipeQuery).filter((recipe) => {
    if (!onlyReady) return true;
    return inv.canCraftToInventory(recipe) && !(recipe.table && !atTable);
  });
  const readyCount = RECIPES.filter((r) => inv.canCraftToInventory(r) && !(r.table && !atTable)).length;

  // Siatka: 2×2 w plecaku (komórki 0,1,3,4) albo pełne 3×3 przy stole.
  const cells = atTable ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4];

  const offhandSlot = (
    <div className="mb-2 flex items-center gap-2" data-offhand-slot>
      <Slot stack={inv.offhand} icons={icons}
        onClick={(right) => { game.clickOffhand(right); refresh(); }}
        onAction={(a) => { game.inventoryAction('offhand', 0, a); refresh(); }}
        onHover={(name) => setHover(name || 'Druga ręka · F zamienia ręce')}
        showCount={!creative} />
      <span className="text-xs text-[#444]">Druga ręka <b>F</b></span>
    </div>
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // 2.9: na dotyku tapnięcie poza panelem zamyka ekwipunek. Trzymany
        // przedmiot wraca do plecaka w `closeInventory()`, więc nic nie ginie.
        if (e.target === e.currentTarget) game.closeInventory();
      }}
    >
      <CloseButton onClose={() => game.closeInventory()} className="mc-close-safe absolute z-50" />

      <div className="flex max-h-full max-w-[100vw] flex-wrap items-start justify-center gap-2 overflow-x-hidden overflow-y-auto px-1 pb-20 pt-1 sm:gap-3 sm:p-3 sm:pb-20">
        {!creative ? (
          <div className="mc-panel mc-inv">
            <div className="mc-inv-head">
              <span className="mc-inv-title">{atTable ? 'Stół rzemieślniczy' : 'Ekwipunek'}</span>
              <button
                type="button"
                className="mc-inv-book-btn"
                aria-pressed={book}
                onClick={() => setBook((v) => !v)}
                title="Książka przepisów – tapnij, aby wytworzyć przedmiot"
              >
                📖 Receptury
                {readyCount > 0 && <span className="mc-inv-book-count">{readyCount}</span>}
              </button>
            </div>

            {offhandSlot}
            <div className="mc-inv-body">
              {!atTable && (
                <div className="mc-inv-side">
                  <div className="mc-inv-armor">
                    {game.armor.map((s, i) => (
                      <Slot
                        key={i}
                        stack={s}
                        onAction={(a) => { game.inventoryAction('armor', i, a); refresh(); }}
                        icons={icons}
                        onClick={() => {
                          game.clickArmorSlot(i);
                          refresh();
                        }}
                        onHover={(name) => {
                          if (!name) {
                            setHover(ARMOR_SLOT_NAMES[i]);
                            return;
                          }
                          const [title, ...enchLines] = name.split('\n');
                          const slot = `${title} · ${ARMOR_SLOT_NAMES[i]}${ARMOR[s!.id]?.points ? ` (+${ARMOR[s!.id]!.points} pkt pancerza)` : ''}`;
                          setHover(enchLines.length ? `${slot}\n§5${enchLines.join('\n').replace(/^§5/, '')}` : slot);
                        }}
                      />
                    ))}
                  </div>
                  <div className="mc-inv-preview" aria-hidden="true">
                    <EquippedSkinAvatar skin={skinId} size={54} armor={game.armor} />
                    <div className="mc-inv-armor-pts">🛡 {armorPoints(game.armor)}</div>
                  </div>
                </div>
              )}

              <div className="mc-inv-main">
                <div className={`mc-craft ${gridMatch ? 'is-ready' : ''}`}>
                  <div className={`mc-craft-grid ${atTable ? 'is-3' : 'is-2'}`}>
                    {cells.map((i) => (
                      <div key={i} data-craft-cell={i} className="contents">
                        <Slot
                          stack={inv.grid[i]}
                          icons={icons}
                          onHover={setHover}
                          onAction={(a) => { game.inventoryAction('grid', i, a); refresh(); }}
                          onClick={(right) => clickGrid(i, right)}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="mc-craft-arrow" aria-hidden="true">➜</span>
                  <div data-craft-result className="contents">
                    <Slot
                      stack={gridMatch ? { ...gridMatch.out } : null}
                      icons={icons}
                      showCount
                      onHover={setHover}
                      onAction={(a) => { if (a.type === 'quick') { game.quickCraft(); refresh(); } else if (a.type === 'collect') takeResult(); }}
                      onClick={takeResult}
                    />
                  </div>
                </div>

                {quick.length > 0 && (
                  <div className="mc-quick" aria-label="Szybkie przepisy">
                    {quick.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        className="mc-quick-btn"
                        title={q.hint}
                        onClick={() => craftDirect(q.recipe)}
                      >
                        <img src={icons[q.recipe.out.id]} width={20} height={20} className="pixelated" alt="" />
                        <span>{q.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mc-inv-storage">
                  {inv.slots.slice(9, 36).map((s, i) => (
                    <Slot key={i + 9} stack={s} icons={icons} onAction={(a) => { game.inventoryAction('inventory', i + 9, a); refresh(); }} onClick={(r) => clickSlot(i + 9, r)} onHover={setHover} />
                  ))}
                </div>
                {hotbar}
              </div>
            </div>

            <div className="mc-inv-hint">
              Shift+klik: przenieś stos / wytwórz serię · 1–9: zamień z paskiem · Dwuklik: zbierz stos · Q / Ctrl+Q: wyrzuć.
              {atTable
                ? 'Ułóż wzór w siatce 3×3 i tapnij wynik. LPM / tapnięcie: cały stos; PPM / przytrzymanie: 1 sztuka.'
                : 'Siatka 2×2: tapnij składnik, potem pole siatki. 1 pień → 4 deski, 4 deski w kwadracie → stół rzemieślniczy.'}
            </div>
          </div>
        ) : (
          <div className="mc-panel mc-inv">
            <div className="mc-inv-head">
              <span className="mc-inv-title">Ekwipunek <span className="mc-inv-mode">· kreatywny</span></span>
            </div>
            {offhandSlot}
            <div className="mc-inv-body">
              <div className="mc-inv-main">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2 text-base font-semibold">
                    <button type="button" className={tab === 'blocks' ? 'underline' : 'opacity-60'} onClick={() => setTab('blocks')}>Bloki</button>
                    <button type="button" className={tab === 'items' ? 'underline' : 'opacity-60'} onClick={() => setTab('items')}>Przedmioty</button>
                  </div>
                  <input
                    className="mc-input mc-inv-search"
                    placeholder="Szukaj..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="mc-inv-creative">
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
                <div className="mc-inv-hint">
                  Tapnij blok, a potem slot paska. Tap poza oknem odkłada trzymany przedmiot.
                </div>
                {hotbar}
              </div>
            </div>
          </div>
        )}

        {!creative && book && (
          <div className="mc-panel mc-recipe-book">
            <div className="mc-inv-head">
              <span className="mc-inv-title">📖 Receptury</span>
              <span className="mc-recipe-count">{recipeRows.length}/{RECIPES.length}</span>
            </div>
            <div className="mb-2 flex gap-2">
              <label className="sr-only" htmlFor="recipe-search">Szukaj receptur po nazwie lub składniku</label>
              <input
                id="recipe-search"
                className="mc-input min-w-0 flex-1 !py-1 !text-sm"
                type="search"
                placeholder="Szukaj receptur po nazwie lub składniku"
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className={`mc-btn !w-auto !px-2 !py-1 !text-xs ${onlyReady ? 'ring-2 ring-inset ring-yellow-300' : ''}`}
                aria-pressed={onlyReady}
                onClick={() => setOnlyReady((v) => !v)}
              >
                {onlyReady ? 'Wszystkie' : 'Możliwe'}
              </button>
            </div>
            <div className="mc-recipe-list">
              {recipeRows.length === 0 && (
                <div className="px-2 py-5 text-center text-sm text-[#444]" role="status">
                  {recipeQuery.trim() ? 'Nie znaleziono takiej receptury.' : 'Brak receptur możliwych do wykonania. Zdobądź potrzebne składniki.'}
                </div>
              )}
              {recipeRows.map((r) => {
                const needTable = r.table && !atTable;
                const hasInputs = inv.canCraft(r);
                const can = hasInputs && !needTable && inv.canCraftToInventory(r);
                const noRoom = hasInputs && !needTable && !inv.canCraftToInventory(r);
                return (
                  <button
                    key={RECIPES.indexOf(r)}
                    title={noRoom ? 'Zrób miejsce w ekwipunku na wynik.' : needTable ? 'Wymaga stołu rzemieślniczego.' : undefined}
                    disabled={!can}
                    onClick={() => craftDirect(r)}
                    className="mc-recipe-row"
                    style={{ background: can ? '#9fd39a' : '#a9a9a9', opacity: needTable ? 0.55 : 1, cursor: can ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHover(displayName(r.out.id))}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div className="flex items-center gap-1">
                      {r.inputs.map((inp, j) => (
                        <div key={j} className="relative">
                          <img src={icons[inp.id]} width={24} height={24} className="pixelated" alt="" />
                          <span className="absolute -bottom-1 right-0 text-xs font-bold text-white mc-text">{inp.count}</span>
                        </div>
                      ))}
                    </div>
                    <span className="text-lg">→</span>
                    <div className="relative">
                      <img src={icons[r.out.id]} width={28} height={28} className="pixelated" alt="" />
                      <span className="absolute -bottom-1 right-0 text-xs font-bold text-white mc-text">{r.out.count}</span>
                    </div>
                    <span className="ml-1 truncate text-sm text-[#222]">{displayName(r.out.id)}</span>
                    {r.table && <span className="ml-auto text-xs" title="Wymaga stołu">🛠</span>}
                  </button>
                );
              })}
            </div>
            <div className="mc-inv-hint">
              Tapnij recepturę, aby wytworzyć od razu – nie trzeba układać składników w siatce.
            </div>
          </div>
        )}
      </div>

      {hover && !inv.cursor && (
        <div className="pointer-events-none fixed z-50 max-w-[320px] px-2 py-1 text-sm" style={{ left: mouse.x + 14, top: mouse.y - 28, background: '#1a0a2a', border: '2px solid #2a0f5f', color: '#fff', whiteSpace: 'pre-line' }}>
          <TooltipBody text={hover} />
        </div>
      )}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 17, top: mouse.y - 17 }}>
          <img src={icons[inv.cursor.id]} width={34} height={34} className="pixelated" alt="" />
          {!creative && inv.cursor.count > 1 && <span className="mc-count">{inv.cursor.count}</span>}
        </div>
      )}
      {/* 2.9: przycisk na dole jest w zasięgu kciuka; skrót klawiszowy
          zostaje jako podpowiedź na komputerze. */}
      <div className="mc-panel-actions">
        <button
          type="button"
          className="mc-btn !w-auto !px-5 !py-2 !text-base"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => game.closeInventory()}
        >
          Gotowe – zamknij ekwipunek
        </button>
        <span className="hidden self-center text-xs mc-text text-white/60 sm:inline">E / Esc – zamknij</span>
      </div>
    </div>
  );
}
