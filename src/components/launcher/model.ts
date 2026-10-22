/**
 * 2.24: model danych launchera BlockCraft.
 *
 * Launcher jest powłoką nad grą (tak jak Lunar Client czy Prism nad
 * Minecraftem): trzyma profil gracza, listę światów-instancji, wybrane
 * ustawienia i dziennik zdarzeń, a po kliknięciu „GRAJ” uruchamia grę.
 *
 * Wszystko jest lokalne (localStorage) i działa w przeglądarce – bez konta
 * i bez instalacji. Nic nie pobiera plików Mojanga: gra korzysta wyłącznie
 * z wbudowanej paczki `26.2.x-Template`.
 */

import { GAME_RELEASE_NAME, GAME_VERSION, MINECRAFT_TARGET, RELEASE_HIGHLIGHTS } from '../../utils/version';

export type LauncherTab = 'home' | 'worlds' | 'servers' | 'packs' | 'skins' | 'settings' | 'console';

export const LAUNCHER_TABS: { id: LauncherTab; label: string; short: string; hint: string }[] = [
  { id: 'home', label: 'Start', short: 'Start', hint: 'Wiadomości i szybkie uruchomienie' },
  { id: 'worlds', label: 'Światy', short: 'Światy', hint: 'Instancje, seed i tryb gry' },
  { id: 'servers', label: 'Serwery', short: 'Serwery', hint: 'Publiczny świat i gra ze znajomymi' },
  { id: 'packs', label: 'Paczki i mody', short: 'Paczki', hint: 'Tekstury, wydajność, cząsteczki' },
  { id: 'skins', label: 'Skórki', short: 'Skórki', hint: 'Wygląd postaci z paczki' },
  { id: 'settings', label: 'Ustawienia', short: 'Opcje', hint: 'Grafika, sterowanie, dźwięk' },
  { id: 'console', label: 'Konsola', short: 'Konsola', hint: 'Dziennik launchera' },
];

const PROFILE_KEY = 'blockcraft-launcher-v1';
const NICK_KEY = 'blockcraft-nick';

export interface LauncherProfile {
  /** Nick widoczny w launcherze (ten sam co w grze i w multi). */
  name: string;
  /** Id skórki z paczki (`skins.ts`). */
  skin: string;
  /** Ostatnio uruchomiony świat – „GRAJ” wraca do niego. */
  lastWorldId: string | null;
  /** Zakładka otwierana po starcie launchera. */
  tab: LauncherTab;
  /** Ile razy gra została uruchomiona z launchera. */
  launches: number;
  /** Czas ostatniego uruchomienia (ms) albo null. */
  lastLaunch: number | null;
}

export const DEFAULT_PROFILE: LauncherProfile = {
  name: 'Gracz',
  skin: 'steve',
  lastWorldId: null,
  tab: 'home',
  launches: 0,
  lastLaunch: null,
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* tryb prywatny – profil zostaje tylko do końca sesji */
  }
}

/** Profil z localStorage; nieznane pola uzupełniamy domyślnymi. */
export function loadLauncherProfile(): LauncherProfile {
  let raw: Partial<LauncherProfile> = {};
  try {
    raw = JSON.parse(safeGet(PROFILE_KEY) || '{}') as Partial<LauncherProfile>;
  } catch {
    raw = {};
  }
  const nick = safeGet(NICK_KEY);
  const name = (raw.name || nick || DEFAULT_PROFILE.name).trim().slice(0, 20) || DEFAULT_PROFILE.name;
  const tab = LAUNCHER_TABS.some((t) => t.id === raw.tab) ? (raw.tab as LauncherTab) : DEFAULT_PROFILE.tab;
  return {
    ...DEFAULT_PROFILE,
    ...raw,
    name,
    tab,
    launches: Number.isFinite(raw.launches) ? Number(raw.launches) : 0,
    lastLaunch: typeof raw.lastLaunch === 'number' ? raw.lastLaunch : null,
  };
}

export function saveLauncherProfile(profile: LauncherProfile) {
  safeSet(PROFILE_KEY, JSON.stringify(profile));
  safeSet(NICK_KEY, profile.name);
}

/** Dziennik launchera – krótkie, czytelne komunikaty jak w konsoli klienta. */
export interface LogEntry {
  id: number;
  time: string;
  kind: 'info' | 'ok' | 'warn';
  text: string;
}

let logId = 1;

export function logEntry(text: string, kind: LogEntry['kind'] = 'info'): LogEntry {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { id: logId++, time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, kind, text };
}

/** Etapy uruchamiania – prawdziwa kolejność pracy silnika (atlas → świat → scena). */
export const LAUNCH_STEPS: { title: string; detail: string; ms: number; progress: number }[] = [
  { title: 'Sprawdzanie plików', detail: 'Paczka 26.2.x Template, wbudowana w grę', ms: 260, progress: 22 },
  { title: 'Składanie atlasu', detail: '168 kafelków bloków, 100 ikon, 25 skórek mobów', ms: 240, progress: 54 },
  { title: 'Przygotowanie świata', detail: 'Bloki, biomy, wioski i moby', ms: 300, progress: 82 },
  { title: 'Uruchamianie sceny', detail: 'Sterowanie, HUD i dźwięk', ms: 220, progress: 100 },
];

export interface NewsItem {
  tag: string;
  title: string;
  text: string;
  accent: string;
}

/** Wiadomości w launcherze = najnowsze wpisy z historii wydań. */
export function launcherNews(limit = 4): NewsItem[] {
  const accents = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];
  return RELEASE_HIGHLIGHTS.slice(0, limit).map((h, i) => ({
    tag: i === 0 ? `Wersja ${GAME_VERSION}` : 'Aktualizacja',
    title: h.title,
    text: h.text,
    accent: accents[i % accents.length],
  }));
}

/** Krótka pieczątka wersji pokazywana w nagłówku. */
export const VERSION_LABEL = `${GAME_VERSION} „${GAME_RELEASE_NAME}”`;
export const TARGET_LABEL = MINECRAFT_TARGET;

/** Ile czasu minęło – „przed chwilą”, „2 godziny temu”, „3 dni temu”. */
export function sinceLabel(ms: number | null | undefined): string {
  if (!ms) return 'jeszcze nie uruchamiano';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'przed chwilą';
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min} ${min === 1 ? 'minutę' : min < 5 ? 'minuty' : 'minut'} temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'godzinę' : h < 5 ? 'godziny' : 'godzin'} temu`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'dzień' : 'dni'} temu`;
}

/** Krótki opis świata: tryb + typ + seed. */
export function worldMeta(world: { mode?: string; worldType?: string; seed?: number; day?: number }): string {
  const mode = world.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie';
  const type = world.worldType === 'flat' ? 'płaski' : 'normalny';
  const seed = typeof world.seed === 'number' ? `seed ${world.seed}` : 'losowy seed';
  const day = typeof world.day === 'number' ? `dzień ${world.day}` : 'nowy';
  return `${mode} · ${type} · ${seed} · ${day}`;
}
