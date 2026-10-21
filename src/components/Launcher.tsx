/**
 * 2.24: Launcher BlockCraft – powłoka w stylu Lunar Client / Prism Launcher.
 *
 * Zamiast od razu wrzucać gracza do menu gry, pokazujemy klienta: profil,
 * instancje światów, serwery, paczki, skórki, ustawienia i konsolę. Kliknięcie
 * „GRAJ” uruchamia tę samą grę co wcześniej, tylko z wybranym światem.
 *
 * Launcher jest w 100% lokalny (localStorage) i nie pobiera niczego z sieci:
 * tekstury, modele i dźwięki są wbudowane w build.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode } from '../game/engine';
import { DEFAULT_SKIN_ID, SKINS, loadSkinId, saveSkinId, skinById } from '../game/skins';
import { applyPreset, loadSettings, saveSettings, type Settings } from '../utils/settings';
import { PRESETS, autoPreset, describeProfile, type PresetName } from '../utils/performance';
import { GAME_VERSION } from '../utils/version';
import { skinFace, skinPortrait } from '../game/skinArt';
import { officialItemCount, officialTileCount } from '../game/packArt';
import { mobModelCount } from '../game/mobModels';
import { MOB_SKINS } from '../game/art/vanillaArt.generated';
import type { WorldCard, WorldType } from './Menus';
import SettingsScreen from './SettingsScreen';
import { SkinAvatar, SkinPicker } from './SkinPicker';
import BlockCube from './launcher/BlockCube';
import {
  LAUNCHER_TABS,
  LAUNCH_STEPS,
  TARGET_LABEL,
  VERSION_LABEL,
  loadLauncherProfile,
  logEntry,
  launcherNews,
  saveLauncherProfile,
  sinceLabel,
  worldMeta,
  type LauncherProfile,
  type LauncherTab,
  type LogEntry,
} from './launcher/model';

export type { LauncherTab } from './launcher/model';

export interface LauncherProps {
  saves: WorldCard[];
  onPlayWorld: (id: string) => void;
  onNewWorld: (seed: number, mode: GameMode, name: string, worldType: WorldType) => void;
  onDeleteWorld: (id: string) => void;
  onRenameWorld: (id: string, name: string) => void;
  onDuplicateWorld: (id: string) => boolean;
  onToggleFavoriteWorld: (id: string) => void;
  onMultiplayer: () => void;
  /** Powrót do klasycznego menu gry (dla przyzwyczajonych do starego widoku). */
  onClassicMenu?: () => void;
}

// ----------------------------------------------------------------- ikony
type IconName =
  | 'home' | 'worlds' | 'server' | 'packs' | 'skins' | 'settings' | 'console'
  | 'play' | 'plus' | 'trash' | 'star' | 'copy' | 'pencil' | 'check' | 'bolt' | 'arrow';

const ICON_PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5',
  worlds: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9ZM3.5 12h17',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01',
  packs: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0L3 7.5m9-4.5 9 4.5M12 12l9-4.5M12 12 3 7.5M12 12v9',
  skins: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4.5 21c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5c0 .6-.1 1.2-.2 1.8l2 1.5-2 3.4-2.3-.9c-.9.8-2 1.4-3.2 1.7L13.9 22h-3.8l-.4-2.5c-1.2-.3-2.3-.9-3.2-1.7l-2.3.9-2-3.4 2-1.5c-.1-.6-.2-1.2-.2-1.8s.1-1.2.2-1.8l-2-1.5 2-3.4 2.3.9c.9-.8 2-1.4 3.2-1.7L10.1 2h3.8l.4 2.5c1.2.3 2.3.9 3.2 1.7l2.3-.9 2 3.4-2 1.5c.1.6.2 1.2.2 1.8Z',
  console: 'M4 5h16v14H4zM7 9l3 3-3 3M13 15h4',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5',
  star: 'm12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5Z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  pencil: 'M4 20h4l10.5-10.5-4-4L4 16v4Zm10-14 4 4',
  check: 'm4.5 12.5 5 5 10-11',
  bolt: 'M13 2 5 13h6l-1 9 8-11h-6l1-9Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
};

function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// ----------------------------------------------------------------- style
const PANEL = 'rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]';
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const BTN_GHOST = `${BTN_BASE} border-white/10 bg-white/[0.04] px-3.5 py-2 text-white/80 hover:border-white/25 hover:bg-white/[0.09] hover:text-white`;
const BTN_PRIMARY = `${BTN_BASE} border-emerald-400/40 bg-emerald-500/90 px-5 py-2.5 text-emerald-950 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.9)] hover:bg-emerald-400`;
const CHIP = 'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/65';

// ----------------------------------------------------------------- główny komponent
export default function Launcher({
  saves,
  onPlayWorld,
  onNewWorld,
  onDeleteWorld,
  onRenameWorld,
  onDuplicateWorld,
  onToggleFavoriteWorld,
  onMultiplayer,
  onClassicMenu,
}: LauncherProps) {
  const [profile, setProfile] = useState<LauncherProfile>(() => loadLauncherProfile());
  const [tab, setTab] = useState<LauncherTab>(() => loadLauncherProfile().tab);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [skin, setSkin] = useState<string>(() => {
    const stored = loadLauncherProfile().skin;
    return stored || loadSkinId() || DEFAULT_SKIN_ID;
  });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [launching, setLaunching] = useState<{ step: number; progress: number; world: string } | null>(null);
  const [showNewWorld, setShowNewWorld] = useState(false);
  const timers = useRef<number[]>([]);

  const pushLog = useCallback((text: string, kind: LogEntry['kind'] = 'info') => {
    setLog((list) => [...list.slice(-159), logEntry(text, kind)]);
  }, []);

  // start: komunikat jak w prawdziwym kliencie + wykryty sprzęt
  useEffect(() => {
    const stats = `${officialTileCount()} kafelków bloków, ${officialItemCount()} ikon przedmiotów, ${Object.keys(MOB_SKINS).length} skórek mobów`;
    pushLog(`Launcher BlockCraft ${GAME_VERSION} gotowy`, 'ok');
    pushLog(`Paczka 26.2.x Template wczytana: ${stats}`);
    pushLog(`Cel zgodności: Minecraft ${TARGET_LABEL}`);
    try {
      const p = autoPreset();
      pushLog(`Sprzęt: ${describeProfile(p.profile)} → preset „${PRESETS[p.preset].label}”`);
    } catch {
      pushLog('Nie udało się wykryć sprzętu – zostaje preset z ustawień', 'warn');
    }
    return () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: LauncherProfile) => {
    setProfile(next);
    saveLauncherProfile(next);
  }, []);

  const go = useCallback(
    (next: LauncherTab) => {
      setTab(next);
      persist({ ...profile, tab: next });
    },
    [persist, profile],
  );

  const setSettingsLive = useCallback(
    (next: Settings) => {
      setSettings(next);
      saveSettings(next);
    },
    [],
  );

  // ostatni świat z profilu (albo najświeższy)
  const lastWorld = useMemo(() => {
    const found = saves.find((w) => w.id === profile.lastWorldId);
    return found ?? saves[0] ?? null;
  }, [saves, profile.lastWorldId]);

  /** Uruchomienie gry: pasek postępu, logi, a potem prawdziwy start świata. */
  const launch = useCallback(
    (world: WorldCard | null) => {
      if (launching) return;
      setLaunching({ step: 0, progress: 0, world: world?.name ?? 'Nowy świat' });
      pushLog(`Uruchamianie: ${world ? (world.name ?? 'świat') : 'nowy świat'}`, 'info');
      let elapsed = 0;
      LAUNCH_STEPS.forEach((step, index) => {
        elapsed += step.ms;
        const id = window.setTimeout(() => {
          setLaunching({ step: index, progress: step.progress, world: world?.name ?? 'Nowy świat' });
          pushLog(`${step.title} – ${step.detail}`, index === LAUNCH_STEPS.length - 1 ? 'ok' : 'info');
        }, elapsed);
        timers.current.push(id);
      });
      const done = window.setTimeout(() => {
        setLaunching(null);
        const next: LauncherProfile = {
          ...profile,
          skin,
          lastWorldId: world?.id ?? profile.lastWorldId,
          launches: profile.launches + 1,
          lastLaunch: Date.now(),
        };
        persist(next);
        if (world) onPlayWorld(world.id);
        else {
          const seed = Math.floor(Math.random() * 2147483647);
          onNewWorld(seed, 'survival', 'Nowy świat', 'normal');
        }
      }, elapsed + 260);
      timers.current.push(done);
    },
    [launching, onNewWorld, onPlayWorld, persist, profile, pushLog, skin],
  );

  const createWorld = (seed: number, mode: GameMode, name: string, type: WorldType) => {
    pushLog(`Tworzenie świata „${name}” (${mode === 'creative' ? 'kreatywny' : 'przetrwanie'}, ${type})`, 'info');
    persist({ ...profile, skin, launches: profile.launches });
    onNewWorld(seed, mode, name, type);
  };

  const pickSkin = (id: string) => {
    const clean = saveSkinId(id);
    setSkin(clean);
    persist({ ...profile, skin: clean });
    pushLog(`Skórka: ${skinById(clean).name}`, 'ok');
  };

  const renamePlayer = (name: string) => {
    const clean = name.slice(0, 20);
    setProfile({ ...profile, name: clean || 'Gracz' });
  };

  const commitPlayer = () => {
    const clean = (profile.name || 'Gracz').trim().slice(0, 20) || 'Gracz';
    persist({ ...profile, name: clean, skin });
    pushLog(`Profil: ${clean}`, 'info');
  };

  const playerFace = skinFace(skin);
  const playerPortrait = skinPortrait(skin);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#080a0d] text-white">
      {/* tło */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-emerald-500/12 blur-[120px]" />
        <div className="absolute right-[-10rem] top-1/3 h-[30rem] w-[30rem] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* lewa nawigacja (desktop) */}
      <aside className="relative z-10 hidden w-[236px] shrink-0 flex-col border-r border-white/[0.07] bg-black/35 px-3.5 py-4 lg:flex">
        <button type="button" onClick={() => go('home')} className="mb-6 flex items-center gap-3 px-1.5 text-left">
          <BlockCube size={34} spin />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-black tracking-wide">BLOCKCRAFT</span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Launcher</span>
          </span>
        </button>

        <nav className="flex flex-col gap-1" aria-label="Sekcje launchera">
          {LAUNCHER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-400/25'
                  : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <Icon name={t.id as IconName} size={17} className={tab === t.id ? 'text-emerald-300' : 'text-white/40 group-hover:text-white/70'} />
              <span className="flex-1">{t.label}</span>
              {t.id === 'worlds' && saves.length > 0 && (
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">{saves.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-4">
          <button
            type="button"
            onClick={() => go('skins')}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.07]"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/40">
              {playerFace ? (
                <img src={playerFace} width={32} height={32} alt="" className="pixelated" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <span className="text-lg">🧍</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{profile.name}</span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {sinceLabel(profile.lastLaunch)}
              </span>
            </span>
          </button>
          <div className="flex flex-wrap gap-1.5 px-0.5">
            <span className={CHIP}>v{GAME_VERSION}</span>
            <span className={CHIP}>MC {TARGET_LABEL.split(' ')[0]}</span>
          </div>
        </div>
      </aside>

      {/* treść */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* pasek górny */}
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] bg-black/20 px-4 py-3 backdrop-blur sm:px-6">
          <button type="button" onClick={() => go('home')} className="flex items-center gap-2.5 lg:hidden">
            <BlockCube size={26} spin={false} />
            <span className="text-[13px] font-black tracking-wide">BLOCKCRAFT</span>
          </button>
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">Launcher</span>
            <Icon name="arrow" size={13} className="text-white/25" />
            <span className="truncate text-[13px] font-bold text-white/85">
              {LAUNCHER_TABS.find((t) => t.id === tab)?.label}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {onClassicMenu && (
              <button type="button" onClick={onClassicMenu} className={`${BTN_GHOST} hidden px-2.5 py-1.5 text-[11px] sm:inline-flex`}>
                Klasyczne menu
              </button>
            )}
            <button type="button" onClick={() => launch(lastWorld)} disabled={!!launching} className={`${BTN_PRIMARY} px-3.5 py-1.5 text-[12px]`}>
              <Icon name="play" size={13} />
              GRAJ
            </button>
          </div>
        </header>

        {/* zakładki na telefonie */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 lg:hidden">
          {LAUNCHER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                tab === t.id ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25' : 'text-white/55'
              }`}
            >
              {t.short}
            </button>
          ))}
          {onClassicMenu && (
            <button
              type="button"
              onClick={onClassicMenu}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/55"
            >
              Menu gry
            </button>
          )}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1180px]">
            {tab === 'home' && (
              <HomeTab
                profile={profile}
                lastWorld={lastWorld}
                saves={saves}
                onLaunch={launch}
                onOpenWorlds={() => go('worlds')}
                onOpenServers={() => go('servers')}
                onOpenConsole={() => go('console')}
                playerFace={playerFace}
              />
            )}

            {tab === 'worlds' && (
              <WorldsTab
                saves={saves}
                lastWorldId={lastWorld?.id ?? null}
                showNew={showNewWorld}
                onShowNew={setShowNewWorld}
                onLaunch={(w) => launch(w)}
                onCreate={createWorld}
                onDelete={(id) => {
                  onDeleteWorld(id);
                  pushLog('Świat usunięty', 'warn');
                }}
                onRename={(id, name) => {
                  onRenameWorld(id, name);
                  pushLog(`Zmieniono nazwę świata na „${name}”`);
                }}
                onDuplicate={(id) => {
                  const ok = onDuplicateWorld(id);
                  pushLog(ok ? 'Świat zduplikowany' : 'Nie udało się zduplikować świata', ok ? 'ok' : 'warn');
                  return ok;
                }}
                onToggleFavorite={(id) => onToggleFavoriteWorld(id)}
              />
            )}

            {tab === 'servers' && (
              <ServersTab
                onMultiplayer={() => {
                  pushLog('Łączenie z publicznym serwerem…');
                  onMultiplayer();
                }}
                onSolo={() => launch(lastWorld)}
              />
            )}

            {tab === 'packs' && (
              <PacksTab
                settings={settings}
                onChange={setSettingsLive}
                onLog={pushLog}
              />
            )}

            {tab === 'skins' && (
              <SkinsTab
                skin={skin}
                portrait={playerPortrait}
                face={playerFace}
                name={profile.name}
                onSkin={pickSkin}
                onName={renamePlayer}
                onCommitName={commitPlayer}
              />
            )}

            {tab === 'settings' && (
              <div className={`${PANEL} p-3 sm:p-5`}>
                <SettingsScreen
                  settings={settings}
                  onChange={setSettingsLive}
                  onClose={() => go('home')}
                  onSkin={(id) => {
                    setSkin(id);
                    persist({ ...profile, skin: id });
                  }}
                />
              </div>
            )}

            {tab === 'console' && (
              <ConsoleTab
                log={log}
                onClear={() => {
                  setLog([]);
                  pushLog('Konsola wyczyszczona', 'ok');
                }}
              />
            )}
          </div>
        </main>
      </div>

      {launching && <LaunchOverlay step={launching.step} progress={launching.progress} worldName={launching.world} />}
    </div>
  );
}

// ----------------------------------------------------------------- Start
function HomeTab({
  profile,
  lastWorld,
  saves,
  onLaunch,
  onOpenWorlds,
  onOpenServers,
  onOpenConsole,
  playerFace,
}: {
  profile: LauncherProfile;
  lastWorld: WorldCard | null;
  saves: WorldCard[];
  onLaunch: (w: WorldCard | null) => void;
  onOpenWorlds: () => void;
  onOpenServers: () => void;
  onOpenConsole: () => void;
  playerFace: string | null;
}) {
  const news = useMemo(() => launcherNews(4), []);
  const stats = useMemo(
    () => [
      { label: 'kafelków bloków', value: officialTileCount(), hint: 'z paczki 26.2' },
      { label: 'ikon przedmiotów', value: officialItemCount(), hint: '1:1 z paczki' },
      { label: 'skórek mobów', value: Object.keys(MOB_SKINS).length, hint: `modele: ${mobModelCount()}` },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      {/* hero */}
      <section className={`${PANEL} relative overflow-hidden p-5 sm:p-7`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_0%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> gotowe do gry
              </span>
              <span className={CHIP}>Minecraft {TARGET_LABEL}</span>
              <span className={CHIP}>v{GAME_VERSION}</span>
            </div>
            <h1 className="mt-3 text-[clamp(1.5rem,4.4vw,2.3rem)] font-black leading-tight tracking-tight">
              Witaj z powrotem, {profile.name}!
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/55">
              {VERSION_LABEL}. Światy zapisują się w przeglądarce, a publiczny serwer trzyma wspólną
              budowlę w chmurze – bez instalacji i bez konta.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onLaunch(lastWorld)} className={`${BTN_PRIMARY} px-7 py-3 text-[15px]`}>
                <Icon name="play" size={16} />
                GRAJ
              </button>
              <button type="button" onClick={onOpenWorlds} className={BTN_GHOST}>
                <Icon name="worlds" size={15} />
                Światy ({saves.length})
              </button>
              <button type="button" onClick={onOpenServers} className={BTN_GHOST}>
                <Icon name="server" size={15} />
                Multiplayer
              </button>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              {lastWorld ? `Ostatnio: ${lastWorld.name ?? 'świat'} · ${sinceLabel(lastWorld.updated)}` : 'Pierwsze uruchomienie – utworzymy świat za Ciebie'}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-center md:w-[240px]">
            <BlockCube size={128} />
          </div>
        </div>
      </section>

      {/* kafelki statystyk */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${PANEL} p-3.5`}>
            <div className="text-2xl font-black tabular-nums text-white">{s.value}</div>
            <div className="text-[11px] font-semibold text-white/55">{s.label}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">{s.hint}</div>
          </div>
        ))}
        <div className={`${PANEL} p-3.5`}>
          <div className="flex items-center gap-2">
            {playerFace ? (
              <img src={playerFace} width={22} height={22} alt="" className="rounded" style={{ imageRendering: 'pixelated' }} />
            ) : (
              <span>🧍</span>
            )}
            <div className="text-[13px] font-bold">{profile.name}</div>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-white/30">
            uruchomień: {profile.launches}
          </div>
        </div>
      </section>

      {/* ostatni świat */}
      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className={`${PANEL} flex flex-col p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">Kontynuuj grę</h2>
            <button type="button" onClick={onOpenWorlds} className="text-[11px] font-semibold text-emerald-300/80 hover:text-emerald-200">
              wszystkie światy →
            </button>
          </div>
          {lastWorld ? (
            <div className="flex flex-1 flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/25 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-extrabold">{lastWorld.name ?? 'Świat'}</div>
                  <div className="mt-0.5 truncate text-[11px] text-white/45">{worldMeta(lastWorld)}</div>
                </div>
                {lastWorld.favorite && <span className="text-amber-300"><Icon name="star" size={15} /></span>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <button type="button" onClick={() => onLaunch(lastWorld)} className={`${BTN_PRIMARY} px-4 py-2 text-[13px]`}>
                  <Icon name="play" size={13} />
                  Uruchom świat
                </button>
                <span className="self-center text-[11px] text-white/35">zapis: {sinceLabel(lastWorld.updated)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-[13px] text-white/55">Nie masz jeszcze żadnego świata.</p>
              <button type="button" onClick={() => onLaunch(null)} className={`${BTN_PRIMARY} px-4 py-2 text-[13px]`}>
                <Icon name="plus" size={13} />
                Utwórz pierwszy świat
              </button>
            </div>
          )}
        </div>

        <div className={`${PANEL} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">Co nowego</h2>
            <button type="button" onClick={onOpenConsole} className="text-[11px] font-semibold text-white/40 hover:text-white/70">
              konsola →
            </button>
          </div>
          <ul className="space-y-2.5">
            {news.slice(0, 2).map((n) => (
              <li key={n.title} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.accent }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: n.accent }}>{n.tag}</span>
                </div>
                <div className="mt-1 text-[13px] font-bold leading-snug">{n.title}</div>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-white/50">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* pozostałe nowości */}
      <section className="grid gap-3 sm:grid-cols-2">
        {news.slice(2).map((n) => (
          <article key={n.title} className={`${PANEL} p-4`}>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.accent }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: n.accent }}>{n.tag}</span>
            </div>
            <h3 className="mt-1 text-[13.5px] font-bold">{n.title}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/50">{n.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- Światy
function WorldsTab({
  saves,
  lastWorldId,
  showNew,
  onShowNew,
  onLaunch,
  onCreate,
  onDelete,
  onRename,
  onDuplicate,
  onToggleFavorite,
}: {
  saves: WorldCard[];
  lastWorldId: string | null;
  showNew: boolean;
  onShowNew: (v: boolean) => void;
  onLaunch: (w: WorldCard) => void;
  onCreate: (seed: number, mode: GameMode, name: string, type: WorldType) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<GameMode>('survival');
  const [type, setType] = useState<WorldType>('normal');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const create = () => {
    let value: number;
    if (!seed.trim()) value = Math.floor(Math.random() * 2147483647);
    else if (/^-?\d+$/.test(seed.trim())) value = Math.abs(parseInt(seed.trim(), 10) | 0);
    else {
      let h = 0;
      for (const ch of seed.trim()) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
      value = Math.abs(h);
    }
    onCreate(value, mode, name.trim() || 'Nowy świat', type);
    setName('');
    setSeed('');
    onShowNew(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Światy</h1>
          <p className="text-[12px] text-white/45">Każdy świat to osobna instancja: własny seed, tryb i zapis.</p>
        </div>
        <button type="button" onClick={() => onShowNew(!showNew)} className={BTN_PRIMARY}>
          <Icon name="plus" size={15} />
          Nowy świat
        </button>
      </div>

      {showNew && (
        <section className={`${PANEL} p-4`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              Nazwa
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nowy świat"
                maxLength={28}
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-medium text-white outline-none placeholder:text-white/25 focus:border-emerald-400/50"
              />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              Seed (opcjonalnie)
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="np. 123456 lub dowolny tekst"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] font-medium text-white outline-none placeholder:text-white/25 focus:border-emerald-400/50"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
              {(['survival', 'creative'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${mode === m ? 'bg-emerald-500/90 text-emerald-950' : 'text-white/60 hover:text-white'}`}
                >
                  {m === 'survival' ? 'Przetrwanie' : 'Kreatywny'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
              {(['normal', 'flat'] as WorldType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${type === t ? 'bg-emerald-500/90 text-emerald-950' : 'text-white/60 hover:text-white'}`}
                >
                  {t === 'normal' ? 'Normalny' : 'Płaski'}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => onShowNew(false)} className={BTN_GHOST}>Anuluj</button>
              <button type="button" onClick={create} className={BTN_PRIMARY}>
                <Icon name="check" size={14} />
                Utwórz i graj
              </button>
            </div>
          </div>
        </section>
      )}

      {saves.length === 0 && (
        <div className={`${PANEL} flex flex-col items-center gap-3 p-10 text-center`}>
          <div className="text-4xl">🌍</div>
          <p className="text-[14px] font-semibold">Brak światów</p>
          <p className="max-w-sm text-[12px] text-white/45">
            Utwórz pierwszy świat – dostaniesz losowy seed, biomy, wioski i moby z paczki 26.2.
          </p>
          <button type="button" onClick={() => onShowNew(true)} className={BTN_PRIMARY}>
            <Icon name="plus" size={14} />
            Nowy świat
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {saves.map((w) => (
          <article
            key={w.id}
            className={`${PANEL} group relative flex flex-col gap-3 p-4 transition-colors hover:border-white/20 ${
              w.id === lastWorldId ? 'ring-1 ring-inset ring-emerald-400/30' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {renameId === w.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && renameText.trim()) {
                          onRename(w.id, renameText.trim());
                          setRenameId(null);
                        }
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      className="w-full rounded-md border border-emerald-400/40 bg-black/50 px-2 py-1 text-[13px] font-bold outline-none"
                    />
                    <button
                      type="button"
                      className="rounded-md bg-emerald-500/90 px-2 py-1 text-[11px] font-bold text-emerald-950"
                      onClick={() => {
                        if (renameText.trim()) onRename(w.id, renameText.trim());
                        setRenameId(null);
                      }}
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <h3 className="truncate text-[14.5px] font-extrabold">{w.name ?? 'Świat'}</h3>
                )}
                <p className="mt-0.5 text-[11px] text-white/45">{worldMeta(w)}</p>
                <p className="mt-0.5 text-[10.5px] text-white/30">zapis: {sinceLabel(w.updated)}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleFavorite(w.id)}
                aria-label={w.favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                className={`rounded-lg border p-1.5 transition-colors ${
                  w.favorite ? 'border-amber-300/40 bg-amber-400/15 text-amber-200' : 'border-white/10 text-white/30 hover:text-white/70'
                }`}
              >
                <Icon name="star" size={14} />
              </button>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => onLaunch(w)} className={`${BTN_PRIMARY} px-3 py-1.5 text-[12px]`}>
                <Icon name="play" size={12} />
                Graj
              </button>
              <button
                type="button"
                title="Zmień nazwę"
                onClick={() => {
                  setRenameId(w.id);
                  setRenameText(w.name ?? '');
                }}
                className={`${BTN_GHOST} px-2 py-1.5`}
              >
                <Icon name="pencil" size={13} />
              </button>
              <button type="button" title="Duplikuj" onClick={() => onDuplicate(w.id)} className={`${BTN_GHOST} px-2 py-1.5`}>
                <Icon name="copy" size={13} />
              </button>
              {confirmId === w.id ? (
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(w.id);
                      setConfirmId(null);
                    }}
                    className="rounded-lg border border-red-400/40 bg-red-500/20 px-2 py-1.5 text-[11px] font-bold text-red-200"
                  >
                    Usuń
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className={`${BTN_GHOST} px-2 py-1.5 text-[11px]`}>
                    Nie
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  title="Usuń świat"
                  onClick={() => setConfirmId(w.id)}
                  className={`${BTN_GHOST} ml-auto px-2 py-1.5 text-red-300/70 hover:border-red-400/40 hover:text-red-200`}
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Serwery
function ServersTab({ onMultiplayer, onSolo }: { onMultiplayer: () => void; onSolo: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">Serwery</h1>
        <p className="text-[12px] text-white/45">Jeden publiczny świat dla wszystkich – bez kodów, bez gospodarza.</p>
      </div>

      <section className={`${PANEL} relative overflow-hidden p-5`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_100%_0%,rgba(56,189,248,0.14),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> online
              </span>
              <span className={CHIP}>publiczny</span>
            </div>
            <h2 className="mt-2 text-[17px] font-extrabold">BlockCraft – świat wspólny</h2>
            <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-white/50">
              Budowle zapisują się w chmurze (Supabase + Postgres), więc zostają po odświeżeniu i po
              wyjściu. Wchodzisz jednym kliknięciem z dowolnego urządzenia.
            </p>
            <ul className="mt-3 grid gap-1.5 text-[11.5px] text-white/55 sm:grid-cols-2">
              {[
                'wspólny świat bez hosta',
                'zapis w chmurze',
                '/tpa – teleportacja za zgodą',
                'czat i lista graczy',
              ].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="text-emerald-400"><Icon name="check" size={12} /></span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button type="button" onClick={onMultiplayer} className={`${BTN_PRIMARY} px-5 py-2.5`}>
              <Icon name="server" size={14} />
              Dołącz do serwera
            </button>
            <button type="button" onClick={onSolo} className={BTN_GHOST}>
              <Icon name="worlds" size={14} />
              Gram solo
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { n: '1', t: 'Wpisz nick', d: 'Wystarczy nick – konto nie jest potrzebne. Sesja pamięta ekwipunek i pozycję.' },
          { n: '2', t: 'Wybierz skórkę', d: '9 skórek z paczki 26.2. Zmiana działa też w trakcie gry.' },
          { n: '3', t: 'Buduj razem', d: 'Każdy widzi zmiany w czasie rzeczywistym. Zgubiony? /tpa nick.' },
        ].map((s) => (
          <article key={s.n} className={`${PANEL} p-4`}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-[12px] font-black text-emerald-300">{s.n}</div>
            <h3 className="mt-2 text-[13px] font-bold">{s.t}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">{s.d}</p>
          </article>
        ))}
      </section>

      <p className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3 text-[11.5px] leading-relaxed text-amber-100/70">
        <b className="font-bold text-amber-200/90">Uczciwie:</b> launcher uruchamia BlockCraft – własną grę
        w przeglądarce z paczką tekstur 26.2. Nie łączy się z serwerami ani kontem Minecrafta i nie
        pobiera plików Mojanga, bo oryginalny klient (Java) nie działa w przeglądarce.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------- Paczki
function PacksTab({
  settings,
  onChange,
  onLog,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onLog: (text: string, kind?: LogEntry['kind']) => void;
}) {
  const preset = (name: PresetName) => {
    onChange(applyPreset(settings, name));
    onLog(`Preset graficzny: ${PRESETS[name].label}`, 'ok');
  };

  const slider = (label: string, value: number, min: number, max: number, step: number, key: keyof Settings, suffix = '') => (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/45">
        {label}
        <span className="text-white/70">{typeof value === 'number' ? `${Math.round(value * 100) / 100}${suffix}` : ''}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) } as Settings)}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-emerald-400"
      />
    </label>
  );

  const toggle = (label: string, key: keyof Settings, hint?: string) => (
    <button
      type="button"
      onClick={() => onChange({ ...settings, [key]: !settings[key] } as Settings)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-left transition-colors hover:border-white/20"
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold">{label}</span>
        {hint && <span className="block text-[10.5px] text-white/35">{hint}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${settings[key] ? 'bg-emerald-500' : 'bg-white/15'}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings[key] ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">Paczki i mody</h1>
        <p className="text-[12px] text-white/45">Wbudowana paczka 26.2 i ustawienia wydajności – wszystko działa offline.</p>
      </div>

      <section className={`${PANEL} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <BlockCube size={44} spin={false} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-extrabold">26.2.x Template</h2>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">aktywna</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-white/45">
                Tekstury bloków, przedmiotów, mobów, GUI i skórek – wbudowane w build, bez pobierania.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={CHIP}>{officialTileCount()} kafli</span>
            <span className={CHIP}>{officialItemCount()} ikon</span>
            <span className={CHIP}>{Object.keys(MOB_SKINS).length} skórek</span>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5 text-[11.5px] text-white/50 sm:grid-cols-2">
          <div className="flex items-center gap-1.5"><span className="text-emerald-400"><Icon name="check" size={12} /></span> bloki, liście i woda z tintem biomu</div>
          <div className="flex items-center gap-1.5"><span className="text-emerald-400"><Icon name="check" size={12} /></span> modele mobów 1:1 z waniliowej geometrii</div>
          <div className="flex items-center gap-1.5"><span className="text-emerald-400"><Icon name="check" size={12} /></span> ikony przedmiotów i tarcza</div>
          <div className="flex items-center gap-1.5"><span className="text-emerald-400"><Icon name="check" size={12} /></span> serca, głód, hotbar i panele GUI</div>
        </div>
      </section>

      <section className={`${PANEL} p-4`}>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">Wydajność</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => preset(name)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                settings.quality === name
                  ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100'
                  : 'border-white/10 bg-black/25 text-white/65 hover:border-white/25'
              }`}
            >
              <div className="text-[12.5px] font-bold">{PRESETS[name].label}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                {PRESETS[name].renderDistance} chunków · {PRESETS[name].fpsCap === 0 ? 'bez limitu' : `${PRESETS[name].fpsCap} FPS`}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {slider('Odległość renderowania', settings.renderDistance, 2, 12, 1, 'renderDistance', ' ch')}
          {slider('Cząsteczki', settings.particles, 0, 1, 0.05, 'particles')}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {toggle('Chmury', 'clouds', 'wolne chmury jak w grze')}
          {toggle('Dynamiczna rozdzielczość', 'dynamicResolution', 'automatycznie trzyma płynność')}
          {toggle('Kołysanie kamery', 'viewBobbing')}
          {toggle('Minimapa', 'minimap')}
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- Skórki
function SkinsTab({
  skin,
  portrait,
  face,
  name,
  onSkin,
  onName,
  onCommitName,
}: {
  skin: string;
  portrait: string | null;
  face: string | null;
  name: string;
  onSkin: (id: string) => void;
  onName: (name: string) => void;
  onCommitName: () => void;
}) {
  const current = skinById(skin);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">Skórki</h1>
        <p className="text-[12px] text-white/45">9 postaci z paczki 26.2 – ta sama skórka w grze i na serwerze.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className={`${PANEL} flex flex-col items-center gap-3 p-5`}>
          <div className="relative flex h-[180px] w-[120px] items-end justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40">
            {portrait ? (
              <img src={portrait} alt={`Podgląd skórki ${current.name}`} className="h-[168px] w-auto" style={{ imageRendering: 'pixelated' }} />
            ) : (
              <SkinAvatar skin={skin} size={84} />
            )}
          </div>
          <div className="text-center">
            <div className="text-[14px] font-extrabold">{current.name}</div>
            <div className="text-[11px] text-white/40">{current.desc}</div>
          </div>
          <div className="flex w-full items-center gap-2">
            {face && (
              <img src={face} width={28} height={28} alt="" className="rounded border border-white/15" style={{ imageRendering: 'pixelated' }} />
            )}
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              onBlur={onCommitName}
              onKeyDown={(e) => e.key === 'Enter' && onCommitName()}
              maxLength={20}
              placeholder="Nick"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[12.5px] font-semibold outline-none focus:border-emerald-400/50"
            />
          </div>
        </div>

        <div className={`${PANEL} p-4`}>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-white/45">Wybierz postać</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {SKINS.map((s) => {
              const active = s.id === skin;
              const f = skinFace(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSkin(s.id)}
                  aria-pressed={active}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-2.5 transition-colors ${
                    active
                      ? 'border-emerald-400/50 bg-emerald-500/12'
                      : 'border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                >
                  {f ? (
                    <img src={f} width={40} height={40} alt="" className="rounded-md" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <span className="h-10 w-10 rounded-md bg-white/10" />
                  )}
                  <span className="text-[11px] font-semibold">{s.name}</span>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 p-0.5 text-emerald-950">
                      <Icon name="check" size={10} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <SkinPicker value={skin} onChange={onSkin} />
          </div>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- Konsola
function ConsoleTab({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
  const color = (kind: LogEntry['kind']) =>
    kind === 'ok' ? 'text-emerald-300' : kind === 'warn' ? 'text-amber-300' : 'text-sky-300';
  const tag = (kind: LogEntry['kind']) => (kind === 'ok' ? 'OK' : kind === 'warn' ? 'UWAGA' : 'INFO');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Konsola</h1>
          <p className="text-[12px] text-white/45">Dziennik launchera: uruchomienia, paczki, profil i ustawienia.</p>
        </div>
        <button type="button" onClick={onClear} className={BTN_GHOST}>
          <Icon name="trash" size={14} />
          Wyczyść
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/55">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-[10.5px] text-white/35">blockcraft-launcher — log</span>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed">
          {log.length === 0 && <p className="text-white/30">Brak wpisów.</p>}
          {log.map((l) => (
            <div key={l.id} className="flex gap-2">
              <span className="shrink-0 text-white/25">{l.time}</span>
              <span className={`w-[46px] shrink-0 font-bold ${color(l.kind)}`}>[{tag(l.kind)}]</span>
              <span className="min-w-0 break-words text-white/70">{l.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- uruchamianie
function LaunchOverlay({ step, progress, worldName }: { step: number; progress: number; worldName: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className={`${PANEL} w-full max-w-md bg-[#0d1117]/95 p-5`}>
        <div className="flex items-center gap-3">
          <BlockCube size={44} />
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold">Uruchamianie BlockCraft</div>
            <div className="truncate text-[11px] text-white/45">{worldName}</div>
          </div>
          <div className="ml-auto text-[13px] font-black tabular-nums text-emerald-300">{progress}%</div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <ul className="mt-4 space-y-2">
          {LAUNCH_STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-2 text-[11.5px]">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${i < step ? 'bg-emerald-500 text-emerald-950' : i === step ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-white/30'}`}>
                {i < step ? <Icon name="check" size={10} /> : <span className="text-[9px] font-bold">{i + 1}</span>}
              </span>
              <span className={i <= step ? 'text-white/75' : 'text-white/30'}>
                <b className="font-semibold">{s.title}</b> – {s.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
