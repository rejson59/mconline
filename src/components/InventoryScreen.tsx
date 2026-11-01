import { useState } from 'react';
import type { Game } from '../game/engine';
import { CREATIVE_CATEGORIES, type CreativeCategory } from '../game/creativeCategories';
import { RECIPES, mergeable, recipeCells, type Recipe } from '../game/inventory';
import { displayName, stackLimit } from '../game/items';
import { filterRecipes } from '../utils/recipeSearch';
import { guiSprite } from '../game/art/uiSprites';
import { useJavaScale } from '../utils/guiScale';
import { GuiSlot, GuiOverlay, useCursorPos } from './GuiContainer';
import CloseButton from './CloseButton';
import { useGuiInteractions } from './useGuiInteractions';
import JavaPlayerPreview from './JavaPlayerPreview';

/** Java InventoryScreen/CraftingScreen coordinates, not a responsive HTML card. */
export default function InventoryScreen({ game, icons, onChange, initialBookOpen }: {
  game: Game; icons: Record<number, string>; onChange: () => void; initialBookOpen?: boolean;
}) {
  const [, tick] = useState(0), [book, setBook] = useState(() => { if (initialBookOpen !== undefined) return initialBookOpen; try { return localStorage.getItem('blockcraft-java-recipe-book') === 'true'; } catch { return false; } });
  const [query, setQuery] = useState(''), [ready, setReady] = useState(false), [page, setPage] = useState(0);
  const [tab, setTab] = useState<CreativeCategory>('blocks');
  const [hover, setHover] = useState<string | null>(null), [ghost, setGhost] = useState<Recipe | null>(null);
  const mouse = useCursorPos(), scale = useJavaScale(), inv = game.inventory;
  const atTable = !!game.craftingTable, creative = game.mode === 'creative';
  const catalog = creative && !atTable && tab !== 'inventory';
  const creativeInventory = creative && !atTable && !catalog;
  const refresh = () => { tick(n => n + 1); onChange(); };
  const interact = useGuiInteractions(game, refresh);
  const match = inv.gridMatch(atTable);
  const canPlace = (r: Recipe) => !!recipeCells(r, atTable) && r.inputs.every(i => inv.countOf(i.id) + inv.grid.reduce((n, s) => n + (s?.id === i.id ? s.count : 0), 0) >= i.count);
  const recipes = filterRecipes(RECIPES, query).filter(r => !!recipeCells(r, atTable) && (!ready || canPlace(r)));
  const pages = Math.max(1, Math.ceil(recipes.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const category = CREATIVE_CATEGORIES.find(c => c.id === tab)!;
  const pool = category.items.filter(id => displayName(id).toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
  const [scroll, setScroll] = useState(0), maxScroll = Math.max(0, Math.ceil(pool.length / 9) - 5);
  const row = Math.min(scroll, maxScroll);
  const ghostCells = ghost && recipeCells(ghost, atTable);
  const width = creative && !atTable ? 195 : 176, height = creative && !atTable ? 136 : 166;
  const wideBook = typeof window === 'undefined' || window.innerWidth / scale >= 379;
  const bookVisible = book && (!creative || atTable);
  const takeResult = () => {
    if (!match) return;
    const cur = inv.cursor;
    if (cur && (!mergeable(cur, match.out) || cur.count + match.out.count > stackLimit(cur.id))) return;
    const made = inv.craftGrid(atTable); if (!made) return;
    if (cur) cur.count += made.count; else inv.cursor = { ...made };
    game.onCraft(made.id); setGhost(null); refresh();
  };
  const slot = (i: number, x: number, y: number) => <GuiSlot key={i} slotArea="inventory" slotIndex={i} x={x} y={y} stack={inv.slots[i]} icons={icons} onHover={setHover}
    onClick={r => { inv.clickSlot(i, r); refresh(); }} onAction={a => { game.inventoryAction('inventory', i, a); refresh(); }} />;
  return <div className="java-inventory absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.6)' }} onPointerDownCapture={interact} onPointerDown={e => { if (e.target === e.currentTarget && (e.button === 0 || e.button === 2)) { game.dropInventoryCursor(e.button === 2); refresh(); } }} onContextMenu={e => e.preventDefault()}>
    <CloseButton onClose={() => game.closeInventory()} className="mc-close-safe absolute z-50" />
    <div style={{ position: 'relative', width: (width + (bookVisible && wideBook ? 151 : 0)) * scale, height: height * scale }}>
      <div style={{ position: 'absolute', left: bookVisible && wideBook ? 151 * scale : 0, top: 0, width, height, transform: `scale(${scale})`, transformOrigin: 'top left', fontSize: 8, lineHeight: '9px', color: '#404040', backgroundImage: `url(${guiSprite(catalog ? tab === 'search' ? 'creative_search_gui' : 'creative_gui' : creativeInventory ? 'creative_inventory_gui' : atTable ? 'crafting_gui' : 'inventory_gui')})`, backgroundSize: '100% 100%', imageRendering: 'pixelated', visibility: bookVisible && !wideBook ? 'hidden' : undefined }}>
        {catalog ? <>
          <span style={{ position: 'absolute', left: 8, top: 6 }}>{category.name}</span>
          {tab === 'search' && <input aria-label="Szukaj przedmiotów" className="java-search" style={{ left: 82, top: 5, width: 89 }} value={query} onChange={e => { setQuery(e.target.value); setScroll(0); }} onKeyDown={e => e.stopPropagation()} />}
          <div onWheel={e => setScroll(v => Math.max(0, Math.min(maxScroll, v + Math.sign(e.deltaY))))} style={{ position: 'absolute', inset: '17px 19px 28px 8px' }}>
            {pool.slice(row * 9, row * 9 + 45).map((id, i) => <GuiSlot key={id} x={1 + i % 9 * 18} y={1 + Math.floor(i / 9) * 18} stack={{ id, count: 1 }} icons={icons} onHover={setHover} onClone={() => { inv.cursor = { id, count: stackLimit(id) }; refresh(); }} onAction={a => { if (a.type === 'quick') inv.cursor = { id, count: stackLimit(id) }; else if (a.type === 'hotbar') inv.slots[a.index] = { id, count: stackLimit(id) }; refresh(); }} onClick={right => {
              const c = inv.cursor;
              if (!c) inv.cursor = { id, count: 1 };
              else if (c.id === id) { c.count = Math.min(stackLimit(id), c.count + (right ? -1 : 1)); if (c.count <= 0) inv.cursor = null; }
              else if (right) { c.count--; if (!c.count) inv.cursor = null; } else inv.cursor = null;
              refresh();
            }} />)}
          </div>
          <input aria-label="Przewijanie przedmiotów" type="range" className="java-scrollbar" min={0} max={maxScroll} value={row} onChange={e => setScroll(+e.target.value)} style={{ position: 'absolute', left: 175, top: 18, width: 12, height: 90 }} />
          {inv.slots.slice(0, 9).map((_, i) => slot(i, 9 + i * 18, 112))}
        </> : <>
          {!atTable && <>
            <div className="mc-inv-preview java-player-preview" aria-label="Podgląd skórki" style={{ position: 'absolute', left: creativeInventory ? 73 : 26, top: creativeInventory ? 6 : 8, width: creativeInventory ? 32 : 52, height: creativeInventory ? 44 : 70, overflow: 'hidden', display: 'grid', placeItems: 'center' }}><div style={{ transform: creativeInventory ? 'scale(.61)' : undefined, transformOrigin: 'top left' }}><JavaPlayerPreview skin={game.getSkinId?.() ?? 'steve'} scale={scale} armor={game.armor} /></div></div>
            {game.armor.map((s, i) => <GuiSlot key={i} slotArea="armor" slotIndex={i} x={creativeInventory ? i % 2 ? 108 : 54 : 8} y={creativeInventory ? i < 2 ? 6 : 33 : 8 + i * 18} stack={s} icons={icons} onHover={setHover} onClick={() => { game.clickArmorSlot(i); refresh(); }} onAction={a => { game.inventoryAction('armor', i, a); refresh(); }} />)}
            <div data-offhand-slot><GuiSlot slotArea="offhand" slotIndex={0} x={creativeInventory ? 35 : 77} y={creativeInventory ? 20 : 62} stack={inv.offhand} icons={icons} onHover={setHover} onClick={r => { game.clickOffhand(r); refresh(); }} onAction={a => { game.inventoryAction('offhand', 0, a); refresh(); }} /></div>
          </>}
          {!creativeInventory && <><span style={{ position: 'absolute', left: atTable ? 28 : 97, top: atTable ? 6 : 16 }}>{atTable ? 'Stół rzemieślniczy' : 'Wytwarzanie'}</span>
          {atTable && <span style={{ position: 'absolute', left: 8, top: 72 }}>Ekwipunek</span>}
          <div className={`mc-craft-grid is-${atTable ? '3' : '2'}`}>
            {(atTable ? [0,1,2,3,4,5,6,7,8] : [0,1,3,4]).map(i => <div key={i} data-craft-cell={i}>
              <GuiSlot slotArea="grid" slotIndex={i} x={(atTable ? 30 : 98) + i % 3 * 18} y={(atTable ? 17 : 26) + Math.floor(i / 3) * 18} stack={inv.grid[i] ?? (ghostCells?.[i] ? { id: ghostCells[i], count: 1 } : null)} dim={!inv.grid[i]} icons={icons} onHover={setHover} onClick={r => { setGhost(null); inv.clickGrid(i, r); refresh(); }} onAction={a => { game.inventoryAction('grid', i, a); refresh(); }} />
            </div>)}
          </div>
          <div data-craft-result><GuiSlot x={atTable ? 124 : 154} y={atTable ? 35 : 36} stack={match?.out ?? ghost?.out ?? null} dim={!match} icons={icons} onHover={setHover} onClick={takeResult} onAction={a => { if (a.type === 'quick') { game.quickCraft(); refresh(); } else if (a.type === 'collect') takeResult(); }} /></div>
          <button className="java-recipe-toggle" title="Książka receptur" aria-label="Książka receptur" aria-pressed={book} onClick={() => { setBook(!book); if (initialBookOpen === undefined) try { localStorage.setItem('blockcraft-java-recipe-book', String(!book)); } catch { /* unavailable storage */ } }} style={{ position: 'absolute', left: atTable ? 5 : 104, top: atTable ? 35 : 62, width: 20, height: 18, backgroundImage: `url(${guiSprite('recipe_button')})` }} /></>}
          {creativeInventory && <button aria-label="Usuń przedmiot" title="Usuń przedmiot (Shift: opróżnij ekwipunek)" style={{position:'absolute',left:173,top:112,width:16,height:16,background:'none',border:0}} onClick={e => { inv.cursor=null; if(e.shiftKey) { inv.slots.fill(null); game.armor.fill(null); inv.offhand=null; } refresh(); }} />}
          <div className="mc-inv-storage">{inv.slots.slice(9, 36).map((_, n) => slot(n + 9, (creativeInventory ? 9 : 8) + n % 9 * 18, (creativeInventory ? 54 : 84) + Math.floor(n / 9) * 18))}</div>
          {inv.slots.slice(0, 9).map((_, i) => <div key={i} data-hotbar-slot={i}>{slot(i, (creativeInventory ? 9 : 8) + i * 18, creativeInventory ? 112 : 142)}</div>)}
        </>}
        {creative && !atTable && CREATIVE_CATEGORIES.map((c, i) => {
          const n = c.bottom ? i - 6 : i;
          return <button key={c.id} aria-label={c.name} title={c.name} aria-pressed={tab === c.id} onClick={() => { setTab(c.id); setQuery(''); setScroll(0); }} className="java-tab" style={{ position: 'absolute', left: c.id === 'inventory' ? width - 28 : n * 28, top: c.bottom ? height - 4 : -28, backgroundImage: `url(${guiSprite(`creative_tab_${c.bottom ? 'bottom' : 'top'}_${tab === c.id ? 'selected' : 'unselected'}`)})` }}><img src={icons[c.icon]} width={16} height={16} alt="" /></button>;
        })}
      </div>
      {bookVisible && <div className="java-recipe-book" style={{ position: 'absolute', left: 0, top: 0, width: 147, height: 166, transform: `scale(${scale})`, transformOrigin: 'top left', color: '#404040', fontSize: 8, lineHeight: '9px', backgroundImage: `url(${guiSprite('recipe_book')})`, backgroundSize: '256px 256px', imageRendering: 'pixelated' }}>
        <input className="java-search" aria-label="Szukaj receptur po nazwie lub składniku" placeholder="Szukaj..." style={{ left: 25, top: 14, width: 80 }} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} onKeyDown={e => e.stopPropagation()} />
        <button className="java-filter" title="Możliwe do wytworzenia" aria-label="Możliwe do wytworzenia" aria-pressed={ready} onClick={() => { setReady(!ready); setPage(0); }} style={{ left: 110, top: 12, backgroundImage: `url(${guiSprite(ready ? 'recipe_filter_enabled' : 'recipe_filter_disabled')})` }} />
        {recipes.slice(currentPage * 20, currentPage * 20 + 20).map((r, i) => <button key={`${r.out.id}-${i}`} className="java-recipe" title={displayName(r.out.id)} aria-label={`Ułóż: ${displayName(r.out.id)}`} data-ready={canPlace(r)} onClick={() => { if (inv.placeRecipe(r, atTable)) setGhost(null); else setGhost(r); refresh(); }} style={{ left: 11 + i % 5 * 25, top: 32 + Math.floor(i / 5) * 25, backgroundImage: `url(${guiSprite(canPlace(r) ? 'recipe_slot_craftable' : 'recipe_slot_uncraftable')})` }}><img src={icons[r.out.id]} width={16} height={16} alt="" /></button>)}
        <button className="java-page-arrow" aria-label="Poprzednia strona receptur" disabled={!currentPage} style={{ left: 30, backgroundImage: `url(${guiSprite('recipe_page_backward')})` }} onClick={() => setPage(currentPage - 1)} />
        <span style={{ position: 'absolute', left: 59, top: 142 }}>{currentPage + 1}/{pages}</span>
        <button className="java-page-arrow" aria-label="Następna strona receptur" disabled={currentPage + 1 >= pages} style={{ left: 102, backgroundImage: `url(${guiSprite('recipe_page_forward')})` }} onClick={() => setPage(currentPage + 1)} />
        {!wideBook && <button className="java-btn" style={{ position: 'absolute', left: 10, top: 167, width: 127 }} onClick={() => setBook(false)}>Powrót do ekwipunku</button>}
      </div>}
    </div>
    <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
  </div>;
}
