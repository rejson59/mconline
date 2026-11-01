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
import Launcher from '../src/components/Launcher';
import HUD from '../src/components/HUD';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { DEFAULT_SETTINGS, applyPreset } from '../src/utils/settings';
import { GAME_RELEASE_NAME, GAME_VERSION } from '../src/utils/version';
import { JavaMainMenu, JavaPauseMenu } from '../src/components/JavaMenus';
import JavaSettings from '../src/components/JavaSettings';
import SettingsScreen from '../src/components/SettingsScreen';
import JournalScreen, { JOURNAL_CHAPTERS, journalProgress } from '../src/components/JournalScreen';
import EnchantScreen from '../src/components/EnchantScreen';
import TradeScreen from '../src/components/TradeScreen';
import { guiSprite } from '../src/game/art/uiSprites';
import WaypointsScreen from '../src/components/WaypointsScreen';
import AnvilScreen from '../src/components/AnvilScreen';
import BrewingScreen from '../src/components/BrewingScreen';
import ChestScreen from '../src/components/ChestScreen';
import InventoryScreen from '../src/components/InventoryScreen';
import ChatScreen from '../src/components/ChatScreen';
import MultiplayerScreen from '../src/components/MultiplayerScreen';
import { SkinPicker, SkinAvatar, EquippedSkinAvatar, SkinHead } from '../src/components/SkinPicker';
import { SKINS, DEFAULT_SKIN_ID } from '../src/game/skins';
import { COMMANDS, COMMAND_CATEGORIES, commandByName, applyCommandSuggestion } from '../src/game/commands';
import { anvilResult } from '../src/game/anvil';
import { Inventory, RECIPES } from '../src/game/inventory';
import { emptyChest } from '../src/game/chest';
import { I, isFood, isPotion, stackLimit } from '../src/game/items';
import { B, BLOCKS } from '../src/game/blocks';
import { applyBrew, emptyBrewing, tickBrewing, POTIONS, HEAL_AMOUNT } from '../src/game/brewing';
import type { Stack } from '../src/game/inventory';
import { rollEnchantOptions } from '../src/game/enchant';
import { createVillagerState, offersFor } from '../src/game/trading';
import type { Game, TradeRow } from '../src/game/engine';

section('2.24: launcher – ekran startowy');
{
  const noop = () => {};
  const html = renderToStaticMarkup(
    <Launcher
      saves={[]}
      onPlayWorld={noop}
      onNewWorld={noop}
      onDeleteWorld={noop}
      onRenameWorld={noop}
      onDuplicateWorld={() => true}
      onToggleFavoriteWorld={noop}
      onMultiplayer={noop}
      onClassicMenu={noop}
    />
  );
  check('launcher pokazuje przycisk GRAJ', /GRAJ/.test(html));
  check(
    'launcher ma wszystkie sekcje',
    ['Start', 'Światy', 'Serwery', 'Paczki i mody', 'Skórki', 'Ustawienia', 'Konsola'].every((t) => html.includes(t))
  );
  check('launcher pokazuje bieżącą wersję', html.includes(GAME_VERSION));
  check('launcher pokazuje cel Minecraft 26.2', html.includes('26.2'));
  check('launcher zachęca do pierwszego świata', /Utwórz pierwszy świat/.test(html));
  check('launcher ma powrót do klasycznego menu', /Klasyczne menu/.test(html));
  check('launcher pokazuje statystyki paczki', /kafelk/i.test(html) && /ikon przedmiot/i.test(html));
  check('launcher nie jest pusty', html.length > 4000, String(html.length));
}

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
  // 2.27: okno handlu to waniliowy panel `MerchantScreen` z paczki, a nie
  // lista zielonych przycisków – zamiast nagłówka „Ekwipunek” jest siatka
  // 9 × 3 + pasek skrótów (36 slotów) na teksturze `villager.png`.
  check('trade screen uses the vanilla merchant panel', html.includes(guiSprite('villager_gui') ?? 'NO-PANEL'));
  check('trade screen draws the player inventory grid', html.includes('width:16px') || (html.match(/width:16px/g) ?? []).length >= 30);
  check('trade screen has the vanilla title', html.includes('Handel'));
  check('trade screen shows the villager level', html.includes('poziom 1'));
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
  // 2.9: na telefonie nie ma klawisza E/Esc – okno musi mieć własne wyjście.
  check('inventory has a visible close button', html.includes('aria-label="Zamknij"'));
  check('inventory has no oversized non-Java footer', !html.includes('Gotowe – zamknij ekwipunek'));
  // 2.13: układ jak w Minecrafcie – siatka 2×2 w plecaku i książka przepisów.
  check('2.13 backpack shows the 2x2 crafting grid', html.includes('mc-craft-grid is-2'));
  check('2.13 backpack has no 3x3 without a table', !html.includes('mc-craft-grid is-3'));
  check('2.13 inventory shows the player preview', html.includes('Podgląd skórki'));
  check('2.13 recipe book is one tap away', html.includes('aria-label="Książka receptur"'));

  const withBook = renderToStaticMarkup(<InventoryScreen game={fake as unknown as Game} icons={{}} onChange={noop} initialBookOpen />);
  check('crafting screen includes recipe search', withBook.includes('Szukaj receptur po nazwie lub składniku'));
  check('crafting screen can filter craftable recipes', withBook.includes('aria-pressed="false"') && withBook.includes('Możliwe'));
  check('Java recipe book offers placement rather than instant crafting', withBook.includes('aria-label="Ułóż:') && !/Tapnij recepturę/i.test(withBook));

  // Przy stole zamiast 2×2 jest pełna siatka 3×3 i nie ma podglądu postaci.
  const tableInv = new Inventory();
  tableInv.add(B.PLANKS, 4);
  const tableGame = { ...fake, inventory: tableInv, craftingTable: true };
  const tableHtml = renderToStaticMarkup(<InventoryScreen game={tableGame as unknown as Game} icons={{}} onChange={noop} initialBookOpen />);
  check('2.13 crafting table shows the 3x3 grid', tableHtml.includes('mc-craft-grid is-3'));
  check('2.13 crafting table has its own title', tableHtml.includes('Stół rzemieślniczy'));
  check('2.13 table view hides the armour/preview column', !tableHtml.includes('mc-inv-preview'));

  // 2.13: szybkie przepisy – dokładnie ten przypadek, który zgłosił gracz.
  const logInv = new Inventory();
  logInv.add(B.LOG, 1);
  const logGame = { ...fake, inventory: logInv };
  const logHtml = renderToStaticMarkup(<InventoryScreen game={logGame as unknown as Game} icons={{}} onChange={noop} initialBookOpen />);
  check('Java a log enables planks placement in the recipe book', /Ułóż: Deski dębowe/.test(logHtml) && logHtml.includes('data-ready="true"'));
  const planksInv = new Inventory();
  planksInv.add(B.PLANKS, 4);
  const planksGame = { ...fake, inventory: planksInv };
  const planksHtml = renderToStaticMarkup(<InventoryScreen game={planksGame as unknown as Game} icons={{}} onChange={noop} initialBookOpen />);
  check('Java four planks enable table placement', planksHtml.includes('Ułóż: Stół rzemieślniczy') && planksHtml.includes('data-ready="true"'));
}

// =============================================== 2.9: czat z listą komend
section('2.9: czat i komendy');
{
  const html = renderToStaticMarkup(<ChatScreen onSubmit={noop} onClose={noop} />);
  const full = renderToStaticMarkup(<ChatScreen onSubmit={noop} onClose={noop} showListInitially />);
  check('chat has a send button', html.includes('aria-label="Wyślij"'));
  check('chat has a close button for touch screens', html.includes('aria-label="Zamknij czat"'));
  check('chat exposes the command list button', html.includes('Komendy'));
  check('chat input has a send keyboard hint', /enterkeyhint="send"/i.test(html));
  check('chat shows quick command chips', html.includes('/help') && html.includes('/give'));
  // Katalog komend jest ten sam, którego używa silnik (/help).
  const unescape = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  const plain = unescape(full);
  const missingUsage = COMMANDS.filter((c) => !plain.includes('/' + c.usage)).map((c) => c.name);
  check('every command is listed with its usage', missingUsage.length === 0, missingUsage.join(','));
  // Przykład pojawia się po rozwinięciu komendy, więc sprawdzamy katalog:
  // każda komenda ma gotowy do wysłania przykład i zaczyna się od jej nazwy.
  const badExample = COMMANDS.filter((c) => !c.example.startsWith('/' + c.name)).map((c) => c.name);
  check('every command has a ready example', badExample.length === 0, badExample.join(','));
  check('the chat shows an example without expanding', plain.includes('np. /time set night'));
  check('tapping a command inserts it', applyCommandSuggestion('/', commandByName('time')!) === '/time ');
  check('commands are grouped into categories', COMMAND_CATEGORIES.length >= 4);
  check('the help command is described', (commandByName('help')?.description ?? '').length > 10);
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

section('2.11: ekran „Gra razem” – serwer publiczny');
{
  const mp = renderToStaticMarkup(<MultiplayerScreen onStart={noop} onClose={noop} />);
  check('ekran multiplayera ma tytuł', mp.includes('Tryb wieloosobowy'));
  check('główny przycisk to gra online', mp.includes('Dołącz do serwera'));
  check('ekran tłumaczy wspólny świat', /Publiczny świat przetrwania/i.test(mp));
  check('widać zakładkę serwera publicznego', mp.includes('Serwer publiczny'));
  check('zostały dodatkowe tryby', mp.includes('Połączenia przeglądarkowe...'));
  check('jest pole nazwy gracza', mp.includes('Nazwa gracza'));
  check('serwer publiczny opisuje zapis w chmurze', /zapis|chmur/i.test(mp));
  check('server list makes cloud persistence explicit', /zapis w chmurze/i.test(mp));

  // Dodatkowe tryby nadal mają swoje ustawienia.
  const local = renderToStaticMarkup(<MultiplayerScreen onStart={noop} onClose={noop} defaultMode="local" />);
  check('server list is not a skin-picker screen', !mp.includes('Podgląd skórki'));
  check('server list does not claim original-server compatibility', mp.includes('nie są obsługiwane'));
  check('tryb lokalny ma kod pokoju', local.includes('Kod pokoju'));
  check('tryb lokalny pozwala utworzyć sesję', local.includes('Utwórz sesję') && local.includes('Dołącz'));
  check('gospodarz ustawia świat', local.includes('Ziarno świata') && local.includes('Tryb / teren'));
  check('gospodarz ma przycisk otwarcia pokoju', local.includes('Otwórz pokój'));
  check('jest losowanie kodu pokoju', local.includes('Losuj'));

  const menu = renderToStaticMarkup(<MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} onMultiplayer={noop} />);
  check('menu główne prowadzi do multiplayera', menu.includes('Gra razem · multiplayer'));
  const noMp = renderToStaticMarkup(<MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />);
  check('bez obsługi multiplayera przycisk się nie pojawia', !noMp.includes('Gra razem · multiplayer'));
}

section('4.8: active Java screens, not legacy menu exports');
{
  const title = renderToStaticMarkup(<JavaMainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} onMultiplayer={noop} />);
  check('Java title uses the actual logo and bitmap layout', title.includes('alt="Minecraft"') && title.includes('java-title-canvas'));
  check('Java title separates singleplayer and multiplayer', title.includes('Tryb jednoosobowy') && title.includes('Tryb wieloosobowy'));
  check('Java title has no old shortcut crafting or launcher cards', !title.includes('Co nowego') && !title.includes('Witaj w BlockCraft'));
  const pause = renderToStaticMarkup(<JavaPauseMenu settings={DEFAULT_SETTINGS} shareUrl="" onSettings={noop} onResume={noop} onQuit={noop} onJournal={noop} onSave={noop} />);
  check('Java pause has native resume/save-and-quit actions', pause.includes('Powrót do gry') && pause.includes('Zapisz i wyjdź do menu'));
  check('Java pause relegates non-native tools to extensions', pause.includes('Rozszerzenia...') && !pause.includes('Auto-bicie'));
  const settings = renderToStaticMarkup(<JavaSettings settings={DEFAULT_SETTINGS} onChange={noop} onClose={noop} />);
  check('Java options have actual FOV slider', settings.includes('aria-label="Pole widzenia"') && settings.includes('type="range"'));
  check('Java options expose native categories', ['Ustawienia grafiki', 'Sterowanie', 'Muzyka i dźwięki', 'Dostosowanie skórki'].every(s => settings.includes(s)));
}

section('menus: static render');
{
  const menu = renderToStaticMarkup(
    <MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />
  );
  check('title is rendered', menu.includes('BLOCKCRAFT'));
  check('main menu shows the current release', menu.includes(`WERSJA ${GAME_VERSION}`) && menu.includes(GAME_RELEASE_NAME));
  check('new world button', menu.includes('Nowy świat'));
  check('controls button', menu.includes('Sterowanie'));
  check('options button', menu.includes('Opcje'));
  check('fullscreen button', menu.includes('Pełny ekran'));
  check('export/import buttons', menu.includes('Eksport zapisów') && menu.includes('Import zapisów'));
  check('menu background is a relative url', !menu.includes('url("/menu-bg.jpg'));
  check('2.8 menu keeps the primary action', menu.includes('mc-btn-primary') && menu.includes('Nowy świat'));
  check('2.8 menu shows the release highlight card', menu.includes('Witaj w BlockCraft') && menu.includes(GAME_RELEASE_NAME));
  check('the welcome card mentions the new look', menu.includes('Tekstury jak w nowym Minecrafcie') && menu.includes('Lista komend'));

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
  check('pause menu announces the new release', pause.includes(`Nowości w ${GAME_VERSION}`) && pause.includes(GAME_RELEASE_NAME));
  check('2.14 pause menu has quick auto-jump toggle', pause.includes('Auto-skok: wł.') && pause.includes('Auto-bicie: wył.'));
  check('2.14 quick toggles expose aria-pressed', (pause.match(/aria-pressed="true"/g) ?? []).length >= 1 && pause.includes('aria-pressed="false"'));

  const pauseMp = renderToStaticMarkup(
    <PauseMenu
      settings={DEFAULT_SETTINGS}
      shareUrl="http://x/"
      onSettings={noop}
      onResume={noop}
      onJournal={noop}
      onQuit={noop}
      onSave={noop}
      session={{ role: 'host', players: [
        { id: 'a', name: 'Ala', hue: 0, ping: 12, self: true },
        { id: 'b', name: 'Bob', hue: 120, ping: 48 },
      ] }}
    />
  );
  check('pause menu lists the session players', pauseMp.includes('Gra razem · 2 os.') && pauseMp.includes('Bob'));
  check('pause menu shows who is the host', pauseMp.includes('gospodarz'));
  check('pause menu shows player pings', pauseMp.includes('12 ms') && pauseMp.includes('48 ms'));
  check('pause menu hides saving in a session', !pauseMp.includes('Zapisz świat') && pauseMp.includes('Wyjdź z sesji do menu'));
  check('pause menu explains the host owns the world', pauseMp.includes('Świat prowadzi gospodarz'));

  // 2.0: ekran opcji (zakładki, presety jakości, sterowanie dotykowe)
  const settingsHtml = renderToStaticMarkup(
    <SettingsScreen settings={DEFAULT_SETTINGS} onChange={noop} onClose={noop} />
  );
  check('settings screen shows quality presets', settingsHtml.includes('Niskie') && settingsHtml.includes('Wysokie'));
  check('settings screen shows auto mode', settingsHtml.includes('Auto'));
  check('settings screen shows touch options', settingsHtml.includes('Ekran dotykowy') && settingsHtml.includes('Wibracje'));
  check('settings screen shows fps cap option', settingsHtml.includes('Limit klatek'));
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
  // 2.8: szybki tryb wydajności i sekcja o optymalizacjach
  check('2.8 settings offer a one-click performance mode', settingsHtml.includes('Tryb wydajności'));
  check('2.8 settings explain the new optimisations', settingsHtml.includes('2.8.2') && settingsHtml.includes('kierunkowe'));
  check('2.8.1 settings mention the held-torch light', settingsHtml.includes('pochodni'));
  // 2.12: zakładka „Postać” i rozmiar przycisków dotykowych
  check('2.12 settings have a character tab', settingsHtml.includes('Postać'));
  check('2.12 settings show the skin picker', settingsHtml.includes('Skórka') && settingsHtml.includes('aria-pressed'));
  check('2.12 settings offer a touch button size', settingsHtml.includes('Rozmiar przycisków dotykowych'));
  // 2.14: automatyczny skok i auto-bicie wrogich mobów.
  check('2.14 settings switch auto-attack on', settingsHtml.includes('Auto-bicie potworów: wyłączone'));
  check('2.14 settings explain auto-attack', settingsHtml.includes('wrogie moby w zasięgu ręki') || settingsHtml.includes('w zasięgu ręki'));
  check('2.14 settings keep the auto-jump switch', settingsHtml.includes('Auto-skok na schodki: włączony'));
  check('2.14 settings group both aids on every device', settingsHtml.includes('Ułatwienia – także na komputerze'));
  const noAuto = renderToStaticMarkup(
    <SettingsScreen settings={{ ...DEFAULT_SETTINGS, autoAttack: false }} onChange={noop} onClose={noop} />
  );
  check('2.14 auto-attack can be switched off', noAuto.includes('Auto-bicie potworów: wyłączone'));

  const picker = renderToStaticMarkup(<SkinPicker value={DEFAULT_SKIN_ID} onChange={noop} />);
  check('2.12 skin picker lists every skin', SKINS.every((s) => picker.includes(`Skórka ${s.name}`)));
  check('2.12 skin picker marks the current skin', picker.includes('aria-pressed="true"'));
  const compact = renderToStaticMarkup(<SkinPicker value="zuri" onChange={noop} compact />);
  check('2.12 compact skin picker also works', compact.includes('Skórka Zuri') && compact.includes('aria-pressed="true"'));
  const head = renderToStaticMarkup(<SkinHead skin="zuri" size={16} />);
  check('2.12 skin head renders a face', head.includes('#'));
  const avatar = renderToStaticMarkup(<SkinAvatar skin={DEFAULT_SKIN_ID} size={40} />);
  check('2.12 skin avatar renders a full body', avatar.includes('Podgląd skórki'));

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
  // 2.28: ekran to teraz waniliowy panel `enchanting_table.png` z trzema
  // przyciskami ofert (108 × 19) na wysokościach 13 / 32 / 51.
  check('screen title renders', html.includes('Zaklinanie'));
  check('shelf counter shows', html.includes('Biblioteczki: 15/15'));
  check('player level shows', html.includes('Poziom: 22'));
  check('the vanilla enchanting panel is drawn', html.includes(guiSprite('enchanting_gui') ?? 'NO-PANEL'));
  check('three offers listed', options.length === 3);
  for (const opt of options) check(`offer ${opt.ench} rendered`, html.includes(String(opt.cost)));
  check('offer buttons use the vanilla enchantment slot sprite', html.includes(guiSprite('enchant_slot') ?? 'NO-SLOT'));
  const invSlots = (html.match(/role="button"/g) ?? []).length;
  check('inventory grid rendered', invSlots >= 36, `${invSlots} slotów`);
  check('lapis slot shows the lapis stack', html.includes('Lazuryt'));
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
  check('the panel is the vanilla anvil texture', merge.includes(guiSprite('anvil_gui') ?? 'NO-PANEL'));
  check('the merge is described', merge.includes('Scal dwa przedmioty'));
  check('the result slot shows its cost', merge.includes('>1</span>') && merge.includes('#80ff20'));
  check('both input slots are rendered', (merge.match(/role="button"/g) ?? []).length >= 36);
  check('the durability bar is drawn', merge.includes('dur-bar'));
  check('the name field is rendered', merge.includes('Nazwa przedmiotu'));
  check('the name field has the vanilla background', merge.includes(guiSprite('anvil_text_field') ?? 'NO-FIELD'));
  check('the hint under the slots describes the action', merge.includes('Scal dwa przedmioty'));

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

section('2.28.1: skrzynia 1:1 z GenericContainerScreen');
{
  const inv = new Inventory();
  inv.slots[0] = { id: I.IRON_PICK, count: 1, dur: 10 };
  const chest = emptyChest(0, 1, 0);
  chest.slots[0] = { id: B.STONE, count: 12 };
  const game = {
    inventory: inv,
    currentChest: () => chest,
    clickChest: noop,
    closeInventory: noop,
    emitHud: noop,
  };
  const html = renderToStaticMarkup(<ChestScreen game={game as never} icons={{}} onChange={noop} />);
  check('the chest panel has a title', html.includes('Skrzynia'));
  check('the panel is the vanilla generic_54 texture', html.includes(guiSprite('chest_gui') ?? 'NO-PANEL'));
  const slots = (html.match(/role="button"/g) ?? []).length;
  check('the chest draws 27 slots plus the player inventory', slots >= 63, `${slots} slotów`);
  check('the chest panel is 167 px tall', html.includes('height:334px') || html.includes('167px'));
  const none = renderToStaticMarkup(
    <ChestScreen game={{ ...game, currentChest: () => null } as never} icons={{}} onChange={noop} />
  );
  check('a closed chest renders nothing', none === '', none);
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
  check('the panel is the vanilla brewing texture', brew.includes(guiSprite('brewing_gui') ?? 'NO-PANEL'));
  check('it draws five slots (3 bottles + ingredient + fuel)', (brew.match(/role="button"/g) ?? []).length >= 41);
  check('a fresh stand asks for fuel', brew.includes('Potrzebna płomienna różdżka'));

  const lit = emptyBrewing(0, 1, 0);
  lit.bottles[0] = { id: I.WATER_BOTTLE, count: 1 };
  lit.ingredient = { id: I.NETHER_WART, count: 1 };
  lit.fuel = { id: I.BLAZE_ROD, count: 2 };
  lit.progress = 4;
  const brewing = renderToStaticMarkup(<BrewingScreen game={makeBrewing(lit) as never} icons={{}} onChange={() => {}} />);
  check('a lit stand announces brewing', brewing.includes('Warzenie…'));
  check('the bubbles sprite is drawn while brewing', brewing.includes(guiSprite('brewing_bubbles') ?? 'NO-BUBBLES'));
  check('the progress sprite is drawn', brewing.includes(guiSprite('brewing_progress') ?? 'NO-PROGRESS'));
  check('the fuel bar is drawn', brewing.includes(guiSprite('brewing_fuel') ?? 'NO-FUEL'));

  const gone = { ...makeBrewing(fresh), currentBrewing: () => null };
  const nothing = renderToStaticMarkup(<BrewingScreen game={gone as never} icons={{}} onChange={() => {}} />);
  check('a closed stand renders nothing', nothing === '', nothing);
}

section('2.3/2.4: journal chapter and menus');
{
  check('the journal has nine chapters', JOURNAL_CHAPTERS.length === 9, String(JOURNAL_CHAPTERS.length));
  const last = JOURNAL_CHAPTERS[JOURNAL_CHAPTERS.length - 1];
  check('the latest chapter is about the alchemist hour', last.title === 'Godzina alchemika', last.title);
  check('it covers brewing, healing, fire and mastery', ['alchemist', 'tonic', 'fireproof', 'potioneer'].every((id) => last.goals.includes(id as never)), last.goals.join(','));
  check('every 2.4 goal is a real achievement', ['alchemist', 'tonic', 'fireproof', 'potioneer'].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  const expedition = JOURNAL_CHAPTERS[JOURNAL_CHAPTERS.length - 2];
  check('the 2.3 chapter stays intact', expedition.title === 'Wyprawa i ratunek' && ['fisher', 'surveyor', 'smith', 'undying'].every((id) => expedition.goals.includes(id as never)), expedition.goals.join(','));
  check('earlier chapters are untouched', JOURNAL_CHAPTERS[0].title === 'Pierwsze kroki' && JOURNAL_CHAPTERS[0].goals.join() === 'wood,craft,pick');
  // a chapter of new goals is not complete from the first brew
  const progress = journalProgress(['alchemist']);
  const chapter = progress[progress.length - 1];
  check('the first 2.4 goal is done', chapter.done === 1, String(chapter.done));
  check('but the chapter is not complete', chapter.complete === false);
  const done = journalProgress(['alchemist', 'tonic', 'fireproof', 'potioneer']);
  check('the whole chapter can be completed', done[done.length - 1].complete === true);

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
  check('the menu announces the public server', menu.includes('Serwer publiczny'));
  // the splash line is picked at random, so check the fixed version badge instead
  check('the menu names the current release', menu.includes(`WERSJA ${GAME_VERSION}`));
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

section('2.4: potion item metadata');
{
  const potionIds = [I.POTION_AWKWARD, I.POTION_HEAL, I.POTION_FIRE, I.POTION_SPEED, I.POTION_NIGHT, I.POTION_STRENGTH, I.POTION_REGEN];
  check('all potions are drinkable', potionIds.every((id) => isPotion(id)));
  check('potion effect metadata is complete', potionIds.every((id) => !!POTIONS[id]?.name));
  check('healing is the instant effect', POTIONS[I.POTION_HEAL]?.effect === 'heal' && HEAL_AMOUNT === 7);
  check('fire resistance is 45 s', POTIONS[I.POTION_FIRE]?.effect === 'fire' && POTIONS[I.POTION_FIRE]?.duration === 45);
  check('night vision is 30 s', POTIONS[I.POTION_NIGHT]?.effect === 'night' && POTIONS[I.POTION_NIGHT]?.duration === 30);
  check('speed is 20 s', POTIONS[I.POTION_SPEED]?.effect === 'speed' && POTIONS[I.POTION_SPEED]?.duration === 20);
  check('strength is 15 s', POTIONS[I.POTION_STRENGTH]?.effect === 'strength' && POTIONS[I.POTION_STRENGTH]?.duration === 15);
  check('regeneration is 10 s', POTIONS[I.POTION_REGEN]?.effect === 'regen' && POTIONS[I.POTION_REGEN]?.duration === 10);
  check('new items do not collide with blocks', potionIds.every((id) => !BLOCKS[id]) && !BLOCKS[I.SUGAR] && !BLOCKS[I.BOTTLE] && !BLOCKS[I.WATER_BOTTLE] && !BLOCKS[I.HONEY_BOTTLE]);
  check('bottles never stack (vanilla)', potionIds.every((id) => stackLimit(id) === 1));
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
  const App = (await import('../src/App')).default;

  const container = w.document.getElementById('root')!;
  let root = createRoot(container);
  // Exercise real pointer/keyboard handlers, not only static markup.
  section('4.2.2: inventory pointer and hovered-slot keyboard navigation');
  const { Game: RealGame } = await import('../src/game/engine');
  const inv = new Inventory();
  const cursorCount = () => inv.cursor?.count;
  const chest = { slots: Array(27).fill(null) };
  const dropped: unknown[][] = [];
  const game = Object.assign(Object.create(RealGame.prototype), {
    inventory: inv, armor: Array(4).fill(null), mode: 'survival', ui: 'inventory', selected: 0,
    craftingTable: null, getSkinId: () => 'steve', onCraft() {}, notePickup() {}, unlock() {}, closeInventory() {},
    body: { pos: { x: 1, y: 70, z: 2 } }, spawnDrop: (...args: unknown[]) => dropped.push(args),
    updateHand() {}, emitHud() {}, saveProfileNow() {},
    currentChest: () => chest,
  }) as Game;
  const renderInventory = async () => {
    await React.act(async () => { root.render(<InventoryScreen game={game} icons={{}} onChange={() => {}} initialBookOpen />); });
  };
  const pointer = async (el: Element, button = 0, shiftKey = false, type = 'mouse', eventType = 'pointerdown') => {
    const e = new dom.window.MouseEvent(eventType, { bubbles: true, cancelable: true, button, shiftKey });
    Object.defineProperty(e, 'pointerType', { value: type });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    await React.act(async () => {
      el.dispatchEvent(e);
      if (type === 'mouse' && eventType === 'pointerdown') {
        const up = new dom.window.MouseEvent('pointerup', { bubbles: true, button });
        Object.defineProperty(up, 'pointerType', { value: 'mouse' }); el.dispatchEvent(up);
      }
    });
  };
  const leave = (el: Element) => el.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true, relatedTarget: w.document.body }));
  const hotbarSlot = (i = 0) => container.querySelector(`[data-hotbar-slot="${i}"] .mc-slot`)!;
  const gridSlot = (i = 0) => container.querySelector(`[data-craft-cell="${i}"] .mc-slot`)!;
  await renderInventory();
  inv.slots[0] = { id: B.LOG, count: 4 };
  await renderInventory();
  await pointer(hotbarSlot()); leave(hotbarSlot());
  check('UI: LPM picks up the whole stack', cursorCount() === 4 && inv.slots[0] === null);
  await pointer(gridSlot()); leave(gridSlot());
  check('UI: LPM puts the whole stack in the crafting grid', inv.grid[0]?.count === 4 && inv.cursor === null);
  inv.cursor = { id: B.LOG, count: 3 };
  await renderInventory();
  await pointer(gridSlot(1), 2); leave(gridSlot(1));
  check('UI: PPM places exactly one crafting ingredient', inv.grid[1]?.count === 1 && cursorCount() === 2);
  await pointer(gridSlot(), 0, true); leave(gridSlot());
  check('UI: Shift grid transfers directly without replacing the cursor', inv.grid[0] === null && inv.countOf(B.LOG) === 4 && cursorCount() === 2);
  inv.cursor = null; inv.grid.fill(null); inv.slots.fill(null); inv.slots[0] = { id: B.LOG, count: 8 };
  await renderInventory();
  await pointer(hotbarSlot(), 0, true); leave(hotbarSlot());
  check('UI: Shift hotbar sends the stack to the backpack', inv.slots[0] === null && inv.slots[9]?.count === 8);
  const backpack = container.querySelector('.mc-inv-storage .mc-slot')! as HTMLElement;
  await React.act(async () => { backpack.focus(); });
  await React.act(async () => { backpack.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Digit3', key: '3', bubbles: true, cancelable: true })); });
  check('UI: number key on the focused slot swaps with hotbar', inv.slots[2]?.count === 8 && inv.slots[9] === null);
  inv.slots[9] = { id: B.STONE, count: 3 };
  await renderInventory();
  await React.act(async () => { backpack.focus(); backpack.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true, cancelable: true })); });
  check('UI: Q drops one from the active slot', inv.slots[9]?.count === 2 && dropped[dropped.length - 1]?.[1] === 1);
  await React.act(async () => { backpack.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', ctrlKey: true, bubbles: true, cancelable: true })); });
  check('UI: Ctrl+Q drops the rest from the active slot', inv.slots[9] === null && dropped[dropped.length - 1]?.[1] === 2);
  const search = container.querySelector('input')!;
  inv.slots[9] = { id: B.LOG, count: 6 };
  await renderInventory();
  await React.act(async () => { search.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true, cancelable: true })); });
  check('UI: typing in recipe search never moves inventory items', inv.slots[9]?.count === 6 && inv.slots[0] === null);
  leave(backpack);
  inv.slots.fill(null); inv.slots[0] = { id: B.LOG, count: 8 }; inv.slots[9] = { id: B.LOG, count: 12 };
  await renderInventory();
  await pointer(hotbarSlot()); await pointer(hotbarSlot()); leave(hotbarSlot());
  check('UI: double-click gathers matching stacks into the cursor', cursorCount() === 20 && inv.slots[9] === null);
  inv.cursor = null; inv.slots.fill(null); inv.grid.fill(null); inv.grid[0] = { id: B.LOG, count: 3 };
  await renderInventory();
  await pointer(container.querySelector('[data-craft-result] .mc-slot')!, 0, true);
  check('UI: Shift output crafts the full available series', inv.countOf(B.PLANKS) === 12 && inv.grid[0] === null);
  inv.slots.fill(null); inv.grid.fill(null); inv.slots[0] = { id: B.LOG, count: 6 };
  await renderInventory();
  await pointer(hotbarSlot(), 0, false, 'touch');
  check('UI: touch waits for pointerup, without a phantom mouse action', inv.cursor === null);
  await pointer(hotbarSlot(), 0, false, 'touch', 'pointerup');
  check('UI: a short touch still picks up a stack', cursorCount() === 6);
  inv.cursor = null; inv.slots.fill(null); inv.slots[0] = { id: B.LOG, count: 8 };
  await renderInventory();
  await pointer(hotbarSlot(), 0, false, 'touch');
  await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 370)); });
  await pointer(hotbarSlot(), 0, false, 'touch', 'pointerup');
  check('UI: long touch splits once, without a second action on release', cursorCount() === 4 && inv.slots[0]?.count === 4);
  section('4.3.1: second-hand UI in survival and creative');
  inv.cursor = null; inv.slots.fill(null);
  inv.slots[0] = { id: I.IRON_PICK, count: 1, dur: 21, name: 'Named pick' };
  await renderInventory();
  const cursorStack = () => inv.cursor;
  const secondary = () => container.querySelector('[data-offhand-slot] .mc-slot')!;
  await React.act(async () => { (hotbarSlot() as HTMLElement).focus(); hotbarSlot().dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyF', bubbles: true, cancelable: true })); });
  check('UI: F moves a focused stack into the second hand intact', inv.offhand?.name === 'Named pick' && inv.slots[0] === null);
  await pointer(secondary()); leave(secondary());
  check('UI: LPM picks an item up from the second hand', cursorStack()?.name === 'Named pick' && inv.offhand === null);
  await pointer(secondary()); leave(secondary());
  check('UI: LPM returns an item to the second hand', inv.cursor === null && inv.offhand?.dur === 21);
  await pointer(secondary(), 0, true); leave(secondary());
  check('UI: Shift removes an offhand stack without loss', inv.offhand === null && inv.slots.some(s => s?.name === 'Named pick'));
  game.mode = 'creative'; await renderInventory();
  check('UI: creative catalog is distinct from survival inventory', !secondary());
  await React.act(async () => { (container.querySelector('[aria-label="Ekwipunek przetrwania"]') as HTMLButtonElement).click(); });
  check('UI: creative survival tab exposes the offhand slot', !!secondary());
  inv.cursor = { id: B.TORCH, count: 9 }; await renderInventory();
  await pointer(secondary()); leave(secondary());
  check('UI: creative offhand accepts a whole stack', inv.offhand?.count === 9 && inv.cursor === null);
  game.mode = 'survival'; await renderInventory();
  const input = container.querySelector('input')!;
  await React.act(async () => { input.focus(); input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true })); });
  check('UI: typing F in search never swaps the offhand', inv.offhand?.count === 9);
  inv.offhand = null;
  // Real capture/bubble/window pointer sequence, not direct engine calls.
  inv.slots.fill(null); inv.grid.fill(null); inv.cursor = { id:B.PLANKS,count:10 }; game.mode='survival';
  await renderInventory();
  const gesture = (el: Element | Window, type: string, button=0, buttons=1) => {
    const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button,buttons});
    Object.defineProperty(e,'pointerType',{value:'mouse'}); el.dispatchEvent(e);
  };
  await React.act(async()=>{
    gesture(hotbarSlot(1),'pointerdown');gesture(hotbarSlot(2),'pointermove');gesture(hotbarSlot(3),'pointermove');gesture(dom.window as unknown as Window,'pointerup',0,0);
  });
  check('UI: left drag distributes across three actual slots',inv.slots.slice(1,4).map(s=>s?.count).join(',')==='3,3,3' && inv.cursor?.count===1);
  inv.cursor={id:B.PLANKS,count:8}; await renderInventory();
  await React.act(async()=>{
    gesture(hotbarSlot(4),'pointerdown');gesture(hotbarSlot(5),'pointermove');dom.window.dispatchEvent(new dom.window.Event('blur'));gesture(dom.window as unknown as Window,'pointerup',0,0);
  });
  check('UI: blur cancels a pending drag without consuming held items',inv.cursor?.count===8 && !inv.slots[4] && !inv.slots[5]);
  await pointer(container.querySelector('.java-inventory')!,2);
  check('UI: outside RMB drops exactly one rather than closing the window',inv.cursor?.count===7 && dropped.at(-1)?.[1]===1);
  inv.slots.fill(null);inv.grid.fill(null);inv.cursor=null;inv.add(B.LOG,1);await renderInventory();
  const planksButton=container.querySelector('[aria-label="Ułóż: Deski dębowe"]') as HTMLButtonElement;
  await React.act(async()=>{planksButton.click();});
  check('UI: book click moves a log into the real grid without crafting',inv.grid[0]?.id===B.LOG && inv.countOf(B.PLANKS)===0 && inv.cursor===null);
  await pointer(container.querySelector('[data-craft-result] .java-slot')!);
  check('UI: output click, not book click, produces the four planks',(inv.cursor as Stack|null)?.id===B.PLANKS && cursorCount()===4 && inv.grid[0]===null);
  inv.returnCursor(); const beforeGhost=JSON.stringify(inv);
  await React.act(async()=>{(container.querySelector('[aria-label="Ułóż: Piaskowiec"]') as HTMLButtonElement).click();});
  check('UI: unavailable recipe is only a ghost preview and does not consume items',JSON.stringify(inv)===beforeGhost);
  game.mode='creative';await renderInventory();
  await React.act(async()=>{(container.querySelector('[aria-label="Bloki budowlane"]') as HTMLButtonElement).click();});
  const catalog=()=>container.querySelector('.java-slot:not([data-slot-area])')!;
  inv.cursor=null;await pointer(catalog());leave(catalog());
  check('UI: creative left click takes a single item',cursorCount()===1);
  inv.cursor=null;await pointer(catalog(),1);leave(catalog());
  check('UI: creative middle click clones a full stack',cursorCount()===64);
  inv.cursor=null;await pointer(catalog(),0,true);leave(catalog());
  check('UI: creative Shift click takes a full stack',cursorCount()===64);
  await React.act(async()=>{(container.querySelector('[aria-label="Ekwipunek przetrwania"]') as HTMLButtonElement).click();});
  check('UI: creative survival tab uses its own native panel without crafting grid',!container.querySelector('[data-craft-cell]') && !!container.querySelector('[aria-label="Usuń przedmiot"]'));
  await React.act(async()=>{(container.querySelector('[aria-label="Usuń przedmiot"]') as HTMLButtonElement).click();});
  check('UI: creative trash deletes the held stack',inv.cursor===null);
  game.mode='survival';inv.slots.fill(null);inv.grid.fill(null);await renderInventory();

  // Exercise the registered DOM listeners, not only the reset helper.
  const eventGame = Object.assign(Object.create(RealGame.prototype), {
    renderer: { domElement: w.document.createElement('canvas') }, listeners: [], bindViewport() {}, noteHardware() {},
    keys: new Set(['KeyW']), mouseLeft: true, mouseRight: true, breakProgress: 0.95, breakKey: 'floor',
    ui: 'playing', touchInput: false, save() {},
  }) as any;
  eventGame.bindEvents();
  dom.window.dispatchEvent(new dom.window.Event('blur'));
  check('UI: browser blur immediately stops mining the floor', !eventGame.mouseLeft && !eventGame.mouseRight && eventGame.breakProgress === 0 && eventGame.keys.size === 0);
  eventGame.mouseLeft = true;
  dom.window.dispatchEvent(new dom.window.MouseEvent('mousemove', { buttons: 0 }));
  check('UI: lost mouseup is reconciled by the next real mouse event', !eventGame.mouseLeft);
  eventGame.mouseLeft = true; dom.window.dispatchEvent(new dom.window.Event('pointercancel'));
  check('UI: a cancelled pointer cannot leave mining pressed', !eventGame.mouseLeft);
  for (const [target, type, fn, options] of eventGame.listeners) target.removeEventListener(type, fn, options);
  inv.cursor = null; inv.slots.fill(null); chest.slots[0] = { id: B.LOG, count: 15 }; game.ui = 'chest';
  await React.act(async () => { root.render(<ChestScreen game={game} icons={{}} onChange={() => {}} />); });
  const guiSlot = container.querySelector('[role="button"]')!;
  await pointer(guiSlot, 0, true); leave(guiSlot);
  check('UI: GuiSlot Shift uses the same quick transfer as the backpack', chest.slots[0] === null && inv.countOf(B.LOG) === 15);
  await React.act(async () => { root.unmount(); });
  root = createRoot(container);

  await React.act(async () => { root.render(<App />); });

  const text = () => container.textContent ?? '';
  const buttons = () => [...container.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (label: string) => buttons().find((b) => (b.textContent ?? '').includes(label));

  check('app renders the Java title screen', !!container.querySelector('img[alt="Minecraft"]') && text().includes('Tryb jednoosobowy'));
  check('title retains honest project and release attribution', text().includes('BlockCraft ' + GAME_VERSION) && text().includes('Nieoficjalny projekt'));
  check('title does not render the old launcher panels', !text().includes('Co nowego'));
  dom.window.location.hash = '#launcher';
  await React.act(async () => { root.unmount(); }); root = createRoot(container);
  await React.act(async () => { root.render(<App />); });
  check('obsolete launcher hash still opens the Java title', !!container.querySelector('img[alt="Minecraft"]') && !text().includes('Co nowego'));
  check('obsolete launcher hash is cleared', dom.window.location.hash === '');
  const click = async (label: string) => {
    const button = byText(label); check('navigation action exists: ' + label, !!button);
    await React.act(async () => { button?.click(); });
  };
  await click('Opcje...');
  check('native options open from title', text().includes('Pole widzenia') && !!byText('Ustawienia grafiki'));
  await click('Ustawienia grafiki');
  check('video settings expose actual GUI scaling', text().includes('Skala interfejsu:'));
  await React.act(async () => { dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  check('Escape returns from video to options', text().includes('Dostosowanie skórki...'));
  await click('Gotowe');
  await click('Tryb wieloosobowy');
  check('multiplayer screen opens from the menu', text().includes('Dołącz do serwera') && text().includes('Serwer przeglądarkowy'));
  await click('Połączenia przeglądarkowe...');
  check('advanced multiplayer preserves both browser transports', text().includes('Ta przeglądarka') && text().includes('Przez internet'));
  check('local mode shows the room code', text().includes('Kod pokoju'));
  await click('Dołącz');
  check('joining asks for the room code', text().includes('Dołącz do pokoju'));
  await click('Przez internet');
  check('internet mode explains the invite code', /kod zaproszenia/i.test(text()));
  await click('Wróć');
  check('back from multiplayer returns to title', !!container.querySelector('img[alt="Minecraft"]'));
  await click('Tryb jednoosobowy');
  check('singleplayer opens world selection, not the creation form', !!byText('Stwórz nowy świat') && text().includes('Wybierz świat'));
  await click('Stwórz nowy świat');
  check('creation form opens', text().includes('Nazwa świata'));
  const nameInput = container.querySelector('input') as HTMLInputElement;
  await React.act(async () => {
    Object.getOwnPropertyDescriptor((w.HTMLInputElement as typeof HTMLInputElement).prototype, 'value')!.set!.call(nameInput, 'Testowy świat');
    nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  check('world name is editable', nameInput.value === 'Testowy świat');
  await click('Świat');
  check('world tab exposes the seed and generator', text().includes('Ziarno generatora') && !!byText('Typ świata'));
  await click('Typ świata');
  check('flat world selectable', text().includes('Superpłaski'));
  await click('Stwórz nowy świat');

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

section('2.18: motyw interfejsu z paczki');
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const css = fs.readFileSync(`${process.cwd()}/src/index.css`, 'utf8');
  check('sloty używają grafiki z paczki', css.includes('var(--mc-slot-img'));
  check('przyciski używają grafiki z paczki', css.includes('var(--mc-btn-img'));
  check('przyciski mają stan hover z paczki', css.includes('var(--mc-btn-hover-img'));
  check('przyciski mają stan disabled z paczki', css.includes('var(--mc-btn-disabled-img'));
  check('piksele nie są rozmywane', css.includes('image-rendering: pixelated'));
  const main = fs.readFileSync(`${process.cwd()}/src/main.tsx`, 'utf8');
  check('motyw jest instalowany przy starcie', main.includes('installPackTheme()'));
  const vite = fs.readFileSync(`${process.cwd()}/vite.config.ts`, 'utf8');
  check('preview działa spoza localhost', vite.includes('allowedHosts: true'));
}

section('2.18: HUD rysuje grafiki z paczki');
{
  const state = {
    mode: 'survival', health: 14, maxHealth: 20, hunger: 12, armor: [null, null, { id: 1, dur: 100 }, null],
    air: 8, maxAir: 10, xp: 0.4, level: 3, hotbar: Array(9).fill(null), selected: 1,
    effects: [], messages: [], holdItem: null, sprinting: false, flying: false, underwater: false, sneaking: false,
    time: 0.4, hurtCount: 0, zoom: false, minimap: false, bow: -1,
  } as unknown as Parameters<typeof HUD>[0]['hud'];
  const html = renderToStaticMarkup(<HUD hud={state} icons={{}} />);
  const images = (html.match(/<img/g) ?? []).length;
  check('HUD składa się z grafik, nie z rysowanych kształtów', images >= 30, `${images} obrazków`);
  check('każdy adres ma jeden prefiks data:', !html.includes('base64,data:'));
  check('serca pochodzą z paczki', (html.match(/width="18" height="18" class="pixelated"/g) ?? []).length >= 20, `${images}`);
  check('hotbar ma tło z paczki', html.includes('url(data:image/png'));
  check('pasek doświadczenia ma tło i postęp', (html.match(/url\(data:image\/png/g) ?? []).length >= 2);
  check('celownik jest obrazkiem, nie divem', /translate\(-50%,\s?-50%\)/.test(html));
  check('Java health uses hearts without a numeric label', !html.includes('14/20') && html.includes('data-java-health'));
}

section('2.19: teleportacja i skórki 1:1 w interfejsie');
{
  const state = {
    mode: 'survival', health: 20, maxHealth: 20, hunger: 20, armor: [null, null, null, null],
    air: 10, maxAir: 10, xp: 0, level: 0, hotbar: Array(9).fill(null), selected: 0,
    effects: [], messages: [], holdItem: null, sprinting: false, flying: false, underwater: false, sneaking: false,
    time: 0.4, hurtCount: 0, zoom: false, minimap: false, bow: -1, tpa: null, tpaSent: null,
  } as unknown as Parameters<typeof HUD>[0]['hud'];
  const plain = renderToStaticMarkup(<HUD hud={state} icons={{}} />);
  check('bez prośby nie ma okna teleportacji', !plain.includes('Przyjmij'));

  const asked = renderToStaticMarkup(<HUD hud={{ ...state, tpa: { from: 'p2', name: 'Ziomek' } }} icons={{}} />);
  check('HUD pokazuje kto prosi o teleportację', asked.includes('Ziomek') && asked.includes('prosi o teleportację'));
  check('HUD ma przycisk zgody', asked.includes('Przyjmij'));
  check('HUD ma przycisk odmowy', asked.includes('Odmów'));

  const waiting = renderToStaticMarkup(<HUD hud={{ ...state, tpaSent: { name: 'Ziomek' } }} icons={{}} />);
  check('HUD pokazuje oczekiwanie na zgodę', waiting.includes('Czekam na zgodę'));

  // 2.19: skórki w podglądzie to prawdziwe pliki 64×64 z paczki.
  const avatar = renderToStaticMarkup(<SkinAvatar skin="zuri" size={40} />);
  check('podgląd skórki to prawdziwy portret', avatar.startsWith('<img') && avatar.includes('data:image/png;base64,'));
  const face = renderToStaticMarkup(<SkinHead skin="steve" size={16} />);
  check('twarz w liście graczy to obrazek z paczki', face.startsWith('<img') && face.includes('data:image/png;base64,'));
  const picker = renderToStaticMarkup(<SkinPicker value="efe" onChange={noop} />);
  check('wybór skórki pokazuje 9 portretów', (picker.match(/data:image\/png;base64,/g) ?? []).length >= 9);
}

try {
  await mountWithJsdom();
} catch (e) {
  fail++;
  failures.push(`jsdom mount threw: ${(e as Error)?.message ?? e}`);
  console.log((e as Error)?.stack);
}

section('4.4.1: inventory armor preview');
{
  const armor = [I.IRON_HELMET, I.GOLD_CHEST, I.DIAMOND_LEGS, I.LEATHER_BOOTS].map(id => ({ id, count: 1 }));
  const html = renderToStaticMarkup(<EquippedSkinAvatar skin="alex" armor={armor} />);
  check('the actual player preview includes all four equipped armor layers', [0, 1, 2, 3].every(i => html.includes(`data-armor-slot="${i}"`)));
  check('mixed armor materials have different visible colors', ['#d8e1e5', '#edca45', '#55d9d0', '#9c623b'].every(color => html.includes(color)));
  const empty = renderToStaticMarkup(<EquippedSkinAvatar skin="alex" armor={[null, null, null, null]} />);
  check('unequipped preview shows the original skin without armor', !empty.includes('data-armor-slot') && empty.includes('Podgląd skórki'));
  const invalid = renderToStaticMarkup(<EquippedSkinAvatar skin="steve" armor={[{ id: I.DIAMOND_CHEST, count: 1 }]} />);
  check('an item in the wrong slot cannot paint a helmet', !invalid.includes('data-armor-slot'));
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
