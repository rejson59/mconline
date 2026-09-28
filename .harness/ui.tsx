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
import { DEFAULT_DIFFICULTY, normalizeDifficulty, type WorldDifficulty } from '../src/game/difficulty';
import SettingsScreen from '../src/components/SettingsScreen';
import JournalScreen, { JOURNAL_CHAPTERS, journalProgress } from '../src/components/JournalScreen';
import EnchantScreen from '../src/components/EnchantScreen';
import TradeScreen from '../src/components/TradeScreen';
import WaypointsScreen from '../src/components/WaypointsScreen';
import DiscoveryMapView from '../src/components/DiscoveryMapView';
import BiomeCompassScreen from '../src/components/BiomeCompassScreen';
import { DiscoveryMap } from '../src/game/discoveryMap';
import { World } from '../src/game/world';
import AnvilScreen from '../src/components/AnvilScreen';
import BrewingScreen from '../src/components/BrewingScreen';
import InventoryScreen from '../src/components/InventoryScreen';
import { anvilResult } from '../src/game/anvil';
import { Inventory, RECIPES } from '../src/game/inventory';
import { I, isFood, isPotion, stackLimit } from '../src/game/items';
import { B, BLOCKS } from '../src/game/blocks';
import { applyBrew, emptyBrewing, tickBrewing, POTIONS, HEAL_AMOUNT } from '../src/game/brewing';
import type { Stack } from '../src/game/inventory';
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
  for (const [idx, name, product] of [[5, 'Kartograf', 'Kompas'], [6, 'Rybak', 'Wędka'], [7, 'Ogrodnik', 'Sadzonka']] as const) {
    const job = createVillagerState(idx, 0);
    const screen = renderToStaticMarkup(<TradeScreen game={{
      ...fake, tradeMob: { trade: job }, tradeTitle: () => name,
      tradeRows: () => offersFor(job).map((offer, index) => ({ index, offer, left: offer.uses, max: offer.uses, blocked: 'items' as const })),
    } as unknown as Game} icons={{}} onChange={noop} />);
    check(`${name} is shown with job-specific stock on the trading screen`, screen.includes(name) && screen.includes(product));
  }
}

section('inventory screen: recipe finder');
{
  const fake = {
    inventory: new Inventory(),
    mode: 'survival',
    craftingTable: false,
    armor: [null, null, null, null],
    selected: 0,
    clickArmorSlot: noop,
    onCraft: noop,
    body: { pos: { x: 0, y: 65, z: 0 } },
    spawnDrop: noop,
    message: noop,
  };
  const html = renderToStaticMarkup(<InventoryScreen game={fake as unknown as Game} icons={{}} onChange={noop} />);
  check('crafting screen includes recipe search', html.includes('Szukaj receptur po nazwie lub składniku'));
  check('crafting screen can filter craftable recipes', html.includes('aria-pressed="false"') && html.includes('Możliwe'));
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
    challenges: { challenge_builder: 7, challenge_hunter: 2, challenge_explorer: 1 },
  };
  const html = renderToStaticMarkup(
    <JournalScreen hud={hud as never} unlocked={unlocked} onClose={noop} />
  );
  check('journal shows world and progress summary', html.includes('Nowy świat') && html.includes('Postęp przygody'));
  check('journal lists unfinished objectives', html.includes('Wyprawa pod ziemię') && html.includes('Diamenty!'));
  check('journal includes accessible progress indicators', html.includes('role="progressbar"') && html.includes('aria-valuenow="3"'));
  check('journal shows world seed and return hint', html.includes('1234') && html.includes('powrót do gry'));
  check('journal lists measurable building, combat and exploration challenges', html.includes('Budowniczy osady') && html.includes('Obrońca szlaku') && html.includes('Wędrowiec biomów') && html.includes('7/20') && html.includes('2/5') && html.includes('1/3'));
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
  check('main menu shows release 2.7', menu.includes('WERSJA 2.7') && menu.includes('Nowe horyzonty'));
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
    <PauseMenu settings={DEFAULT_SETTINGS} shareUrl="http://x/#seed=1" onSettings={noop} onResume={noop} onJournal={noop} onQuit={noop} onSave={() => true} />
  );
  check('pause menu offers resume and save', pause.includes('Wróć do gry') && pause.includes('Zapisz świat'));
  check('pause menu opens the adventure journal', pause.includes('Dziennik przygód'));
  check('pause menu counts achievements', pause.includes(`/${ACHIEVEMENTS.length}`));
  const worldPause = renderToStaticMarkup(<PauseMenu settings={DEFAULT_SETTINGS} shareUrl="http://x/#seed=1"
    difficulty={DEFAULT_DIFFICULTY} onDifficulty={() => true} onSettings={noop} onResume={noop} onJournal={noop} onQuit={noop} onSave={() => true} />);
  check('per-world difficulty is visible in the pause menu but not global settings', worldPause.includes('Trudność świata') && !pause.includes('Trudność świata'));


  // 2.0: ekran opcji (zakładki, presety jakości, sterowanie dotykowe)
  const settingsHtml = renderToStaticMarkup(
    <SettingsScreen settings={DEFAULT_SETTINGS} onChange={noop} onClose={noop} />
  );
  check('settings screen shows quality presets', settingsHtml.includes('Niskie') && settingsHtml.includes('Wysokie'));
  check('settings screen shows auto mode', settingsHtml.includes('Auto'));
  check('settings screen shows touch options', settingsHtml.includes('Ekran dotykowy') && settingsHtml.includes('Wibracje'));
  check('settings screen shows fps cap option', settingsHtml.includes('Limit klatek'));
  check('graphics panel has independent texture and effect quality controls', settingsHtml.includes('Tekstury: Auto') && settingsHtml.includes('Efekty: Auto'));
  const manualVisuals = renderToStaticMarkup(<SettingsScreen settings={{ ...DEFAULT_SETTINGS, textureDetail: 'low', effectDetail: 'full' }} onChange={noop} onClose={noop} />);
  check('graphics panel describes actual detail choices', manualVisuals.includes('8 px/kafelek') && manualVisuals.includes('Efekty: Pełne'));
  // 2.5: wyraźny podział wersji PC i dotykowej w opcjach
  check('settings show the control mode selector', settingsHtml.includes('Tryb sterowania'));
  check('control mode selector explains the hybrid case', settingsHtml.includes('laptop'));
  const forcedPc = renderToStaticMarkup(
    <SettingsScreen settings={{ ...DEFAULT_SETTINGS, controlMode: 'desktop' }} onChange={noop} onClose={noop} />
  );
  check('forced PC mode is labelled', forcedPc.includes('Komputer (mysz + klawiatura)'));
  const forcedTouch = renderToStaticMarkup(
    <SettingsScreen settings={{ ...DEFAULT_SETTINGS, controlMode: 'touch' }} onChange={noop} onClose={noop} />
  );
  check('forced touch mode is labelled', forcedTouch.includes('Dotyk (telefon / tablet)'));
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
    activeWaypointId: 'home', isInNether: false, discovery: new DiscoveryMap(),
    body: { pos: { x: 10, y: 65, z: -2 } },
    currentDimension: () => 'overworld', addWaypoint: () => null,
    activateWaypoint: noop, removeWaypoint: noop,
  };
  const html = renderToStaticMarkup(<WaypointsScreen game={fake as unknown as Game} onClose={noop} />);
  check('waypoint screen describes navigation', html.includes('Punkty podróży') && html.includes('minimapie'));
  check('waypoint screen lists coordinates and tracking state', html.includes('Baza') && html.includes('12, 65, -4') && html.includes('Nie śledź'));
  check('waypoint screen supports creating points at the current position', html.includes('Dodaj tutaj'));
  check('map reachable in waypoint screen on PC and touch', html.includes('Mapa odkrywania') && html.includes('Przesuń mapę na północ') && html.includes('Do mnie'));
}

section('3.0: biome compass selection screen');
{
  const game = { homeWorld: new World(12345), body: { pos: { x: 0, z: 0 } } };
  const html = renderToStaticMarkup(<BiomeCompassScreen game={game as unknown as Game} onClose={noop} />);
  check('compass has selectable biomes and search action', html.includes('Kompas biomów') &&
    html.includes('Tajga') && html.includes('Pustkowie') && html.includes('Kwiecista łąka') && html.includes('Szukaj biomu'));
  check('compass describes radius and returns to game', html.includes('1024') && html.includes('Wróć do gry'));
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

section('2.4: brewing screen');
{
  const makeBrewing = (stand: ReturnType<typeof emptyBrewing>) => {
    return {
      inventory: new Inventory(),
      currentBrewing: () => stand,
      clickBrewing: () => {},
      closeInventory: () => {},
      emitHud: () => {},
    };
  };

  const fresh = emptyBrewing(0, 1, 0);
  const brew = renderToStaticMarkup(<BrewingScreen game={makeBrewing(fresh) as never} icons={{}} onChange={() => {}} />);
  check('the brewing panel has a title', brew.includes('Statyw alchemiczny'));
  check('it lists three bottles', (brew.match(/Fiolka \d/g) ?? []).length === 3);
  check('it shows the ingredient and fuel slots', brew.includes('Składnik') && brew.includes('Paliwo'));
  check('a fresh stand asks for fuel', brew.includes('Dość płomiennej różdżki'));
  check('the brewing recipe list shows both new paths and their effects', brew.includes('Napój lekkiego lądowania') && brew.includes('Napój zrywu') && brew.includes('Nie otrzymujesz obrażeń od upadku') && brew.includes('Biegniesz o 45%'));

  const lit = emptyBrewing(0, 1, 0);
  lit.bottles[0] = { id: I.WATER_BOTTLE, count: 1 };
  lit.ingredient = { id: I.NETHER_WART, count: 1 };
  lit.fuel = { id: I.BLAZE_ROD, count: 2 };
  lit.progress = 4;
  const brewing = renderToStaticMarkup(<BrewingScreen game={makeBrewing(lit) as never} icons={{}} onChange={() => {}} />);
  check('a lit stand announces brewing', brewing.includes('Warzenie…'));
  check('the fuel is counted', brewing.includes('2 × różdżka'));

  const gone = { ...makeBrewing(fresh), currentBrewing: () => null };
  const nothing = renderToStaticMarkup(<BrewingScreen game={gone as never} icons={{}} onChange={() => {}} />);
  check('a closed stand renders nothing', nothing === '', nothing);
}

section('2.3/2.4: journal chapter and menus');
{
  check('the journal has eleven chapters', JOURNAL_CHAPTERS.length === 11, String(JOURNAL_CHAPTERS.length));
  const last = JOURNAL_CHAPTERS.find((chapter) => chapter.title === 'Godzina alchemika')!;
  check('the latest chapter is about the alchemist hour', last.title === 'Godzina alchemika', last.title);
  check('it covers brewing, healing, fire and mastery', ['alchemist', 'tonic', 'fireproof', 'potioneer'].every((id) => last.goals.includes(id as never)), last.goals.join(','));
  check('new challenge chapter has three real achievements', JOURNAL_CHAPTERS.some((chapter) => chapter.title === 'Wyzwania świata' && chapter.goals.every((id) => ACHIEVEMENTS.some((a) => a.id === id))));
  const biomeChapter = JOURNAL_CHAPTERS.find((chapter) => chapter.title === 'Szlak sześciu biomów');
  check('biome expedition is playable in the journal', !!biomeChapter && biomeChapter.goals.length === 6 && biomeChapter.goals.every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  check('journal remembers partial biome visits', journalProgress(['biome_swamp']).find((c) => c.title === 'Szlak sześciu biomów')?.done === 1);
  check('every 2.4 goal is a real achievement', ['alchemist', 'tonic', 'fireproof', 'potioneer'].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  const expedition = JOURNAL_CHAPTERS.find((chapter) => chapter.title === 'Wyprawa i ratunek')!;
  check('the 2.3 chapter stays intact', expedition.title === 'Wyprawa i ratunek' && ['fisher', 'surveyor', 'smith', 'undying'].every((id) => expedition.goals.includes(id as never)), expedition.goals.join(','));
  check('earlier chapters are untouched', JOURNAL_CHAPTERS[0].title === 'Pierwsze kroki' && JOURNAL_CHAPTERS[0].goals.join() === 'wood,craft,pick');
  // a chapter of new goals is not complete from the first brew
  const progress = journalProgress(['alchemist']);
  const chapter = progress.find((c) => c.title === 'Godzina alchemika')!;
  check('the first 2.4 goal is done', chapter.done === 1, String(chapter.done));
  check('but the chapter is not complete', chapter.complete === false);
  const done = journalProgress(['alchemist', 'tonic', 'fireproof', 'potioneer']);
  check('the whole chapter can be completed', done.find((c) => c.title === 'Godzina alchemika')?.complete === true);

  const controls = renderToStaticMarkup(<Controls />);
  check('controls mention the rod', controls.includes('Wędka'));
  check('controls mention the spyglass', controls.includes('Lorneta'));
  check('controls mention the anvil', controls.includes('kowadle'));
  check('controls mention the brewing stand', controls.includes('statywie alchemicznym'));
  // 2.5: nowe skróty i podział sekcji sterowania
  check('controls split PC and touch sections', controls.includes('Komputer (mysz + klawiatura)') && controls.includes('Telefon i tablet'));
  check('controls document Ctrl+Q', controls.includes('Ctrl+Q'));
  check('controls document Esc-to-resume', controls.includes('Esc w pauzie wraca do gry'));
  check('controls document respawn key', controls.includes('Enter / R (ekran śmierci)'));
  check('controls document touch long-press in windows', controls.includes('przytrzymaj: połowa / jeden'));
  const menu = renderToStaticMarkup(<MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />);
  check('the menu announces release 2.7', menu.includes('2.7'));
  // the splash line is picked at random, so check the fixed version badge instead
  check('the menu names the 2.7 release', menu.includes('WERSJA 2.7'));
}

section('2.4: brewing rules');
{
  const b = emptyBrewing(0, 1, 0);
  check('a fresh stand holds three empty bottles', b.bottles.length === 3 && b.bottles.every((x) => x === null));
  // water + nether wart = awkward base
  const base: (Stack | null)[] = [{ id: I.WATER_BOTTLE, count: 1 }, null, null];
  let res = applyBrew(base, I.NETHER_WART);
  check('water + wart = awkward', res.brewed === true && res.bottles[0]?.id === I.POTION_AWKWARD);
  // awkward + glowstone = regeneration
  const awk: (Stack | null)[] = [{ id: I.POTION_AWKWARD, count: 1 }, null, null];
  res = applyBrew(awk, I.GLOWSTONE_DUST);
  check('awkward + dust = regeneration', res.brewed === true && res.bottles[0]?.id === I.POTION_REGEN);
  // water + dust = night vision (not regeneration)
  res = applyBrew(base, I.GLOWSTONE_DUST);
  check('water + dust = night vision', res.brewed === true && res.bottles[0]?.id === I.POTION_NIGHT);
  // healing, fire, speed, strength
  check('water + tear = healing', applyBrew(base, I.GHAST_TEAR).bottles[0]?.id === I.POTION_HEAL);
  check('water + magma = fire', applyBrew(base, I.MAGMA_CREAM).bottles[0]?.id === I.POTION_FIRE);
  check('water + sugar = speed', applyBrew(base, I.SUGAR).bottles[0]?.id === I.POTION_SPEED);
  check('water + rod = strength', applyBrew(base, I.BLAZE_ROD).bottles[0]?.id === I.POTION_STRENGTH);
  // a finished potion cannot be re-brewed
  const healed: (Stack | null)[] = [{ id: I.POTION_HEAL, count: 1 }, null, null];
  check('healing + wart does nothing', applyBrew(healed, I.NETHER_WART).brewed === false);
  // an empty bottle is left alone
  const emptySlots: (Stack | null)[] = [null, null, null];
  check('empty slots never brew', applyBrew(emptySlots, I.NETHER_WART).brewed === false);

  // the stand ticks a full 8 s batch and spends fuel
  const stand = emptyBrewing(0, 1, 0);
  stand.bottles[0] = { id: I.WATER_BOTTLE, count: 1 };
  stand.ingredient = { id: I.NETHER_WART, count: 1 };
  stand.fuel = { id: I.BLAZE_ROD, count: 1 };
  let doneCount = 0;
  for (let t = 0; t < 8.01; t += 0.5) { if (tickBrewing(stand, 0.5).done) doneCount++; }
  check('one batch finishes in 8 s', doneCount === 1 && stand.bottles[0]?.id === I.POTION_AWKWARD);
  check('a single rod is spent and two brews are banked', stand.fuel === null && stand.fuelLeft === 2);
  // the ingredient survives the brew
  check('the ingredient is not consumed', stand.ingredient?.id === I.NETHER_WART);
  // a stand with no fuel never starts
  const noFuel = emptyBrewing(0, 1, 0);
  noFuel.bottles[0] = { id: I.WATER_BOTTLE, count: 1 };
  noFuel.ingredient = { id: I.NETHER_WART, count: 1 };
  for (let t = 0; t < 20; t += 1) tickBrewing(noFuel, 1);
  check('no fuel, no brew', noFuel.bottles[0]?.id === I.WATER_BOTTLE && noFuel.progress === 0);
  // an invalid ingredient never starts a batch
  const badIng = emptyBrewing(0, 1, 0);
  badIng.bottles[0] = { id: I.WATER_BOTTLE, count: 1 };
  badIng.fuel = { id: I.BLAZE_ROD, count: 1 };
  badIng.ingredient = { id: B.STONE, count: 1 };
  for (let t = 0; t < 20; t += 1) tickBrewing(badIng, 1);
  check('stone is not a brewing ingredient', badIng.bottles[0]?.id === I.WATER_BOTTLE && badIng.progress === 0);
}

section('3.0 #52: rabbit food UI metadata');
{
  check('raw and cooked rabbit display as food', isFood(I.RAW_RABBIT) && isFood(I.COOKED_RABBIT));
  check('rabbit items do not overwrite existing blocks', !BLOCKS[I.RAW_RABBIT] && !BLOCKS[I.COOKED_RABBIT]);
  check('rabbit cuts use normal inventory stacks', stackLimit(I.RAW_RABBIT) === 64 && stackLimit(I.COOKED_RABBIT) === 64);
}

section('2.4: potion item metadata');
{
  const potionIds = [I.POTION_AWKWARD, I.POTION_HEAL, I.POTION_FIRE, I.POTION_SPEED, I.POTION_NIGHT, I.POTION_STRENGTH, I.POTION_REGEN, I.POTION_FALL, I.POTION_SPRINT];
  check('all potions are drinkable', potionIds.every((id) => isPotion(id)));
  check('potion effect metadata is complete', potionIds.every((id) => !!POTIONS[id]?.name));
  check('healing is the instant effect', POTIONS[I.POTION_HEAL]?.effect === 'heal' && HEAL_AMOUNT === 7);
  check('fire resistance is 45 s', POTIONS[I.POTION_FIRE]?.effect === 'fire' && POTIONS[I.POTION_FIRE]?.duration === 45);
  check('night vision is 30 s', POTIONS[I.POTION_NIGHT]?.effect === 'night' && POTIONS[I.POTION_NIGHT]?.duration === 30);
  check('speed is 20 s', POTIONS[I.POTION_SPEED]?.effect === 'speed' && POTIONS[I.POTION_SPEED]?.duration === 20);
  check('strength is 15 s', POTIONS[I.POTION_STRENGTH]?.effect === 'strength' && POTIONS[I.POTION_STRENGTH]?.duration === 15);
  check('regeneration is 10 s', POTIONS[I.POTION_REGEN]?.effect === 'regen' && POTIONS[I.POTION_REGEN]?.duration === 10);
  check('new items do not collide with blocks', potionIds.every((id) => !BLOCKS[id]) && !BLOCKS[I.SUGAR] && !BLOCKS[I.BOTTLE] && !BLOCKS[I.WATER_BOTTLE] && !BLOCKS[I.HONEY_BOTTLE]);
  check('bottles stack to 16', potionIds.every((id) => stackLimit(id) === 16));
  check('honey bottle is food', isFood(I.HONEY_BOTTLE) === true);
  check('the three new recipes are registered',
    RECIPES.some((r) => r.out.id === I.SUGAR) &&
    RECIPES.some((r) => r.out.id === I.BOTTLE) &&
    RECIPES.some((r) => r.out.id === I.HONEY_BOTTLE));
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
  // Canvas drawing is stubbed; gestures/buttons are mounted for real with React.
  const canvasProto = (w as unknown as { HTMLCanvasElement: typeof HTMLCanvasElement }).HTMLCanvasElement.prototype;
  canvasProto.getContext = ((kind: string) => kind === '2d' ? { fillStyle: '', fillRect() {} } : null) as typeof canvasProto.getContext;
  const gfxContainer = w.document.createElement('div');
  w.document.body.appendChild(gfxContainer);
  const gfxRoot = createRoot(gfxContainer);
  function GraphicsHarness() {
    const [value, setValue] = React.useState({ ...DEFAULT_SETTINGS });
    return <SettingsScreen settings={value} onChange={setValue} onClose={noop} />;
  }
  await React.act(async () => { gfxRoot.render(<GraphicsHarness />); });
  const gfxButton = (text: string) => [...gfxContainer.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  await React.act(async () => { gfxButton('Tekstury:').click(); });
  await React.act(async () => { gfxButton('Efekty:').click(); });
  check('live texture and effect controls respond independently to clicks', gfxContainer.textContent?.includes('Tekstury: Oszczędne') && gfxContainer.textContent?.includes('Efekty: Oszczędne'), gfxContainer.textContent ?? '');
  await React.act(async () => { gfxButton('Tekstury:').click(); });
  check('texture detail cycles to full without changing effects', gfxContainer.textContent?.includes('Tekstury: Pełne') && gfxContainer.textContent?.includes('Efekty: Oszczędne'), gfxContainer.textContent ?? '');
  await React.act(async () => { gfxRoot.unmount(); });
  gfxContainer.remove();

  const difficultyContainer = w.document.createElement('div');
  w.document.body.appendChild(difficultyContainer);
  const difficultyRoot = createRoot(difficultyContainer);
  const selected: WorldDifficulty[] = [];
  function DifficultyHarness() {
    const [value, setValue] = React.useState<WorldDifficulty>({ ...DEFAULT_DIFFICULTY });
    return <PauseMenu settings={DEFAULT_SETTINGS} shareUrl="http://x/#seed=1" difficulty={value}
      onDifficulty={(patch) => { const next = normalizeDifficulty({ ...value, ...patch }); selected.push(next); setValue(next); return true; }}
      onSettings={noop} onResume={noop} onJournal={noop} onQuit={noop} onSave={() => true} />;
  }
  await React.act(async () => { difficultyRoot.render(<DifficultyHarness />); });
  const button = (text: string) => Array.from(difficultyContainer.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  await React.act(async () => { button('Trudność świata').click(); });
  check('three independent rules are presented in the world panel', difficultyContainer.textContent?.includes('Agresja mobów') && difficultyContainer.textContent.includes('Obrażenia od potworów') && difficultyContainer.textContent.includes('Zasoby (rudy, plony, mięso)'));
  await React.act(async () => { button('Spokojna:').click(); });
  await React.act(async () => { button('Surowe:').click(); });
  await React.act(async () => { button('Obfite:').click(); });
  check('touch-sized controls change all three world axes independently', selected.at(-1)?.aggression === 'spokojna' && selected.at(-1)?.damage === 'surowe' && selected.at(-1)?.resources === 'obfite');
  await React.act(async () => { difficultyRoot.unmount(); });
  difficultyContainer.remove();

  const mapData = new DiscoveryMap();
  mapData.survey('overworld', 0, 0, 'Równiny', 65);
  const markers: { id: string; name: string; x: number; y: number; z: number; dimension: 'overworld' }[] = [];
  const mapGame = {
    body: { pos: { x: 4, z: 4 } }, discovery: mapData, waypoints: markers, activeWaypointId: null,
    currentDimension: () => 'overworld',
    addWaypoint: (name: string, _kind: string, at: { x: number; y: number; z: number }) => {
      const point = { id: 'map-1', name, ...at, dimension: 'overworld' as const };
      markers.push(point);
      return point;
    },
  };
  const mapContainer = w.document.createElement('div');
  w.document.body.appendChild(mapContainer);
  const mapRoot = createRoot(mapContainer);
  await React.act(async () => { mapRoot.render(<DiscoveryMapView game={mapGame as unknown as Game} focus={null} onChange={noop} />); });
  check('interactive map starts at current position', mapContainer.textContent?.includes('1 odkrytych pól') === true);
  const centerButton = [...mapContainer.querySelectorAll('button')].find((b) => b.textContent?.includes('Zaznacz środek mapy')) as HTMLButtonElement;
  await React.act(async () => { centerButton.click(); });
  check('keyboard-accessible centre marker creates a real waypoint', markers.length === 1 && markers[0].x === 8 && markers[0].z === 8);
  await React.act(async () => { (mapContainer.querySelector('[aria-label="Przesuń mapę na północ"]') as HTMLButtonElement).click(); });
  check('unexplored map centre cannot be marked', centerButton.disabled);
  await React.act(async () => { (mapContainer.querySelector('button') as HTMLButtonElement).click(); });
  await React.act(async () => { mapRoot.unmount(); });
  mapContainer.remove();

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
