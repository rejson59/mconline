import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '../game/engine';
import { ACHIEVEMENTS } from '../game/achievements';
import { exportSaves, importSaves } from '../game/saves';
import { loadSettings, saveSettings, type Settings } from '../utils/settings';
import SettingsScreen from './SettingsScreen';

export type WorldType = 'normal' | 'flat';

// BASE_URL is "./" for this build, so the background resolves relative to
// index.html and works on GitHub Pages project sites, custom domains and file://
const MENU_BG = `${import.meta.env?.BASE_URL ?? './'}menu-bg.jpg`;

export type { Settings } from '../utils/settings';

const SPLASHES = [
  'Teraz też na telefonach!',
  'Aktualizacja 2.0: Mobilny skok!',
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
    <div className="relative mb-10 select-none text-center">
      <h1
        className="text-6xl font-bold tracking-wider sm:text-8xl"
        style={{
          color: '#bdbdbd',
          textShadow: '0 2px 0 #8a8a8a, 0 4px 0 #6b6b6b, 0 6px 0 #4a4a4a, 0 8px 0 #2b2b2b, 0 10px 12px rgba(0,0,0,0.8)',
          WebkitTextStroke: '2px #1c1c1c',
        }}
      >
        BLOCKCRAFT
      </h1>
      <div className="absolute -bottom-5 right-0 flex items-center gap-2">
        <span
          className="px-2 py-0.5 text-sm font-bold"
          style={{ background: '#3c8527', color: '#fff', border: '2px solid #1c1c1c', boxShadow: '2px 2px 0 rgba(0,0,0,0.6)' }}
        >
          WERSJA 2.0
        </span>
        <span className="splash text-lg font-semibold sm:text-xl" style={{ color: '#ffff00', textShadow: '2px 2px 0 #3f3f00' }}>
          {splash}
        </span>
      </div>
    </div>
  );
}

export function Controls() {
  const rows: [string, string][] = [
    ['W A S D', 'Ruch'],
    ['Mysz', 'Rozglądanie się'],
    ['Spacja', 'Skok / pływanie w górę'],
    ['Spacja x2 / F', 'Latanie (tryb kreatywny)'],
    ['Shift', 'Skradanie / lot w dół'],
    ['W x2 lub Ctrl', 'Sprint'],
    ['LPM (przytrzymaj)', 'Kopanie / atak / podpalenie TNT'],
    ['PPM', 'Stawianie bloku / użycie stołu'],
    ['ŚPM', 'Wybierz blok'],
    ['1-9 / kółko', 'Wybór slotu'],
    ['E', 'Ekwipunek / wytwarzanie'],
    ['Q', 'Wyrzuć przedmiot'],
    ['T lub /', 'Czat i komendy'],
    ['PPM na jedzeniu', 'Jedzenie'],
    ['PPM na piecu', 'Przetapianie'],
    ['PPM na łóżku', 'Sen i punkt odrodzenia'],
    ['PPM na drzwiach / włazie', 'Otwórz lub zamknij'],
    ['PPM na skrzyni', 'Schowek'],
    ['Drabina + W / spacja', 'Wspinaczka'],
    ['Nożyce + LPM na owcy', 'Wełna bez zabijania'],
    ['Krzesiwo + PPM', 'Podpal TNT'],
    ['Łuk: przytrzymaj PPM, puść', 'Wystrzał ze strzałą'],
    ['Kompas / zegar', 'Kierunek odrodzenia i pora dnia'],
    ['Motyka + PPM', 'Grządka'],
    ['PPM na wilku z surowym mięsem', 'Zatamej wilka (strzeże gracza)'],
    ['PPM na stole zaklęć', 'Zaklnij narzędzie, broń lub pancerz'],
    ['Stół zaklęć + biblioteczki', 'Wyższe poziomy zaklęć (do 30)'],
    ['Tarcza w ręku', 'Przyłap strzały i osłabia ciosy'],
    ['Sloty pancerza (w E)', 'Załóż pancerz (4 elementy)'],
    ['M', 'Minimapa'],
    ['F3', 'Informacje debugowania'],
    ['Esc', 'Pauza'],
  ];
  const touchRows: [string, string][] = [
    ['Drążek (lewy dół)', 'Ruch · pchnij do oporu = sprint'],
    ['Przeciągnij ekran', 'Rozglądanie się'],
    ['Tapnij w blok', 'Postaw / użyj / zjedz (tryb Tapnij)'],
    ['Przytrzymaj blok', 'Kopanie – celownik podąża za palcem'],
    ['Tapnij w moba', 'Atak'],
    ['⬆', 'Skok · 2× w kreatywnym = latanie'],
    ['⇣', 'Skradanie / lot w dół'],
    ['✈ (kreatywny)', 'Włącz / wyłącz latanie'],
    ['Pasek na dole', 'Tapnij slot, aby go wybrać'],
    ['💬', 'Czat i komendy'],
  ];
  return (
    <div className="flex flex-col gap-4 text-[15px]">
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-yellow-300 mc-text">{k}</div>
            <div className="text-gray-200 mc-text">{v}</div>
          </div>
        ))}
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
  worldType?: WorldType;
}

export function MainMenu({
  saves,
  sharedSeed,
  sharedMode,
  onPlay,
  onNew,
  onDelete,
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
}) {
  const [view, setView] = useState<'main' | 'new' | 'controls' | 'options'>(sharedSeed != null ? 'new' : 'main');
  const [seedText, setSeedText] = useState(sharedSeed != null ? String(sharedSeed) : '');
  const [worldName, setWorldName] = useState('');
  const [mode, setMode] = useState<GameMode>(sharedMode ?? 'survival');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [worldType, setWorldType] = useState<WorldType>('normal');
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
      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center px-4">
        <Title />
        {view === 'main' && (
          <div className="flex w-full flex-col gap-3">
            {saves.length > 0 && (
              <div className="max-h-[30vh] space-y-2 overflow-y-auto bg-black/40 p-2">
                {saves.map((s) => (
                  <div key={s.id} className="flex gap-2">
                    <button className="mc-btn min-w-0 flex-1 !py-2 text-left" onClick={() => onPlay(s.id)}>
                      {s.name || 'Świat'}
                      <span className="block text-xs font-normal opacity-80">
                        dzień {s.day ?? 1} · {s.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'} · {s.worldType === 'flat' ? 'płaski' : 'normalny'} · ziarno {s.seed}
                      </span>
                    </button>
                    <button
                      className="mc-btn !w-24 !px-2 !text-sm"
                      onClick={() => {
                        if (confirmId === s.id) onDelete(s.id);
                        else setConfirmId(s.id);
                      }}
                    >
                      {confirmId === s.id ? 'Na pewno?' : 'Usuń'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="mc-btn" onClick={() => setView('new')}>
              Nowy świat
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
      <div className="absolute bottom-2 left-3 text-sm mc-text">BlockCraft 2.0 „Mobilny skok”</div>
      <div className="absolute bottom-2 right-3 text-sm mc-text">Gra działa w przeglądarce · Three.js</div>
      <div className="absolute bottom-8 left-3 text-xs opacity-70 mc-text">Wersja przeglądarkowa · GitHub Pages</div>
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
  onQuit,
  onSave,
}: {
  settings: Settings;
  shareUrl: string;
  worldName?: string;
  unlocked?: string[];
  onSettings: (s: Settings) => void;
  onResume: () => void;
  onQuit: () => void;
  onSave: () => void;
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
            <button className="mc-btn" onClick={() => setView('controls')}>
              Sterowanie
            </button>
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
                onSave();
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
            >
              {saved ? 'Zapisano ✓' : 'Zapisz świat'}
            </button>
            <button className="mc-btn" onClick={onQuit}>
              Zapisz i wyjdź do menu
            </button>
          </>
        )}
        {view === 'options' && (
          <SettingsScreen settings={settings} onChange={onSettings} onClose={() => setView('main')} />
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
          }
        }}
      />
    </div>
  );
}
