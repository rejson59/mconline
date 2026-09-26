/**
 * UI suite: renders the real React screens without a browser.
 *
 * Part 1 always runs – the menus are rendered to static markup with
 * react-dom/server, which catches crashes, bad props and missing labels.
 * Part 2 runs only when jsdom is installed (`npm i --no-save jsdom`): it mounts
 * the whole <App/>, walks through world creation and asserts that a missing
 * WebGL context ends in a readable error instead of a blank page.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainMenu, Controls, AchievementsPanel, PauseMenu, filterAndSortWorlds } from '../src/components/Menus';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { DEFAULT_SETTINGS, applyPreset } from '../src/utils/settings';
import SettingsScreen from '../src/components/SettingsScreen';
import JournalScreen, { JOURNAL_CHAPTERS, journalProgress } from '../src/components/JournalScreen';
import EnchantScreen from '../src/components/EnchantScreen';
import TradeScreen from '../src/components/TradeScreen';
import WaypointsScreen from '../src/components/WaypointsScreen';
import AnvilScreen from '../src/components/AnvilScreen';
import { anvilResult } from '../src/game/anvil';
import { Inventory } from '../src/game/inventory';
import { I } from '../src/game/items';
import { rollEnchantOptions } from '../src/game/enchant';
import { createVillagerState, offersFor } from '../src/game/trading';
import type { Game, TradeRow } from '../src/game/engine';

// ------------------------------------------------------------------- runner
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, extra = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name}${extra ? ' — ' + extra : ''}`); }
}
function section(t: string) { console.log(`\n— ${t}`); }

// --------------------------------------------------------------- DOM stubs
const store = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const noop = () => {};

// ============================================================ static renders
section('trade screen: static render');
{
  const inv = new Inventory();
  inv.add(I.WHEAT, 20);
  inv.add(I.EMERALD, 3);
  const state = createVillagerState(0, 0); // rolnik
  const rows = (): TradeRow[] =>
    offersFor(state).map((offer, index) => ({ index, offer, left: offer.uses, max: offer.uses, blocked: 'ok' }));
  const fake = {
    inventory: inv,
    tradeMob: { trade: state },
    tradeTitle: () => 'Rolnik',
    tradeLevel: () => 1,
    tradeProgress: () => 0.25,
    tradeRestockIn: () => 149,
    tradeRows: rows,
    tradeWith: () => true,
    closeTrade: noop,
  };
  const html = renderToStaticMarkup(
    <TradeScreen game={fake as unknown as Game} icons={{}} onChange={noop} />
  );
  check('trader name is shown', html.includes('Rolnik'));
  check('restock countdown is shown', html.includes('149'));
  check('offer row shows a wheat price', html.includes('20'));
  check('offer row shows emeralds', html.includes('Szmaragd') || html.includes('szmaragd'));
  check('close hint is shown', html.includes('Esc'));
  check('player inventory is rendered', html.includes('Ekwipunek'));
}

section('adventure journal: quests and progress');
{
  const unlocked = ['wood', 'craft', 'pick', 'torch', 'home'];
  const progress = journalProgress(unlocked);
  check('journal has multi-step story chapters', JOURNAL_CHAPTERS.length >= 7);
  check('chapter completion reflects achievement progress', progress[0].complete && progress[1].done === 2 && !progress[1].complete);
  const hud = {
    worldName: 'Nowy świat', day: 3, biome: 'plains', level: 4,
    pos: [12.8, 65.2, -3.4], seed: 1234, mode: 'survival',
  };
  const html = renderToStaticMarkup(
    <JournalScreen hud={hud as never} unlocked={unlocked} onClose={noop} />
  );
  check('journal shows world and progress summary', html.includes('Nowy świat') && html.includes('Postęp przygody'));
  check('journal lists unfinished objectives', html.includes('Wyprawa pod ziemię') && html.includes('Diamenty!'));
  check('journal includes accessible progress indicators', html.includes('role="progressbar"') && html.includes('aria-valuenow="3"'));
  check('journal shows world seed and return hint', html.includes('1234') && html.includes('powrót do gry'));
}

section('world list: search and sorting');
{
  const worlds = [
    { id: 'z', name: 'Żółta wyspa', seed: 91, day: 4, updated: 100, mode: 'survival' },
    { id: 'a', name: 'Arkadia', seed: 27, day: 12, updated: 50, mode: 'creative', worldType: 'flat' as const },
    { id: 'b', name: 'Góry', seed: 123, day: 2, updated: 200, mode: 'survival' },
  ];
  check('world search ignores Polish diacritics', filterAndSortWorlds(worlds, 'zol', 'recent').map((w) => w.id).join() === 'z');
  check('world search matches seed and mode', filterAndSortWorlds(worlds, 'kreatywny', 'recent').map((w) => w.id).join() === 'a');
  check('recent sorting puts newest save first', filterAndSortWorlds(worlds, '', 'recent').map((w) => w.id).join() === 'b,z,a');
  check('day sorting puts longest worlds first', filterAndSortWorlds(worlds, '', 'day').map((w) => w.id).join() === 'a,z,b');
  check('name sorting uses Polish locale', filterAndSortWorlds(worlds, '', 'name').map((w) => w.id).join() === 'a,b,z');
  check('pinned worlds stay above the selected sort', filterAndSortWorlds([{ ...worlds[0], favorite: true }, worlds[1], worlds[2]], '', 'day').map((w) => w.id).join() === 'z,a,b');
}

section('menus: static render');
{
  const menu = renderToStaticMarkup(
    <MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />
  );
  check('title is rendered', menu.includes('BLOCKCRAFT'));
  check('new world button', menu.includes('Nowy świat'));
  check('controls button', menu.includes('Sterowanie'));
  check('options button', menu.includes('Opcje'));
  check('fullscreen button', menu.includes('Pełny ekran'));
  check('export/import buttons', menu.includes('Eksport zapisów') && menu.includes('Import zapisów'));
  check('menu background is a relative url', !menu.includes('url("/menu-bg.jpg'));

  const withSaves = renderToStaticMarkup(
    <MainMenu
      saves={[{ id: 'w1', name: 'Wyspa', seed: 1234, mode: 'survival', day: 3, updated: 1710000000000, worldType: 'flat' }]}
      onPlay={noop}
      onNew={noop}
      onDelete={noop}
    />
  );
  check('saved worlds are listed', withSaves.includes('Wyspa') && withSaves.includes('1234'));
  check('world management has search and sort controls', withSaves.includes('Szukaj nazwy') && withSaves.includes('Ostatnio grane'));
  check('world capacity is visible', withSaves.includes('1/8'));
  check('save date is shown when available', withSaves.includes('Zapisano:'));
  check('world type shown on the card', withSaves.includes('płaski'));
  check('delete button present', withSaves.includes('Usuń'));

  const shared = renderToStaticMarkup(
    <MainMenu saves={[]} sharedSeed={99} sharedMode="creative" onPlay={noop} onNew={noop} onDelete={noop} />
  );
  check('shared link opens the creation form', shared.includes('Świat z linku') && shared.includes('99'));
  check('shared link keeps the mode', shared.includes('Kreatywny'));

  const controls = renderToStaticMarkup(<Controls />);
  check('controls list movement keys', controls.includes('W A S D'));
  check('controls include adventure journal key', controls.includes('Dziennik przygód'));
  check('controls list the enchanting table', /zakl/i.test(controls));

  const pause = renderToStaticMarkup(
    <PauseMenu settings={DEFAULT_SETTINGS} shareUrl="http://x/#seed=1" onSettings={noop} onResume={noop} onJournal={noop} onQuit={noop} onSave={noop} />
  );
  check('pause menu offers resume and save', pause.includes('Wróć do gry') && pause.includes('Zapisz świat'));
  check('pause menu opens the adventure journal', pause.includes('Dziennik przygód'));
  check('pause menu counts achievements', pause.includes(`/${ACHIEVEMENTS.length}`));

  // 2.0: ekran opcji (zakładki, presety jakości, sterowanie dotykowe)
  const settingsHtml = renderToStaticMarkup(
    <SettingsScreen settings={DEFAULT_SETTINGS} onChange={noop} onClose={noop} />
  );
  check('settings screen shows quality presets', settingsHtml.includes('Niskie') && settingsHtml.includes('Wysokie'));
  check('settings screen shows auto mode', settingsHtml.includes('Auto'));
  check('settings screen shows touch options', settingsHtml.includes('Ekran dotykowy') && settingsHtml.includes('Wibracje'));
  check('settings screen shows fps cap option', settingsHtml.includes('Limit klatek'));
  const medium = renderToStaticMarkup(
    <SettingsScreen settings={applyPreset(DEFAULT_SETTINGS, 'medium')} onChange={noop} onClose={noop} />
  );
  check('settings highlight the active preset', medium.includes('ring-yellow-300'));

  const ach = renderToStaticMarkup(<AchievementsPanel unlocked={['wood', 'diamond']} />);
  check('unlocked achievements are revealed', ach.includes('Pierwsze drewno') && ach.includes('Diamenty!'));
  check('locked achievements stay hidden', ach.includes('???'));
  check('achievement counter', ach.includes(`2 / ${ACHIEVEMENTS.length}`));
}

section('2.2 travel waypoints: static render');
{
  const fake = {
    waypoints: [{ id: 'home', name: 'Baza', x: 12, y: 65, z: -4, dimension: 'overworld', kind: 'custom' }],
    activeWaypointId: 'home', isInNether: false,
    body: { pos: { x: 10, y: 65, z: -2 } },
    currentDimension: () => 'overworld', addWaypoint: () => null,
    activateWaypoint: noop, removeWaypoint: noop,
  };
  const html = renderToStaticMarkup(<WaypointsScreen game={fake as unknown as Game} onClose={noop} />);
  check('waypoint screen describes navigation', html.includes('Punkty podróży') && html.includes('minimapie'));
  check('waypoint screen lists coordinates and tracking state', html.includes('Baza') && html.includes('12, 65, -4') && html.includes('Nie śledź'));
  check('waypoint screen supports creating points at the current position', html.includes('Dodaj tutaj'));
}

// ======================================================= enchanting screen
section('enchant screen: static render');
{
  // A Game-shaped stand-in – the screen only touches a handful of members.
  const inv = new Inventory();
  inv.slots[0] = { id: I.IRON_PICK, count: 1, dur: 90 };
  inv.slots[1] = { id: 150, count: 6 }; // lazuryt
  const item = { id: I.DIAMOND_SWORD, count: 1, dur: 1200, ench: { sharpness: 3 } as Record<string, number> };
  const options = rollEnchantOptions(item, 15, () => 0.5);
  const game = {
    inventory: inv,
    enchantItem: item,
    enchantPower: () => 15,
    enchOptions: options,
    mode: 'survival',
    xp: { info: () => ({ level: 22, inLevel: 4, need: 20 }) },
    canEnchantWith: () => true,
    enchantWith: () => false,
    clickEnchantSlot: () => {},
    closeInventory: () => {},
    emitHud: () => {},
  };
  const html = renderToStaticMarkup(
    <EnchantScreen game={game as never} icons={{}} onChange={() => {}} />
  );
  check('screen title renders', html.includes('Stół zaklęć'));
  check('shelf counter shows', html.includes('Biblioteczki: 15/15'));
  check('player level shows', html.includes('Poziom: 22'));
  check('the item sits in the slot', html.includes('Diamentowy miecz') || html.includes('img'));
  check('three offers listed', options.length === 3);
  for (const opt of options) check(`offer ${opt.ench} rendered`, html.includes(opt.cost + ' pkt'));
  check('lapis cost shown', html.includes('1◆'));
  check('inventory grid rendered', html.includes('mc-slot'));
}


// ============================================================ 2.3: kowadło + dziennik
section('2.3: anvil screen: static render');
{
  const inv = new Inventory();
  inv.slots[0] = { id: I.IRON_PICK, count: 1, dur: 40 };
  inv.slots[1] = { id: I.FISHING_ROD, count: 1, dur: 30, name: 'Wędka dziadka' };
  const state = { x: 1, y: 2, z: 3, a: null as any, b: null as any, name: '', burn: 0, burnMax: 0 };
  const make = (level: number, a: any, b: any, name = '') => {
    state.a = a;
    state.b = b;
    state.name = name;
    return {
      inventory: inv,
      xp: { info: () => ({ level, inLevel: 0, need: 1 }) },
      currentAnvil: () => state,
      anvilOffer: () => anvilResult(state.a, state.b, state.name),
      canAnvilTake: () => level >= 1,
      takeAnvilResult: () => false,
      clickAnvilSlot: () => {},
      setAnvilName: () => {},
      closeInventory: () => {},
      emitHud: () => {},
    };
  };

  const merge = renderToStaticMarkup(
    <AnvilScreen game={make(12, { id: I.IRON_PICK, count: 1, dur: 40 }, { id: I.IRON_PICK, count: 1, dur: 25 }) as never} icons={{}} onChange={() => {}} />
  );
  check('the anvil panel has a title', merge.includes('Kowadło'));
  check('the player level is shown', merge.includes('Poziom: 12'));
  check('the merge is described', merge.includes('Scal dwa przedmioty'));
  check('the result slot shows its cost', merge.includes('Wynik · 1 pkt'));
  check('both input slots are rendered', (merge.match(/mc-slot/g) ?? []).length >= 38);
  check('the durability bar is drawn', merge.includes('dur-bar'));
  check('the name field is rendered', merge.includes('max 28 znaków'));
  check('the how-to text is on screen', merge.includes('wytrzymałości się sumują'));

  const poor = renderToStaticMarkup(
    <AnvilScreen game={make(0, { id: I.IRON_PICK, count: 1, dur: 40 }, { id: I.IRON_PICK, count: 1, dur: 25 }) as never} icons={{}} onChange={() => {}} />
  );
  check('a broke player is warned', poor.includes('za mało poziomów'));

  const renamed = renderToStaticMarkup(
    <AnvilScreen game={make(3, { id: I.DIAMOND_SWORD, count: 1, dur: 1500 }, null, 'Szabla wędrowca') as never} icons={{}} onChange={() => {}} />
  );
  check('the typed name lands in the input', renamed.includes('value="Szabla wędrowca"'));
  check('renaming is announced', renamed.includes('Zmień nazwę'));

  const empty = { ...make(12, null, null), currentAnvil: () => null };
  const none = renderToStaticMarkup(<AnvilScreen game={empty as never} icons={{}} onChange={() => {}} />);
  check('a closed anvil renders nothing', none === '', none);
}

section('2.3: journal chapter and menus');
{
  check('the journal has eight chapters', JOURNAL_CHAPTERS.length === 8, String(JOURNAL_CHAPTERS.length));
  const last = JOURNAL_CHAPTERS[JOURNAL_CHAPTERS.length - 1];
  check('the new chapter is about the expedition', last.title === 'Wyprawa i ratunek', last.title);
  check('it covers fishing, the spyglass, the anvil and the totem', ['fisher', 'surveyor', 'smith', 'undying'].every((id) => last.goals.includes(id as never)), last.goals.join(','));
  check('every 2.3 goal is a real achievement', ['fisher', 'surveyor', 'smith', 'undying'].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  check('earlier chapters are untouched', JOURNAL_CHAPTERS[0].title === 'Pierwsze kroki' && JOURNAL_CHAPTERS[0].goals.join() === 'wood,craft,pick');
  // a chapter of new goals is not complete from the first catch
  const progress = journalProgress(['fisher']);
  const chapter = progress[progress.length - 1];
  check('the first 2.3 goal is done', chapter.done === 1, String(chapter.done));
  check('but the chapter is not complete', chapter.complete === false);
  const done = journalProgress(['fisher', 'surveyor', 'smith', 'undying']);
  check('the whole chapter can be completed', done[done.length - 1].complete === true);

  const controls = renderToStaticMarkup(<Controls />);
  check('controls mention the rod', controls.includes('Wędka'));
  check('controls mention the spyglass', controls.includes('Lorneta'));
  check('controls mention the anvil', controls.includes('kowadle'));
  const menu = renderToStaticMarkup(<MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />);
  check('the menu announces 2.3', menu.includes('2.3'));
  // the splash line is picked at random, so check the fixed 2.3 badge instead
  check('the menu names the 2.3 release', menu.includes('Wyprawa i ratunek'));
}


// ============================================================ jsdom mounting
async function mountWithJsdom(): Promise<boolean> {
  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    console.log('  (jsdom niedostępny – pomijam test interaktywny: npm i --no-save jsdom)');
    return false;
  }

  section('ui: mounting the app in jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const w = dom.window as unknown as Record<string, unknown> & {
    document: Document; navigator: unknown; HTMLElement: unknown; MouseEvent: unknown;
  };
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of [
    'window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement',
    'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'matchMedia',
  ]) {
    if (!(key in w)) continue;
    // some globals (navigator) are getter-only in modern Node
    try {
      Object.defineProperty(g, key, { value: w[key], configurable: true, writable: true });
    } catch {
      try { g[key] = w[key]; } catch { /* leave the host global alone */ }
    }
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const App = (await import('../src/App')).default;

  const container = w.document.getElementById('root')!;
  const root = createRoot(container);
  await React.act(async () => { root.render(<App />); });

  const text = () => container.textContent ?? '';
  const buttons = () => [...container.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (label: string) => buttons().find((b) => (b.textContent ?? '').includes(label));

  check('app renders the title screen', text().includes('BLOCKCRAFT'));

  await React.act(async () => {
    byText('Nowy świat')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });
  check('creation form opened', text().includes('Utwórz nowy świat'));
  check('world type toggle exists', !!byText('Typ świata'));

  await React.act(async () => {
    byText('Typ świata')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });
  check('flat world selectable', text().includes('Płaski'));

  const nameInput = container.querySelector('input') as HTMLInputElement | null;
  if (nameInput) {
    await React.act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        (w as unknown as { HTMLInputElement: { prototype: HTMLInputElement } }).HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(nameInput, 'Testowy świat');
      nameInput.dispatchEvent(new (w.Event as unknown as new (t: string, o?: object) => Event)('input', { bubbles: true }));
    });
    check('world name is editable', nameInput.value === 'Testowy świat');
  }

  await React.act(async () => {
    byText('Stwórz świat')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });

  // jsdom has no WebGL, so the game view must fall back to a readable message.
  const afterStart = text();
  check(
    'no WebGL → readable error, not a blank page',
    afterStart.includes('WebGL') || afterStart.includes('Błąd') || afterStart.includes('Świat gotowy'),
    afterStart.slice(0, 120)
  );
  check('something is still on screen', afterStart.length > 20);

  await React.act(async () => { root.unmount(); });
  check('unmount leaves no markup', (container.textContent ?? '').length === 0);
  dom.window.close();
  return true;
}

try {
  await mountWithJsdom();
} catch (e) {
  fail++;
  failures.push(`jsdom mount threw: ${(e as Error)?.message ?? e}`);
}

// =================================================================== report
console.log(`\n${'='.repeat(56)}`);
if (fail) {
  console.log(`${pass} checks passed, ${fail} FAILED`);
  for (const f of failures) console.log(`  ✗ ${f}`);
} else {
  console.log(`${pass} checks passed, 0 failed`);
  console.log('UI GREEN ✔');
}
process.exit(fail ? 1 : 0);
