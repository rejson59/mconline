import { useRef, useState } from 'react';
import type { GameMode } from '../game/engine';
import { ACHIEVEMENTS } from '../game/achievements';
import { exportSave, exportSaves, importSaves, MAX_SAVES } from '../game/saves';
import { loadSettings, saveSettings, type Settings } from '../utils/settings';
import { GAME_RELEASE_NAME, GAME_VERSION, MINECRAFT_TARGET, RELEASE_HIGHLIGHTS } from '../utils/version';
import SettingsScreen from './SettingsScreen';
import { SkinHead } from './SkinPicker';
import { toggleFullscreenLandscape } from '../utils/screen';

export type WorldType = 'normal' | 'flat';

// BASE_URL is "./" for this build, so the background resolves relative to
// index.html and works on GitHub Pages project sites, custom domains and file://
const MENU_BG = `${import.meta.env?.BASE_URL ?? './'}menu-bg.jpg`;

export type { Settings } from '../utils/settings';

const SPLASHES = [
  '2.27: mieszkańcy przestali drżeć!',
  '2.27: handel wygląda jak w Minecrafcie!',
  '2.27: klikasz ofertę, bierzesz towar!',
  '2.27: przewijana lista ofert!',
  '2.22: owca pasie się i odrasta!',
  '2.22: 16 kolorów wełny jak w grze!',
  '2.22: moby mają prawdziwe hitboxy!',
  '2.22: pająk, szkielet i kura po poprawkach!',
  '2.21: skrzynia z prawdziwą teksturą!',
  '2.20: słońce bez czarnego kwadratu!',
  '2.20: drzwi i latarnie jak w grze!',
  '2.20: dwuspadowe dachy wiosek!',
  '2.20: kaktusy i łóżka z własną bryłą!',
  '2.20: golem trzyma ręce opuszczone!',
  '2.20: blok w ręce już nie zasłania ekranu!',
  '2.19: Twoja sesja pamięta, gdzie skończyłeś!',
  '2.19: /tpa – teleportacja za zgodą!',
  '2.19: kontynenty, rzeki i prawdziwe biomy!',
  '2.19: wioski bez dziur i platform!',
  '2.19: 9 skórek 1:1 jak w Minecrafcie!',
  '2.19: każdy startuje w innym miejscu!',
  '2.18: moby 1:1 jak w Minecrafcie!',
  '2.18: serca i hotbar z paczki tekstur!',
  '2.18: krowa, świnia i creeper jak w grze!',
  '2.17: bloki i przedmioty z paczki tekstur!',
  '2.17: Steve i Alex w prawdziwych skórkach!',
  '2.17: grafika jak w oryginalnym Minecrafcie!',
  '2.16: moby i gracze mają pikselowe tekstury!',
  '2.16: 155 przepisów – schody, płyty, latarnie!',
  '2.16: krowa w łaty, owca w runo, creeper w mech!',
  '2.15: pełny ekran naprawiony – wszystko w kadrze!',
  '2.15: kamera nie przybliża się po fullscreenie!',
  '2.14: auto-bicie – postać sama walczy!',
  '2.14: auto-skok – ani jednego zablokowania!',
  '2.14: auto-bicie włączysz w pauzie!',
  '2.13: ekwipunek jak w Minecrafcie!',
  '2.13: telefon gra się w poziomie!',
  '2.13: 4 deski w kwadracie = stół!',
  '2.12: nowe skórki – wybierz swoją postać!',
  '2.12: pień → deski → stół rzemieślniczy!',
  '2.12: przyciski dotykowe w Twoim rozmiarze!',
  '2.11: serwer publiczny – jeden świat dla wszystkich!',
  'Buduj razem z całą Polską!',
  'Twoja budowla zostaje w chmurze!',
  '2.10: graj razem – bez serwera!',
  'Otwórz pokój, podaj kod, budujcie razem!',
  'Druga karta? Ten sam świat!',
  '2.9: tekstury jak w nowym Minecrafcie!',
  'Ekwipunek zamyka się na dotyku!',
  'Wpisz „/”, aby zobaczyć komendy!',
  'BlockCraft 2.8: płynniej, szybciej, piękniej!',
  '2.8: woda faluje, niebo ma gradient!',
  'Mniej zacięć – więcej budowania!',
  'Nowe menu, ten sam świat!',
  'Chunki ładują się w tle – nie przerywaj kopania!',
  'Odkryj Bagna, Sawannę i Dżunglę!',
  '2.8: świat ładuje się w tle – buduj bez czekania!',
  'Dżungla kryje gęste zarośla, Sawanna – akacje!',
  'Ekwipunek nie gubi ani nie duplikuje przedmiotów!',
  'Szukaj receptur po nazwie albo składniku!',
  'Nazwane przedmioty zachowują swoje imię!',
  '2.6: pełny plecak nie zabierze już łupu!',
  'Trzymany LPM bije dalej – koniec klikania!',
  'Tapnij mieszkańca, aby handlować (nie bić!)',
  'Ctrl+Q wyrzuca cały stos!',
  'Esc w pauzie wraca do gry!',
  'Teraz też na telefonach!',
  'Statyw alchemiczny warzy napoje!',
  'Ognioodporność: wejdź do lawy bez obrażeń!',
  'Złów rybę i napraw narzędzia!',
  'Totem Ratowania uratuje cię od śmierci!',
  'Przypinaj, kopiuj i nazywaj swoje światy!',
  'Dziennik przygód pokaże ci kolejny cel!',
  'Automatyczna grafika dopasuje się do twojego sprzętu!',
  'Tapnij, aby postawić blok!',
  'Niskie ustawienia? I tak pójdzie gładko!',
  'Prawdziwy Nether czeka za portalem!',
  'Zaklnij kilof w stole zaklęć!',
  'Zatamej wilka mięsem!',
  'Wioski, handel i golemy!',
  'Uważaj na creepery!',
  'Nie kop prosto w dół!',
  'Pochodnie świecą w jaskiniach!',
  'Wyhoduj własne drzewo!',
  'Diamentowy pancerz to moc!',
  'Zbieraj doświadczenie!',
  'Polska wersja!',
];

export function Title() {
  const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  return (
    <div className="flex w-full flex-col items-center text-center">
      <h1
        className="max-w-full whitespace-nowrap text-[clamp(2.2rem,11vw,3.9rem)] font-bold leading-none tracking-[0.05em]"
        style={{
          color: '#d7dbe2',
          textShadow:
            '0 2px 0 #9aa0ab, 0 4px 0 #6f757f, 0 6px 0 #4a4f57, 0 8px 0 #262a30, 0 12px 22px rgba(0,0,0,0.85)',
          WebkitTextStroke: '2px #14161a',
        }}
      >
        BLOCKCRAFT
      </h1>
      <div className="mt-2.5 flex w-full flex-wrap items-center justify-center gap-2 px-1">
        <span className="mc-badge">WERSJA {GAME_VERSION}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 sm:text-[11px]">
          {GAME_RELEASE_NAME}
        </span>
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
        Minecraft {MINECRAFT_TARGET}
      </div>
      <div
        className="splash mt-2 max-w-full text-center text-[13px] font-semibold leading-tight sm:text-lg"
        style={{ color: '#ffff70', textShadow: '2px 2px 0 #3f3f00' }}
      >
        {splash}
      </div>
    </div>
  );
}

export function Controls() {
  const rows: [string, string][] = [
    ['W A S D', 'Ruch'],
    ['Mysz', 'Rozglądanie się (surowe wejście – bez przyspieszeń systemu)'],
    ['Spacja', 'Skok / pływanie w górę'],
    ['Spacja x2', 'Latanie (tryb kreatywny)'],
    ['Shift', 'Skradanie / lot w dół (lewy lub prawy)'],
    ['W x2 lub R', 'Sprint bez skrótów przeglądarki'],
    ['LPM (przytrzymaj)', 'Kopanie · atak mobów i graczy (PvP) z cooldownem'],
    ['PPM', 'Stawianie bloku / użycie stołu'],
    ['ŚPM', 'Wybierz blok'],
    ['1-9 (także numeryczne) / kółko', 'Wybór slotu'],
    ['E', 'Ekwipunek / wytwarzanie'],
    ['Q', 'Wyrzuć przedmiot dla innych · Ctrl+Q: cały stos'],
    ['T lub /', 'Czat i komendy'],
    ['PPM na jedzeniu', 'Jedzenie'],
    ['PPM na piecu', 'Przetapianie'],
    ['PPM na łóżku', 'Sen i punkt odrodzenia'],
    ['PPM na drzwiach / włazie', 'Otwórz lub zamknij (Shift+PPM stawia blok)'],
    ['PPM na skrzyni', 'Schowek'],
    ['Drabina + W / spacja', 'Wspinaczka'],
    ['Nożyce + LPM na owcy', 'Wełna bez zabijania'],
    ['Krzesiwo + PPM', 'Podpal TNT'],
    ['Łuk: przytrzymaj PPM, puść', 'Wystrzał ze strzałą'],
    ['Wędka: PPM', 'Zarzuć przynętę i zaciągnij brań'],
    ['Lorneta: przytrzymaj PPM', 'Przybliżenie'],
    ['PPM na kowadle', 'Scal dwa narzędzia i nadaj nazwę'],
    ['PPM na statywie alchemicznym', 'Warzy napoje'],
    ['PPM na fiolce przy wodzie', 'Napełnij fiolkę'],
    ['Kompas / zegar', 'Kierunek odrodzenia i pora dnia'],
    ['Motyka + PPM', 'Grządka'],
    ['PPM na wilku z surowym mięsem', 'Zatamej wilka (strzeże gracza)'],
    ['PPM na stole zaklęć', 'Zaklnij narzędzie, broń lub pancerz'],
    ['Stół zaklęć + biblioteczki', 'Wyższe poziomy zaklęć (do 30)'],
    ['Tarcza w ręku', 'Przyłap strzały i osłabia ciosy'],
    ['Sloty pancerza (w E)', 'Załóż pancerz (4 elementy)'],
    ['F', 'Zamień przedmiot z drugą ręką (także nad slotem w E)'],
    ['M', 'Minimapa'],
    ['J', 'Dziennik przygód i postęp celów'],
    ['K', 'Punkty podróży: baza, kopalnia i znacznik śmierci'],
    ['F3', 'Informacje debugowania'],
    ['Esc', 'Pauza · Esc w pauzie wraca do gry'],
    ['Enter / R (ekran śmierci)', 'Odrodzenie'],
  ];
  const touchRows: [string, string][] = [
    ['Drążek (lewy dół)', 'Ruch · pchnij do oporu = sprint'],
    ['Przeciągnij ekran', 'Rozglądanie się'],
    ['Tapnij w blok', 'Postaw / użyj / zjedz (tryb Tapnij)'],
    ['Przytrzymaj blok', 'Kopanie – celownik podąża za palcem'],
    ['Tapnij w moba', 'Atak (mieszkaniec: handel!)'],
    ['⬆', 'Skok · 2× w kreatywnym = latanie'],
    ['⇣', 'Skradanie / lot w dół'],
    ['✈ (kreatywny)', 'Włącz / wyłącz latanie'],
    ['Pasek na dole', 'Tapnij slot, aby go wybrać'],
    ['Sloty w oknach (E)', 'Tapnij: weź / połóż · przytrzymaj: połowa / jeden'],
    ['💬', 'Czat i komendy'],
    ['📍', 'Punkty podróży i znacznik bazy'],
  ];
  return (
    <div className="flex flex-col gap-4 text-[15px]">
      <div>
        <div className="mb-1 text-base text-green-300 mc-text">Komputer (mysz + klawiatura)</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <div className="text-yellow-300 mc-text">{k}</div>
              <div className="text-gray-200 mc-text">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-base text-green-300 mc-text">Telefon i tablet</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {touchRows.map(([k, v]) => (
            <div key={k} className="contents">
              <div className="text-yellow-300 mc-text">{k}</div>
              <div className="text-gray-200 mc-text">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs opacity-70">
        Wersję sterowania (Automat / Komputer / Dotyk) zmienisz w Opcjach → Sterowanie – przydatne na laptopach z ekranem dotykowym.
      </div>
    </div>
  );
}

/**
 * 2.13: pełny ekran na telefonie od razu próbuje zablokować poziom.
 * Przeglądarki, które tego nie umieją, po prostu zostają w oknie.
 */
export function toggleFullscreen() {
  void toggleFullscreenLandscape();
}

/** Builds a shareable link that recreates this world (seed + mode in the hash). */
export function worldShareUrl(seed: number, mode: GameMode): string {
  const loc = window.location;
  // file:// pages report origin "null" – keep only the path so the link still
  // resolves when the game is opened straight from the file system.
  const origin = loc.origin && loc.origin !== 'null' ? loc.origin : '';
  const base = `${origin}${loc.pathname}${loc.search}`;
  return `${base}#seed=${seed}&mode=${mode}`;
}

export interface SaveSummary {
  mode: GameMode;
  day: number;
  seed: number;
}

export interface WorldCard {
  id: string;
  name?: string;
  seed: number;
  mode?: string;
  day?: number;
  updated?: number;
  worldType?: WorldType;
  favorite?: boolean;
}

export type WorldSort = 'recent' | 'name' | 'day';

/** Search across the most useful world details, ignoring Polish diacritics. */
export function filterAndSortWorlds(worlds: WorldCard[], query: string, sort: WorldSort): WorldCard[] {
  const normalize = (value: string) => value.replace(/[łŁ]/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl');
  const needle = normalize(query.trim());
  const filtered = worlds.filter((world) => {
    if (!needle) return true;
    const haystack = [world.name ?? 'Swiat', String(world.seed), world.mode === 'creative' ? 'kreatywny' : 'przetrwanie', world.worldType === 'flat' ? 'plaski' : 'normalny']
      .map(normalize)
      .join(' ');
    return haystack.includes(needle);
  });

  return filtered.sort((a, b) => {
    // Favorites stay visible at the top regardless of the selected secondary sort.
    const pinned = Number(!!b.favorite) - Number(!!a.favorite);
    if (pinned) return pinned;
    if (sort === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'pl', { sensitivity: 'base' });
    if (sort === 'day') return (b.day ?? 1) - (a.day ?? 1) || (b.updated ?? 0) - (a.updated ?? 0);
    return (b.updated ?? 0) - (a.updated ?? 0);
  });
}

export function MainMenu({
  saves,
  sharedSeed,
  sharedMode,
  onPlay,
  onNew,
  onDelete,
  onRename,
  onDuplicate,
  onToggleFavorite,
  onImported,
  onMultiplayer,
  onAccount,
}: {
  saves: WorldCard[];
  /** 2.10: otwiera poczekalnię multiplayer. */
  onMultiplayer?: () => void;
  /** Opcjonalne wspólne konto; nie jest wymagane do gry. */
  onAccount?: () => void;
  /** called after a save file was imported so the list can refresh */
  onImported?: () => void;
  /** seed / mode taken from the URL hash (shareable world links) */
  sharedSeed?: number | null;
  sharedMode?: GameMode | null;
  onPlay: (id: string) => void;
  onNew: (seed: number, mode: GameMode, name: string, worldType: WorldType) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  const [view, setView] = useState<'main' | 'new' | 'controls' | 'options'>(sharedSeed != null ? 'new' : 'main');
  const [seedText, setSeedText] = useState(sharedSeed != null ? String(sharedSeed) : '');
  const [worldName, setWorldName] = useState('');
  const [mode, setMode] = useState<GameMode>(sharedMode ?? 'survival');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [menuNotice, setMenuNotice] = useState('');
  const [worldQuery, setWorldQuery] = useState('');
  const [worldSort, setWorldSort] = useState<WorldSort>('recent');
  const [worldType, setWorldType] = useState<WorldType>('normal');
  const visibleWorlds = filterAndSortWorlds(saves, worldQuery, worldSort);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = () => {
    let seed: number;
    if (!seedText.trim()) seed = Math.floor(Math.random() * 2147483647);
    else if (/^-?\d+$/.test(seedText.trim())) seed = parseInt(seedText.trim()) | 0;
    else {
      seed = 0;
      for (const ch of seedText) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    }
    onNew(Math.abs(seed), mode, worldName.trim() || 'Nowy świat', worldType);
  };

  const downloadSaves = () => {
    try {
      const blob = new Blob([exportSaves()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'blockcraft-swiety.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      window.alert('Nie udało się pobrać pliku z zapisami.');
    }
  };

  const downloadWorld = (world: WorldCard) => {
    const json = exportSave(world.id);
    if (!json) return;
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const safeName = (world.name || 'swiat').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      a.download = `blockcraft-${safeName || 'swiat'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      setMenuNotice('Nie udało się wyeksportować tego świata.');
    }
  };

  const showNotice = (text: string) => {
    setMenuNotice(text);
    window.setTimeout(() => setMenuNotice(''), 2500);
  };

  const pickSavesFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const n = importSaves(String(reader.result ?? ''));
      window.alert(n > 0 ? `Zaimportowano światów: ${n}` : 'To nie jest plik z zapisami BlockCraft.');
      onImported?.();
    };
    reader.readAsText(file);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* tło świata + winieta + ciepła poświata słońca */}
      <div
        className="absolute inset-0 scale-110"
        style={{
          backgroundImage: `url("${MENU_BG}")`,
          backgroundColor: '#2b2118',
          backgroundSize: 'cover',
          backgroundPosition: 'center 42%',
          filter: 'blur(2.5px) brightness(0.78) saturate(1.05)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/80" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 66% 26%, rgba(255,213,140,0.30), rgba(255,160,60,0.08) 34%, transparent 62%)' }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 menu-terrain" />

      <div className="relative z-10 flex h-full w-full flex-col items-center overflow-y-auto px-[max(12px,env(safe-area-inset-left))] pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-5 sm:py-5">
        <div className="flex w-full max-w-[1040px] flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* ————— lewa kolumna: tytuł i główne akcje ————— */}
          <div className="flex w-full flex-col items-center gap-4 lg:sticky lg:top-2 lg:w-[430px]">
            <Title />
            {view === 'main' ? (
              <div className="flex w-full max-w-[430px] flex-col gap-2.5">
                <button className="mc-btn mc-btn-primary" onClick={() => setView('new')}>
                  {saves.length >= MAX_SAVES ? `Nowy świat · limit ${MAX_SAVES}` : 'Nowy świat'}
                </button>
                {onMultiplayer && (
                  <button className="mc-btn" onClick={onMultiplayer}>
                    Gra razem · multiplayer
                  </button>
                )}
                {onAccount && <button className="mc-btn" type="button" onClick={onAccount}>Konto Rejson</button>}
                <div className="grid grid-cols-2 gap-2.5">
                  <button className="mc-btn !px-2" onClick={() => setView('controls')}>
                    Sterowanie
                  </button>
                  <button className="mc-btn !px-2" onClick={() => setView('options')}>
                    Opcje
                  </button>
                  <button className="mc-btn !px-2 !text-[15px]" onClick={toggleFullscreen}>
                    Pełny ekran
                  </button>
                  <button className="mc-btn !px-2 !text-[15px]" onClick={downloadSaves}>
                    Eksport zapisów
                  </button>
                  <button className="mc-btn col-span-2 !py-2 !text-[15px]" onClick={() => fileRef.current?.click()}>
                    Import zapisów
                  </button>
                </div>
              </div>
            ) : (
              <button className="mc-btn w-full max-w-[430px]" onClick={() => setView('main')}>
                ← Powrót do menu
              </button>
            )}
          </div>

          {/* ————— prawa kolumna: światy, nowy świat, opcje ————— */}
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
            {view === 'main' && saves.length > 0 && (
              <section aria-label="Zapisane światy" className="mc-card p-3 sm:p-4">
                <p className="sr-only">W menu zarządzania możesz zmienić nazwę, utworzyć kopię, wyeksportować świat albo wybrać Usuń.</p>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-base text-yellow-200 mc-text">
                    Twoje światy <span className="text-xs text-white/60">{saves.length}/8</span>
                  </h2>
                  <label className="sr-only" htmlFor="world-sort">Sortuj światy</label>
                  <select
                    id="world-sort"
                    aria-label="Sortuj światy"
                    className="mc-input !w-auto !py-1 !text-sm"
                    value={worldSort}
                    onChange={(e) => setWorldSort(e.target.value as WorldSort)}
                  >
                    <option value="recent">Ostatnio grane</option>
                    <option value="name">Nazwa A–Z</option>
                    <option value="day">Najdłuższa rozgrywka</option>
                  </select>
                </div>
                <label className="sr-only" htmlFor="world-search">Szukaj zapisanych światów</label>
                <input
                  id="world-search"
                  className="mc-input mb-2 !py-1 !text-sm"
                  type="search"
                  value={worldQuery}
                  onChange={(e) => setWorldQuery(e.target.value)}
                  placeholder="Szukaj nazwy, ziarna lub trybu…"
                />
                <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-0.5 lg:max-h-[58vh]">
                  {visibleWorlds.map((s) => (
                    <div key={s.id} className="border border-white/10 bg-black/30 p-2 transition-colors hover:border-white/25">
                      <div className="flex gap-1.5">
                        <button
                          className="mc-btn !w-10 !px-1 !py-2 text-lg"
                          aria-label={s.favorite ? `Odepnij świat ${s.name || 'Świat'}` : `Przypnij świat ${s.name || 'Świat'}`}
                          aria-pressed={!!s.favorite}
                          title={s.favorite ? 'Odepnij świat' : 'Przypnij świat na górze'}
                          onClick={() => onToggleFavorite?.(s.id)}
                        >
                          {s.favorite ? '★' : '☆'}
                        </button>
                        <button className="mc-btn min-w-0 flex-1 !py-2 text-left" onClick={() => onPlay(s.id)}>
                          {s.name || 'Świat'}
                          <span className="block text-xs font-normal opacity-80">
                            dzień {s.day ?? 1} · {s.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'} · {s.worldType === 'flat' ? 'płaski' : 'normalny'} · ziarno {s.seed}
                          </span>
                          {s.updated ? <span className="block text-[11px] font-normal opacity-65">Zapisano: {new Date(s.updated).toLocaleDateString('pl-PL')}</span> : null}
                        </button>
                        <button
                          className="mc-btn !w-10 !px-1 !py-2 text-lg"
                          aria-expanded={manageId === s.id}
                          aria-label={`Zarządzaj światem ${s.name || 'Świat'}`}
                          title="Zarządzaj światem"
                          onClick={() => {
                            const opening = manageId !== s.id;
                            setManageId(opening ? s.id : null);
                            setRenameText(opening ? (s.name || 'Świat') : '');
                            setConfirmId(null);
                          }}
                        >
                          ⋯
                        </button>
                      </div>
                      {manageId === s.id && (
                        <div className="mt-1.5 space-y-1.5 border border-white/15 bg-black/50 p-2">
                          <form
                            className="flex gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              onRename?.(s.id, renameText);
                              setManageId(null);
                              showNotice('Nazwa świata została zmieniona.');
                            }}
                          >
                            <label className="sr-only" htmlFor={`rename-${s.id}`}>Nowa nazwa świata</label>
                            <input
                              id={`rename-${s.id}`}
                              className="mc-input min-w-0 flex-1 !py-1 !text-sm"
                              value={renameText}
                              maxLength={40}
                              onChange={(e) => setRenameText(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                            <button className="mc-btn !w-auto !px-3 !py-1 !text-sm" type="submit">Zapisz nazwę</button>
                          </form>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              className="mc-btn !px-1 !py-1 !text-xs"
                              onClick={() => {
                                if (onDuplicate?.(s.id)) showNotice('Utworzono niezależną kopię świata.');
                                else showNotice(`Brak wolnego miejsca — limit to ${MAX_SAVES} światów.`);
                                setManageId(null);
                              }}
                            >
                              Utwórz kopię
                            </button>
                            <button className="mc-btn !px-1 !py-1 !text-xs" onClick={() => downloadWorld(s)}>
                              Eksportuj
                            </button>
                            <button
                              className="mc-btn !px-1 !py-1 !text-xs"
                              onClick={() => {
                                if (confirmId === s.id) {
                                  onDelete(s.id);
                                  setManageId(null);
                                } else setConfirmId(s.id);
                              }}
                            >
                              {confirmId === s.id ? 'Na pewno?' : 'Usuń'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {visibleWorlds.length === 0 && <div className="py-3 text-center text-sm text-white/75">Brak światów pasujących do wyszukiwania.</div>}
                </div>
                <div className="min-h-4 pt-1 text-center text-xs text-green-200" role="status" aria-live="polite">{menuNotice}</div>
              </section>
            )}

            {view === 'main' && saves.length === 0 && (
              <section aria-label="Witamy" className="mc-card p-4 sm:p-6">
                <div className="mc-card-title">Witaj w BlockCraft</div>
                <p className="text-sm leading-relaxed text-white/85">
                  Zagraj sam albo wejdź na <b className="text-yellow-200">serwer publiczny</b>: jeden świat dla wszystkich,
                  bez kodów i bez gospodarza. Wersja <b className="text-yellow-200">{GAME_VERSION} „{GAME_RELEASE_NAME}”</b>
                  zapisuje budowle w chmurze, więc zostają po wyjściu i po odświeżeniu strony.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-white/75 sm:grid-cols-2">
                  <div className="border border-white/10 bg-black/30 p-2">🌍 Serwer publiczny – jeden świat</div>
                  <div className="border border-white/10 bg-black/30 p-2">☁️ Budowle zapisane w chmurze</div>
                  <div className="border border-white/10 bg-black/30 p-2">🕒 Wspólna pora dnia i pogoda</div>
                  <div className="border border-white/10 bg-black/30 p-2">👥 Awatary i lista graczy online</div>
                  <div className="border border-white/10 bg-black/30 p-2">🎨 Tekstury jak w nowym Minecrafcie</div>
                  <div className="border border-white/10 bg-black/30 p-2">⌨️ Lista komend w czacie</div>
                </div>
                <p className="mt-3 text-[11px] leading-snug text-white/50">
                  Zapisane światy (do 8) trzymamy w tej przeglądarce. Możesz je eksportować i importować jako pliki JSON.
                </p>
              </section>
            )}

            {view === 'new' && (
              <div className="mc-card flex w-full flex-col gap-3 p-4 sm:p-5">
                <div className="text-lg mc-text">{sharedSeed != null ? 'Świat z linku' : 'Utwórz nowy świat'}</div>
                {sharedSeed != null && (
                  <div className="text-xs text-green-300">Ziarno i tryb zostały wczytane z adresu – kliknij „Stwórz świat”, aby zagrać.</div>
                )}
                <label className="text-sm text-gray-300">Nazwa świata</label>
                <input className="mc-input" value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="np. Wyspa" onKeyDown={(e) => e.stopPropagation()} />
                <label className="text-sm text-gray-300">Ziarno generatora (puste = losowe)</label>
                <input className="mc-input" value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="np. 12345 lub dowolny tekst" />
                <div className="grid grid-cols-2 gap-2">
                  <button className="mc-btn !py-2 !text-[15px]" onClick={() => setMode(mode === 'survival' ? 'creative' : 'survival')}>
                    Tryb: {mode === 'survival' ? 'Przetrwanie' : 'Kreatywny'}
                  </button>
                  <button
                    className={`mc-btn !py-2 !text-[15px] ${worldType === 'flat' ? 'mc-btn-primary' : ''}`}
                    aria-pressed={worldType === 'flat'}
                    onClick={() => setWorldType(worldType === 'normal' ? 'flat' : 'normal')}
                  >
                    Typ świata: {worldType === 'normal' ? 'Normalny' : 'Płaski'}
                  </button>
                </div>
                <div className="text-xs leading-snug text-gray-300">
                  {worldType === 'flat'
                    ? 'Świat płaski: równa trawna równina na wysokości 64 – idealny do budowania i kopania rud.'
                    : mode === 'survival'
                      ? 'Zetnij drzewo, wytwórz kilof, postaw drzwi i skrzynię. W jaskiniach leżą skrzynie.'
                      : 'Nieograniczone bloki, latanie, natychmiastowe niszczenie, brak obrażeń.'}
                </div>
                <div className="text-xs text-gray-400">Grafika dobierze się automatycznie do twojego urządzenia (zmienisz w opcjach).</div>
                <div className="text-xs text-gray-400">Nowy świat nie kasuje pozostałych zapisów. Maksymalnie {MAX_SAVES} światów.</div>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <button className="mc-btn sm:flex-1" onClick={() => setView('main')}>
                    Anuluj
                  </button>
                  <button className="mc-btn mc-btn-primary sm:flex-1" onClick={create}>
                    Stwórz świat
                  </button>
                </div>
              </div>
            )}

            {view === 'controls' && (
              <div className="mc-card flex w-full flex-col gap-4 p-4 sm:p-5">
                <Controls />
                <button className="mc-btn" onClick={() => setView('main')}>
                  Gotowe
                </button>
              </div>
            )}

            {view === 'options' && (
              <div className="mc-card p-3 sm:p-4">
                <SettingsScreen
                  settings={settings}
                  onChange={(n) => {
                    setSettings(n);
                    saveSettings(n);
                  }}
                  onClose={() => setView('main')}
                />
              </div>
            )}
          </div>
        </div>

        <footer className="mt-3 flex w-full max-w-[1040px] flex-col items-center justify-between gap-1 border-t border-white/10 pt-2 text-center text-[11px] leading-tight text-white/55 sm:flex-row sm:text-left sm:text-xs">
          <span>BlockCraft {GAME_VERSION} „{GAME_RELEASE_NAME}”</span>
          <span>Gra w przeglądarce · Three.js · GitHub Pages</span>
        </footer>
      </div>
      {/* 2.8: ukryty input na końcu drzewa – pola formularzy zostają pierwsze w DOM. */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
        onChange={(e) => { pickSavesFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}


export function AchievementsPanel({ unlocked }: { unlocked: string[] }) {
  const have = new Set(unlocked);
  return (
    <div className="max-h-[360px] w-full space-y-1 overflow-y-auto">
      <div className="mb-1 text-sm opacity-80">{have.size} / {ACHIEVEMENTS.length}</div>
      {ACHIEVEMENTS.map((a) => (
        <div key={a.id} className="px-2 py-1" style={{ background: have.has(a.id) ? 'rgba(40,80,30,0.85)' : 'rgba(0,0,0,0.45)' }}>
          <div className={have.has(a.id) ? 'text-yellow-200' : 'text-gray-400'}>{have.has(a.id) ? a.title : '???'}</div>
          <div className="text-xs opacity-80">{have.has(a.id) ? a.text : 'Jeszcze nieodkryte'}</div>
        </div>
      ))}
    </div>
  );
}

export function PauseMenu({
  settings,
  shareUrl,
  worldName,
  unlocked,
  onSettings,
  onResume,
  onJournal,
  onWaypoints,
  onCommands,
  onQuit,
  onSave,
  session,
  onSkin,
}: {
  settings: Settings;
  shareUrl: string;
  worldName?: string;
  /** 2.10: gra w sesji – chowamy zapis i pokazujemy obsadę. */
  session?: {
    role: 'host' | 'guest';
    players: { id: string; name: string; hue: number; ping: number; self?: boolean; skin?: string }[];
  } | null;
  unlocked?: string[];
  onSettings: (s: Settings) => void;
  onResume: () => void;
  onJournal: () => void;
  onWaypoints?: () => void;
  /** 2.9: otwiera czat z pełną listą komend. */
  onCommands?: () => void;
  onQuit: () => void;
  onSave: () => void;
  /** 2.12: skórka zmieniana w pauzie działa od razu w świecie. */
  onSkin?: (id: string) => void;
}) {
  const [view, setView] = useState<'main' | 'options' | 'controls' | 'achievements'>('main');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      window.history.replaceState(null, '', shareUrl);
    } catch {
      /* ignore */
    }
    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      /* clipboard can be blocked – the address bar already has the link */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const [showNews, setShowNews] = useState(false);
  return (
    <div
      className="absolute inset-0 flex items-start justify-center overflow-y-auto px-[max(8px,env(safe-area-inset-left))] pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:items-center"
      style={{ background: 'rgba(0,0,0,0.62)' }}
    >
      <div className="flex max-h-[96vh] w-full max-w-[460px] flex-col items-stretch gap-2.5 px-4 py-5">
        {view === 'main' && (
          <>
            <div className="mb-0.5 flex items-end justify-between gap-2">
              <div className="text-2xl mc-text">Menu gry</div>
              <span className="mc-badge">v{GAME_VERSION}</span>
            </div>
            {worldName && <div className="-mt-1 mb-1 text-sm opacity-75">{worldName}</div>}
            {session && (
              <div className="mb-1 border border-white/15 bg-black/40 p-2 text-left text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-green-300">Gra razem · {session.players.length} os.</span>
                  <span className="text-white/50">{session.role === 'host' ? 'gospodarz' : 'gość'}</span>
                </div>
                <div className="space-y-0.5">
                  {session.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5">
                      <SkinHead skin={p.skin || `hsl(${p.hue} 60% 55%)`} size={16} />
                      <span className={p.self ? 'text-yellow-200' : ''}>{p.name}{p.self ? ' (ty)' : ''}</span>
                      <span className="ml-auto text-white/40">{p.ping >= 0 ? `${p.ping} ms` : '…'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="mc-btn mc-btn-primary" onClick={onResume}>
              Wróć do gry
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="mc-btn !px-2 !py-2 !text-[15px]" onClick={() => setView('options')}>
                Opcje...
              </button>
              <button className="mc-btn !px-2 !py-2 !text-[15px]" onClick={() => setView('controls')}>
                Sterowanie
              </button>
              {/* 2.14: szybkie przełączniki ułatwień – bez wchodzenia w opcje. */}
              <button
                className={`mc-btn !px-2 !py-2 !text-[13px] ${settings.autoJump ? '!border-green-400/60' : 'opacity-70'}`}
                aria-pressed={settings.autoJump}
                onClick={() => onSettings({ ...settings, autoJump: !settings.autoJump })}
              >
                Auto-skok: {settings.autoJump ? 'wł.' : 'wył.'}
              </button>
              <button
                className={`mc-btn !px-2 !py-2 !text-[13px] ${settings.autoAttack ? '!border-green-400/60' : 'opacity-70'}`}
                aria-pressed={settings.autoAttack}
                onClick={() => onSettings({ ...settings, autoAttack: !settings.autoAttack })}
              >
                Auto-bicie: {settings.autoAttack ? 'wł.' : 'wył.'}
              </button>
              <button className="mc-btn col-span-2 !py-2 !text-[15px]" onClick={onJournal}>
                Dziennik przygód · J
              </button>
              {onWaypoints && (
                <button className="mc-btn col-span-2 !py-2 !text-[15px]" onClick={onWaypoints}>
                  Punkty podróży · K
                </button>
              )}
              {onCommands && (
                <button className="mc-btn col-span-2 !py-2 !text-[15px]" onClick={onCommands}>
                  Komendy i czat · T
                </button>
              )}
              <button className="mc-btn col-span-2 !py-2 !text-[15px]" onClick={() => setView('achievements')}>
                Osiągnięcia ({unlocked?.length ?? 0}/{ACHIEVEMENTS.length})
              </button>
            </div>
            {!session && (
              <button
                className="mc-btn"
                onClick={() => {
                  onSave();
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
              >
                {saved ? 'Zapisano ✓' : 'Zapisz świat'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {!session ? (
                <button className="mc-btn !px-2 !py-2 !text-[15px]" onClick={copyLink}>
                  {copied ? 'Skopiowano ✓' : 'Kopiuj link'}
                </button>
              ) : (
                <div className="flex items-center justify-center text-[11px] leading-tight text-white/40">
                  Świat prowadzi gospodarz
                </div>
              )}
              <button className="mc-btn !px-2 !py-2 !text-[15px]" onClick={toggleFullscreen}>
                Pełny ekran
              </button>
            </div>
            <button className="mc-btn" onClick={onQuit}>
              {session ? 'Wyjdź z sesji do menu' : 'Zapisz i wyjdź do menu'}
            </button>
            <div className="mt-1 border-t border-white/10 pt-1">
              <button
                className="flex w-full items-center justify-between px-1 py-1.5 text-sm text-yellow-200/90 hover:text-yellow-100"
                aria-expanded={showNews}
                onClick={() => setShowNews((v) => !v)}
              >
                <span>Nowości w {GAME_VERSION} „{GAME_RELEASE_NAME}”</span>
                <span className="text-xs opacity-70">{showNews ? '▲' : '▼'}</span>
              </button>
              {showNews && (
                <ul className="mt-1 space-y-1.5 border border-white/10 bg-black/40 p-2 text-xs leading-snug text-white/80">
                  {RELEASE_HIGHLIGHTS.map((h) => (
                    <li key={h.title}>
                      <span className="text-yellow-200">{h.title}:</span> {h.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        {view === 'options' && (
          <SettingsScreen settings={settings} onChange={onSettings} onClose={() => setView('main')} onSkin={onSkin} />
        )}
        {view === 'controls' && (
          <div className="flex w-full flex-col gap-4 bg-black/60 p-5">
            <Controls />
            <button className="mc-btn" onClick={() => setView('main')}>
              Gotowe
            </button>
          </div>
        )}
        {view === 'achievements' && (
          <div className="flex w-full flex-col gap-3 bg-black/60 p-4">
            <div className="text-xl mc-text">Osiągnięcia</div>
            <AchievementsPanel unlocked={unlocked ?? []} />
            <button className="mc-btn" onClick={() => setView('main')}>
              Gotowe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeathScreen({ onRespawn, onQuit }: { onRespawn: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(120,0,0,0.5)' }}>
      <div className="mb-2 text-5xl font-bold mc-text">Zginąłeś!</div>
      <div className="mb-6 text-lg mc-text">Ekwipunek wypadł w miejscu śmierci.</div>
      <div className="flex w-[360px] max-w-[92vw] flex-col gap-3">
        <button className="mc-btn" onClick={onRespawn}>
          Odrodzenie
        </button>
        <button className="mc-btn" onClick={onQuit}>
          Menu główne
        </button>
      </div>
      <div className="text-sm opacity-80 mc-text">Enter – odrodzenie</div>
    </div>
  );
}
