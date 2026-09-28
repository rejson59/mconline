import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '../game/engine';
import type { WorldDifficulty } from '../game/difficulty';
import { ACHIEVEMENTS } from '../game/achievements';
import { exportSave, exportSaves, importSaves, MAX_SAVES } from '../game/saves';
import { loadSettings, saveSettings, type Settings } from '../utils/settings';
import { GAME_RELEASE_NAME, GAME_VERSION } from '../utils/version';
import SettingsScreen from './SettingsScreen';

export type WorldType = 'normal' | 'flat';

// BASE_URL is "./" for this build, so the background resolves relative to
// index.html and works on GitHub Pages project sites, custom domains and file://
const MENU_BG = `${import.meta.env?.BASE_URL ?? './'}menu-bg.jpg`;

export type { Settings } from '../utils/settings';

const SPLASHES = [
  'BlockCraft 2.7: odkryj Bagna, Sawannę i Dżunglę!',
  '2.7: nowe drzewa, błoto i lilie wodne!',
  'Na kwiecistych łąkach mieszkają płochliwe króliki!',
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
    <div className="mb-7 flex w-full flex-col items-center text-center">
      <h1
        className="max-w-full whitespace-nowrap text-[clamp(2.3rem,12vw,4rem)] font-bold leading-none tracking-[0.05em]"
        style={{
          color: '#bdbdbd',
          textShadow: '0 2px 0 #8a8a8a, 0 4px 0 #6b6b6b, 0 6px 0 #4a4a4a, 0 8px 0 #2b2b2b, 0 10px 12px rgba(0,0,0,0.8)',
          WebkitTextStroke: '2px #1c1c1c',
        }}
      >
        BLOCKCRAFT
      </h1>
      <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2 px-1">
        <span
          className="shrink-0 px-2 py-0.5 text-sm font-bold"
          style={{ background: '#3c8527', color: '#fff', border: '2px solid #1c1c1c', boxShadow: '2px 2px 0 rgba(0,0,0,0.6)' }}
        >
          WERSJA {GAME_VERSION}
        </span>
        <span className="splash max-w-full text-center text-sm font-semibold leading-tight sm:text-xl" style={{ color: '#ffff70', textShadow: '2px 2px 0 #3f3f00' }}>
          {splash}
        </span>
      </div>
    </div>
  );
}

export function Controls() {
  const rows: [string, string][] = [
    ['W A S D', 'Ruch'],
    ['Mysz', 'Rozglądanie się (surowe wejście – bez przyspieszeń systemu)'],
    ['Spacja', 'Skok / pływanie w górę'],
    ['Spacja x2 / F', 'Latanie (tryb kreatywny)'],
    ['Shift', 'Skradanie / lot w dół (lewy lub prawy)'],
    ['W x2 lub Ctrl', 'Sprint'],
    ['LPM (przytrzymaj)', 'Kopanie · atak bije dalej z cooldownem'],
    ['PPM', 'Stawianie bloku / użycie stołu'],
    ['ŚPM', 'Wybierz blok'],
    ['1-9 (także numeryczne) / kółko', 'Wybór slotu'],
    ['E', 'Ekwipunek / wytwarzanie'],
    ['Q', 'Wyrzuć przedmiot · Ctrl+Q: cały stos'],
    ['T lub /', 'Czat i komendy'],
    ['PPM na jedzeniu', 'Jedzenie'],
    ['PPM na piecu', 'Przetapianie'],
    ['PPM na łóżku', 'Sen i punkt odrodzenia'],
    ['PPM na drzwiach / włazie', 'Otwórz lub zamknij (Shift+PPM stawia blok)'],
    ['PPM / tap na mieszkańcu', 'Handel: kartograf, rybak, ogrodnik, kowal i inni. Oferty rosną wraz z doświadczeniem'],
    ['PPM na skrzyni', 'Schowek'],
    ['Drabina + W / spacja', 'Wspinaczka'],
    ['Jaszczurki na Bagnach', 'Na błocie mają brązowe ciało, na trawie zielone; jasny grzbiet i oczy zawsze widać'],
    ['Nietoperze w lesie nocą', 'Latają i piszczą po zmierzchu, za dnia odpoczywają przy ziemi; nie atakują'],
    ['Żaby przy wodzie', 'Skaczą, rechoczą i polują na meszki nad brzegiem; meszki nie zostawiają łupu ani PD'],
    ['Lisy w tajdze i lasach', 'Uciekają przed graczem i wilkami; polują na króliki/kurczaki, kradną porzucone jedzenie'],
    ['Nożyce + LPM na owcy', 'Wełna bez zabijania'],
    ['Krzesiwo + PPM', 'Podpal TNT'],
    ['Łuk: przytrzymaj PPM, puść', 'Wystrzał ze strzałą'],
    ['Wędka: PPM', 'Zarzuć przynętę i zaciągnij brań'],
    ['Robak / świetlista przynęta: PPM / tap', 'Załóż na wędkę w ekwipunku (jedna na branie)'],
    ['Lorneta: PPM + G / ⌖', 'Przybliż i oznacz widoczny punkt (na dotyku przycisk ⌖)'],
    ['PPM na kowadle', 'Scal dwa narzędzia i nadaj nazwę'],
    ['PPM na statywie alchemicznym', 'Warzy napoje'],
    ['PPM na fiolce przy wodzie', 'Napełnij fiolkę'],
    ['Statyw: zaczarowany napój + pióro / cukier', 'Lekkie lądowanie / zryw (czas na HUD-zie)'],
    ['Kompas / zegar', 'Kierunek odrodzenia i pora dnia'],
    ['Motyka + PPM', 'Grządka'],
    ['PPM na wilku z surowym mięsem', 'Zatamej wilka (strzeże gracza)'],
    ['PPM na stole zaklęć', 'Zaklnij narzędzie, broń lub pancerz'],
    ['Stół zaklęć + biblioteczki', 'Wyższe poziomy zaklęć (do 30)'],
    ['Tarcza w ręku', 'Przyłap strzały i osłabia ciosy'],
    ['Sloty pancerza (w E)', 'Załóż pancerz (4 elementy)'],
    ['M', 'Minimapa'],
    ['J', 'Dziennik przygód i postęp celów'],
    ['K', 'Mapa odkrywania, znaczniki celu i punkt śmierci'],
    ['PPM / tap z kompasem biomów', 'Wybierz biom, wyszukaj w zasięgu i śledź punkt'],
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

/** Fullscreen is unavailable on some mobile browsers – never throw. */
export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  } catch {
    /* ignore */
  }
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
}: {
  saves: WorldCard[];
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
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 scale-110"
        style={{
          backgroundImage: `url("${MENU_BG}")`,
          backgroundColor: '#3b2a1e',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(2px) brightness(0.8)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      <div className="relative z-10 flex max-h-[calc(100dvh-5rem)] w-full max-w-[440px] flex-col items-center overflow-y-auto px-4 py-3">
        <Title />
        {view === 'main' && (
          <div className="flex w-full flex-col gap-3">
            {saves.length > 0 && (
              <section aria-label="Zapisane światy" className="bg-black/40 p-2">
                <p className="sr-only">W menu zarządzania możesz zmienić nazwę, utworzyć kopię, wyeksportować świat albo wybrać Usuń.</p>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-base text-yellow-200 mc-text">Twoje światy <span className="text-xs text-white/70">{saves.length}/8</span></h2>
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
                <div className="max-h-[25vh] space-y-2 overflow-y-auto">
                  {visibleWorlds.map((s) => (
                    <div key={s.id} className="bg-black/25 p-1">
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
                        <div className="mt-1.5 space-y-1.5 border border-white/20 bg-black/40 p-2">
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
            <button className="mc-btn" onClick={() => setView('new')}>
              {saves.length >= 8 ? 'Nowy świat · limit 8' : 'Nowy świat'}
            </button>
            <button className="mc-btn" onClick={() => setView('controls')}>
              Sterowanie
            </button>
            <button className="mc-btn" onClick={() => setView('options')}>
              Opcje
            </button>
            <button className="mc-btn" onClick={toggleFullscreen}>
              Pełny ekran
            </button>
            <div className="mt-1 flex gap-2">
              <button className="mc-btn !py-2 !text-sm" onClick={downloadSaves}>
                Eksport zapisów
              </button>
              <button className="mc-btn !py-2 !text-sm" onClick={() => fileRef.current?.click()}>
                Import zapisów
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { pickSavesFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        )}
        {view === 'new' && (
          <div className="flex w-full flex-col gap-3 bg-black/50 p-5">
            <div className="text-lg mc-text">{sharedSeed != null ? 'Świat z linku' : 'Utwórz nowy świat'}</div>
            {sharedSeed != null && (
              <div className="text-xs text-green-300">Ziarno i tryb zostały wczytane z adresu – kliknij „Stwórz świat”, aby zagrać.</div>
            )}
            <label className="text-sm text-gray-300">Nazwa świata</label>
            <input className="mc-input" value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="np. Wyspa" onKeyDown={(e) => e.stopPropagation()} />
            <label className="text-sm text-gray-300">Ziarno generatora (puste = losowe)</label>
            <input className="mc-input" value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="np. 12345 lub dowolny tekst" />
            <button className="mc-btn" onClick={() => setMode(mode === 'survival' ? 'creative' : 'survival')}>
              Tryb gry: {mode === 'survival' ? 'Przetrwanie' : 'Kreatywny'}
            </button>
            <button className="mc-btn" onClick={() => setWorldType(worldType === 'normal' ? 'flat' : 'normal')}>
              Typ świata: {worldType === 'normal' ? 'Normalny' : 'Płaski'}
            </button>
            <div className="text-xs text-gray-300">
              {worldType === 'flat'
                ? 'Świat płaski: równa trawna równina na wysokości 64 – idealny do budowania i kopania rud.'
                : mode === 'survival'
                  ? 'Zetnij drzewo, wytwórz kilof, postaw drzwi i skrzynię. W jaskiniach leżą skrzynie.'
                  : 'Nieograniczone bloki, latanie, natychmiastowe niszczenie, brak obrażeń.'}
            </div>
            <div className="text-xs text-gray-300">Grafika dobierze się automatycznie do twojego urządzenia (zmienisz w opcjach).</div>
            <div className="text-xs text-gray-300">Nowy świat nie kasuje pozostałych zapisów. Maksymalnie 8 światów.</div>
            <div className="flex gap-3">
              <button className="mc-btn" onClick={() => setView('main')}>
                Anuluj
              </button>
              <button className="mc-btn" onClick={create}>
                Stwórz świat
              </button>
            </div>
          </div>
        )}
        {view === 'controls' && (
          <div className="flex w-full flex-col gap-4 bg-black/60 p-5">
            <Controls />
            <button className="mc-btn" onClick={() => setView('main')}>
              Gotowe
            </button>
          </div>
        )}
        {view === 'options' && (
          <SettingsScreen
            settings={settings}
            onChange={(n) => {
              setSettings(n);
              saveSettings(n);
            }}
            onClose={() => setView('main')}
          />
        )}
      </div>
      <div
        className="absolute inset-x-3 flex flex-col items-center gap-0.5 text-center text-[11px] leading-tight mc-text sm:flex-row sm:justify-between sm:text-sm sm:text-left"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        <span>BlockCraft {GAME_VERSION} „{GAME_RELEASE_NAME}”</span>
        <span className="opacity-80">Gra w przeglądarce · Three.js · GitHub Pages</span>
      </div>
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
  difficulty,
  onDifficulty,
  onResume,
  onJournal,
  onWaypoints,
  onQuit,
  onSave,
}: {
  settings: Settings;
  shareUrl: string;
  worldName?: string;
  unlocked?: string[];
  onSettings: (s: Settings) => void;
  difficulty?: WorldDifficulty;
  onDifficulty?: (patch: Partial<WorldDifficulty>) => boolean;
  onResume: () => void;
  onJournal: () => void;
  onWaypoints?: () => void;
  onQuit: () => void;
  onSave: () => boolean;
}) {
  const [view, setView] = useState<'main' | 'options' | 'controls' | 'achievements' | 'difficulty'>('main');
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
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
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="flex max-h-[92vh] w-full max-w-[420px] flex-col items-center gap-3 overflow-y-auto px-4">
        {view === 'main' && (
          <>
            <div className="mb-1 text-2xl mc-text">Menu gry</div>
            {worldName && <div className="mb-3 text-sm opacity-80">{worldName}</div>}
            <button className="mc-btn" onClick={onResume}>
              Wróć do gry
            </button>
            <button className="mc-btn" onClick={() => setView('options')}>
              Opcje...
            </button>
            {difficulty && onDifficulty && <button className="mc-btn" onClick={() => setView('difficulty')}>
              Trudność świata...
            </button>}
            <button className="mc-btn" onClick={() => setView('controls')}>
              Sterowanie
            </button>
            <button className="mc-btn" onClick={onJournal}>
              Dziennik przygód · J
            </button>
            {onWaypoints && (
              <button className="mc-btn" onClick={onWaypoints}>
                Mapa i punkty podróży · K
              </button>
            )}
            <button className="mc-btn" onClick={() => setView('achievements')}>
              Osiągnięcia ({unlocked?.length ?? 0}/{ACHIEVEMENTS.length})
            </button>
            <button className="mc-btn" onClick={copyLink}>
              {copied ? 'Link skopiowany ✓' : 'Kopiuj link do świata'}
            </button>
            <button className="mc-btn" onClick={toggleFullscreen}>
              Pełny ekran
            </button>
            <button
              className="mc-btn"
              onClick={() => {
                const ok = onSave();
                setSaved(ok);
                setSaveFailed(!ok);
                setTimeout(() => { setSaved(false); setSaveFailed(false); }, 3000);
              }}
            >
              {saveFailed ? 'Błąd zapisu — sprawdź pamięć przeglądarki' : saved ? 'Zapisano ✓' : 'Zapisz świat'}
            </button>
            <button className="mc-btn" onClick={onQuit}>
              Zapisz i wyjdź do menu
            </button>
          </>
        )}
        {view === 'options' && (
          <SettingsScreen settings={settings} onChange={onSettings} onClose={() => setView('main')} />
        )}
        {view === 'difficulty' && difficulty && onDifficulty && (
          <div className="flex w-full flex-col gap-3 bg-black/60 p-4 text-sm text-white">
            <div className="text-xl mc-text">Trudność tego świata</div>
            <p>Zmiany działają od razu i zapisują się tylko w tym świecie. Tryb kreatywny nie otrzymuje obrażeń.</p>
            {([
              ['aggression', 'Agresja mobów', [['spokojna', 'Spokojna: bez ataków i nowych potworów'], ['normalna', 'Normalna'], ['zaciekla', 'Zacięta: szybsze i liczniejsze potwory']]],
              ['damage', 'Obrażenia od potworów', [['lagodne', 'Łagodne: ×0,7'], ['normalne', 'Normalne'], ['surowe', 'Surowe: ×1,4']]],
              ['resources', 'Zasoby (rudy, plony, mięso)', [['skape', 'Skąpe: 25% szans na utratę jednej sztuki'], ['normalne', 'Normalne'], ['obfite', 'Obfite: dodatkowa sztuka rudy, pszenicy lub mięsa (bez duplikacji bloków)']]],
            ] as const).map(([key, title, options]) => (
              <div key={key} className="flex flex-col gap-1">
                <strong>{title}</strong>
                {options.map(([value, label]) => <button key={value} type="button" className="mc-btn !py-1 !text-sm" aria-pressed={difficulty[key] === value}
                  onClick={() => {
                    const ok = onDifficulty({ [key]: value });
                    setSaveFailed(!ok);
                  }}>{difficulty[key] === value ? '✓ ' : ''}{label}</button>)}
              </div>
            ))}
            {saveFailed && <p role="alert">Nie udało się zapisać trudności. Zwolnij miejsce i zapisz świat ponownie.</p>}
            <button className="mc-btn" onClick={() => setView('main')}>Gotowe</button>
          </div>
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

export function ChatInput({ onSubmit, onClose }: { onSubmit: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="absolute bottom-24 left-2 right-2 sm:right-auto sm:w-[640px]">
      <input
        ref={ref}
        className="w-full px-2 py-1 text-[16px] text-white outline-none"
        style={{ background: 'rgba(0,0,0,0.6)', fontFamily: 'inherit' }}
        value={text}
        placeholder="Wpisz wiadomość lub /help"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            if (text.trim()) {
              history.current.unshift(text);
              onSubmit(text);
            }
            onClose();
          } else if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowUp') {
            hIdx.current = Math.min(history.current.length - 1, hIdx.current + 1);
            if (history.current[hIdx.current]) setText(history.current[hIdx.current]);
          } else if (e.key === 'ArrowDown') {
            // 2.5: strzałka w dół wraca po historii komend.
            hIdx.current = Math.max(-1, hIdx.current - 1);
            setText(hIdx.current >= 0 ? history.current[hIdx.current] ?? '' : '');
          }
        }}
      />
    </div>
  );
}
