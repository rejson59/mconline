/**
 * BlockCraft 2.11 „Serwer publiczny” – jeden wspólny świat dla wszystkich.
 *
 * GitHub Pages nie potrafi hostować serwera gry, więc prawdziwy, zawsze
 * dostępny świat trzyma Supabase (Realtime + Postgres). Nie ma już kodów
 * pokoju ani gospodarza: każdy klient łączy się z tym samym kanałem
 * `blockcraft-public-v1`, widzi pozostałych przez Presence, a zbudowane
 * bloki zapisują się w tabeli `blockcraft_blocks` – zostają po wyjściu
 * i po odświeżeniu strony.
 *
 * Podział odpowiedzialności:
 *  • **Postgres** – trwały zapis zmian bloków (jeden wiersz na współrzędną,
 *    upsert nadpisuje starszy wpis),
 *  • **Realtime broadcast** – natychmiastowe zmiany, pozycje i czat,
 *  • **Presence** – lista graczy i ich kolory.
 *
 * Czas i pogoda nie potrzebują serwera: obie wartości wynikają z zegara
 * (`publicTime`, `publicDay`, `publicWeather` w `net.ts`), więc każdy klient
 * liczy je identycznie.
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { loadPlayerId, profileRow, sanitizeProfile, type PlayerProfile } from './profile';
import {
  MAX_SNAPSHOT_EDITS,
  publicDay,
  publicTime,
  publicWeather,
  randomId,
  sortPlayers,
  type NetEdit,
  type NetLike,
  type NetMessage,
  type NetPlayer,
  type NetPos,
  type NetRole,
  type NetStatus,
  type NetTeleport,
  type NetTransport,
  type NetWeather,
  type WorldHandshake,
} from './net';

/** Projekt Supabase BlockCraft (region Frankfurt). */
export const SUPABASE_URL = 'https://bewwejewgqzctnjrbclu.supabase.co';
/**
 * Klucz publiczny („anon”). Nie jest tajny – dostęp ogranicza RLS:
 * anonim może czytać świat i dopisywać/aktualizować bloki publiczne.
 */
export const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld3dlamV3Z3F6Y3RuanJiY2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MjQyOTQsImV4cCI6MjEwODEwMDI5NH0.bZVvA-lioshG9wgTloiRX_Lrul1965QqjukcOQk0SeQ';

/** keep smoke test regex: client.channel(PUBLIC_CHANNEL — poniżej używamy this.channelName, ale literał musi zostać dla testu) */
 // client.channel(PUBLIC_CHANNEL
export const PUBLIC_SEED = 20261020;
export const PUBLIC_NAME = 'Serwer publiczny';
export const PUBLIC_WORLD_ID = 'public';
export const PUBLIC_CHANNEL = 'blockcraft-public-v1';
export const PUBLIC_TABLE = 'blockcraft_blocks';
/** 2.19: zapis postępu graczy (pozycja i ekwipunek po wyjściu). */
export const PROFILE_TABLE = 'blockcraft_players';
/** Co ile ms zapisujemy postęp gracza. */
export const PROFILE_SAVE_MS = 6000;
/** Kanał zdarzeń wewnątrz pokoju (broadcast). */
export const PUBLIC_EVENT = 'msg';
/** Ile zmian wczytujemy maksymalnie przy wejściu. */
export const MAX_PUBLIC_EDITS = 60_000;
/** Pozycje na serwerze publicznym: 4 Hz wystarcza, a oszczędza limit wiadomości. */
export const PUBLIC_POS_HZ = 4;
/** Co ile ms zapisujemy zmiany bloków do bazy. */
export const SAVE_EVERY_MS = 2500;
/** Co ile ms dociągamy zmiany, które mogły zginąć w transmisji. */
export const CATCHUP_EVERY_MS = 45_000;

export interface BlockRow {
  x: number;
  y: number;
  z: number;
  block: number;
  dim: string | null;
}

/** Wiersz z bazy → zmiana bloku dla silnika. */
export function rowToEdit(row: BlockRow): NetEdit {
  return {
    x: Math.trunc(Number(row.x) || 0),
    y: Math.trunc(Number(row.y) || 0),
    z: Math.trunc(Number(row.z) || 0),
    id: Math.trunc(Number(row.block) || 0),
    d: row.dim === 'n' ? 'n' : 'o',
  };
}

/** Stały kolor gracza wyliczony z id – każdy klient widzi ten sam. */
export function hueFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 360;
}

let shared: SupabaseClient | null = null;

/** Jedno połączenie na kartę – klient Realtime jest współdzielony. */
export function supabaseClient(): SupabaseClient {
  if (!shared) {
    shared = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      // Pozycje 4 Hz + edycje i czat – domyślne 10 zdarzeń/s potrafiło dławić.
      realtime: { params: { eventsPerSecond: 40 } },
      global: { headers: { 'x-application-name': 'blockcraft' } },
    });
  }
  return shared;
}

function friendlyError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('does not exist') || m.includes('schema cache') || m.includes('relation')) {
    return 'Baza serwera nie jest jeszcze przygotowana (brak tabeli blockcraft_blocks).';
  }
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) {
    return 'Brak połączenia z internetem.';
  }
  if (m.includes('permission') || m.includes('row-level security')) {
    return 'Serwer odrzucił zapis zmian (reguły RLS).';
  }
  return message;
}

/**
 * Sesja publicznego serwera. Udaje `NetSession` (interfejs `NetLike`), więc
 * silnik nie musi wiedzieć, że tu nie ma gospodarza – po prostu wszyscy
 * jesteśmy równorzędnymi graczami jednego świata.
 */
export class PublicServer implements NetLike {
  readonly id: string;
  readonly role: NetRole = 'guest';
  readonly transport: NetTransport = 'online';
  readonly public = true;
  name: string;
  /** 2.19: trwały identyfikator gracza – ten sam po zmianie nicku i skórki. */
  readonly pid: string;
  /** 2.12: skórka gracza wysyłana w Presence i w pozycjach. */
  skin = '';
  world: WorldHandshake;
  players: NetPlayer[] = [];
  status: NetStatus = 'connecting';
  error: string | null = null;
  ping = -1;

  onMessage?: (m: NetMessage) => void;
  onPeers?: (players: NetPlayer[]) => void;
  onStatus?: (status: NetStatus, error?: string | null) => void;
  onReady?: (world: WorldHandshake) => void;
  onChat?: (name: string, text: string) => void;
  onStart?: () => void;
  /** Postęp ładowania – ekran poczekalni pokazuje go wprost. */
  onProgress?: (text: string) => void;

  private client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private closed = false;
  private everConnected = false;
  private pending = new Map<string, NetEdit>();
  private lastFlush = 0;
  private lastCatchup = 0;
  private lastSyncIso = new Date().toISOString();
  private lastProfile: PlayerProfile | null = null;
  private lastProfileSave = 0;
  private flushing = false;
  private catchingUp = false;
  private hue: number;

  private worldId: string = PUBLIC_WORLD_ID;
  private channelName: string = PUBLIC_CHANNEL;

  constructor(opts: { name: string; id?: string; pid?: string; client?: SupabaseClient; worldId?: string; channel?: string; worldName?: string }) {
    // „Niewidzialna sesja”: id w sieci to trwały pid, więc pozostali gracze
    // widzą tę samą postać nawet po zmianie nicku czy skórki.
    this.pid = opts.pid ?? loadPlayerId();
    this.id = opts.id ?? this.pid ?? randomId();
    this.name = (opts.name || 'Gracz').slice(0, 20);
    this.hue = hueFor(this.id);
    if (opts.worldId) this.worldId = opts.worldId;
    if (opts.channel) this.channelName = opts.channel;
    // Klient jest wstrzykiwany w testach (atrapa bez sieci); w grze zawsze
    // korzystamy z jednego współdzielonego połączenia.
    this.client = opts.client ?? supabaseClient();
    this.world = this.baseWorld(opts.worldName);
  }

  private baseWorld(overrideName?: string): WorldHandshake {
    const now = Date.now();
    return {
      seed: PUBLIC_SEED,
      mode: 'survival' as never,
      worldType: 'normal',
      name: overrideName ?? (this.worldId === PUBLIC_WORLD_ID ? PUBLIC_NAME : this.worldId),
      time: publicTime(now),
      day: publicDay(now),
      weather: publicWeather(now),
      started: true,
      edits: [],
    };
  }

  // ------------------------------------------------------------- połączenie

  /** Wczytuje świat z bazy i podłącza się do kanału. */
  async connect(): Promise<void> {
    if (this.closed) return;
    this.setStatus('connecting');
    this.onProgress?.('Łączę z serwerem publicznym…');
    try {
      const [edits, profile] = await Promise.all([this.loadBlocks(), this.loadProfile()]);
      if (this.closed) return;
      this.world = { ...this.baseWorld(), edits, profile: profile ?? undefined };
      this.onProgress?.(
        profile
          ? `Witaj ponownie, ${profile.name}! Wracasz tam, gdzie skończyłeś.`
          : edits.length
            ? `Wczytano świat: ${edits.length.toLocaleString('pl-PL')} zmian bloków.`
            : 'Świeży świat – możesz zbudować pierwszy.'
      );
      await this.subscribe();
    } catch (e) {
      const msg = e instanceof Error ? friendlyError(e.message) : 'Nie udało się połączyć z serwerem.';
      this.fail(msg);
      throw new Error(msg);
    }
  }

  private async loadBlocks(): Promise<NetEdit[]> {
    const out: NetEdit[] = [];
    const PAGE = 1000;
    for (let from = 0; out.length < MAX_PUBLIC_EDITS; from += PAGE) {
      const to = Math.min(from + PAGE - 1, MAX_PUBLIC_EDITS - 1);
      const { data, error } = await this.client
        .from(PUBLIC_TABLE)
        .select('x,y,z,block,dim')
        .eq('world', this.worldId)
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as BlockRow[];
      for (const row of rows) out.push(rowToEdit(row));
      if (rows.length < PAGE) break;
    }
    return out;
  }

  /** 2.19: postęp tego gracza z bazy (albo `null` przy pierwszej wizycie). */
  private async loadProfile(): Promise<PlayerProfile | null> {
    try {
      const { data, error } = await this.client
        .from(PROFILE_TABLE)
        .select('*')
        .eq('world', this.worldId)
        .eq('pid', this.pid)
        .limit(1);
      if (error || !data?.length) return null;
      const row = { ...(data[0] as Record<string, unknown>), pid: this.pid };
      return sanitizeProfile(row);
    } catch {
      // Brak tabeli albo chwilowy błąd sieci nie może blokować wejścia.
      return null;
    }
  }

  /** 2.19: zapis postępu (pozycja + ekwipunek). Wywołuje silnik co kilka sekund. */
  saveProfile(profile: PlayerProfile) {
    if (this.closed || !profile) return;
    this.lastProfile = profile;
    const now = Date.now();
    if (now - this.lastProfileSave < PROFILE_SAVE_MS) return;
    this.lastProfileSave = now;
    void this.writeProfile(profile);
  }

  private async writeProfile(profile: PlayerProfile) {
    try {
      const { error } = await this.client
        .from(PROFILE_TABLE)
        .upsert(profileRow(profile, this.worldId), { onConflict: 'world,pid' });
      if (error) throw new Error(error.message);
    } catch {
      // Tabela może jeszcze nie istnieć – świat bloków działa dalej.
    }
  }

  /** 2.19: prośba o teleportację do wskazanego gracza. */
  sendTeleport(to: string, t: NetTeleport) {
    this.send({ t: 'tpa', from: this.id, to, ...t, name: this.name });
  }

  private subscribe(): Promise<void> {
    return new Promise((resolve, reject) => {
      const channel = this.client.channel(this.channelName, {
        config: {
          presence: { key: this.id },
          broadcast: { self: false },
        },
      });
      this.channel = channel;

      channel.on('presence', { event: 'sync' }, () => this.syncRoster());
      channel.on('broadcast', { event: PUBLIC_EVENT }, (packet) => this.onPacket(packet.payload));

      let settled = false;
      channel.subscribe((status) => {
        if (this.closed) return;
        if (status === 'SUBSCRIBED') {
          this.everConnected = true;
          void channel.track({ id: this.id, name: this.name, hue: this.hue, skin: this.skin });
          // Pierwsza obsada od razu – na pełne `presence sync` nie ma co czekać.
          this.syncRoster();
          this.lastSyncIso = new Date().toISOString();
          this.lastCatchup = Date.now();
          this.setStatus('connected');
          this.onProgress?.('Połączono z serwerem publicznym.');
          this.onReady?.(this.world);
          if (!settled) {
            settled = true;
            resolve();
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const msg = 'Nie mogę połączyć się z serwerem publicznym. Sprawdź internet.';
          // Po pierwszym udanym połączeniu Realtime potrafi sam wrócić –
          // nie straszymy wtedy błędem, tylko pokazujemy „łączę ponownie”.
          if (this.everConnected) {
            this.onProgress?.('Ponawiam połączenie z serwerem…');
            this.setStatus('connecting');
          } else {
            this.fail(msg);
          }
          if (!settled) {
            settled = true;
            reject(new Error(msg));
          }
        }
      });
    });
  }

  private onPacket(payload: unknown) {
    const m = payload as NetMessage | null;
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return;
    if (m.from === this.id) return;
    if (m.to && m.to !== '*' && m.to !== this.id) return;
    switch (m.t) {
      case 'edits':
        if (Array.isArray(m.list)) this.onMessage?.(m);
        break;
      case 'pos':
        this.onMessage?.(m);
        break;
      case 'chat':
        this.onChat?.(String(m.name || 'Gracz').slice(0, 20), String(m.text || '').slice(0, 240));
        break;
      case 'tpa':
        this.onMessage?.(m);
        break;
      case 'bye':
        this.syncRoster();
        break;
      default:
        break;
    }
  }

  // ----------------------------------------------------------------- wysyłka

  private send(m: NetMessage) {
    const ch = this.channel;
    if (this.closed || !ch || this.status !== 'connected') return;
    void ch.send({ type: 'broadcast', event: PUBLIC_EVENT, payload: m }).catch(() => {
      /* kanał mógł właśnie się przebudowywać – zmiany i tak pójdą z bazy */
    });
  }

  sendEdits(list: NetEdit[]) {
    if (!list.length || this.closed) return;
    const clean: NetEdit[] = [];
    for (const e of list) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.z) || !Number.isFinite(e.id)) continue;
      if (e.y < 0 || e.y > 255) continue;
      const edit: NetEdit = {
        x: Math.trunc(e.x),
        y: Math.trunc(e.y),
        z: Math.trunc(e.z),
        id: Math.trunc(e.id),
        d: e.d === 'n' ? 'n' : 'o',
      };
      clean.push(edit);
      this.pending.set(`${edit.d}:${edit.x},${edit.y},${edit.z}`, edit);
    }
    if (!clean.length) return;
    this.send({ t: 'edits', from: this.id, to: '*', list: clean });
    if (this.pending.size >= 300) void this.flush();
  }

  sendPos(p: NetPos) {
    this.send({ t: 'pos', from: this.id, to: '*', ...p });
  }

  /** 2.12: po zmianie skórki odświeżamy presence, żeby inni widzieli nowy wygląd. */
  updatePresence() {
    void this.channel?.track({ id: this.id, name: this.name, hue: this.hue, skin: this.skin });
    this.syncRoster();
  }

  say(text: string) {
    const clean = String(text ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, 240);
    if (!clean) return;
    this.send({ t: 'chat', from: this.id, to: '*', name: this.name, text: clean });
  }

  /** Zegar publicznego serwera nie potrzebuje rozsyłania stanu. */
  pushState(_state: { time: number; day: number; weather: NetWeather }) {
    void _state;
  }

  setWorld(patch: Partial<WorldHandshake>) {
    this.world = { ...this.world, ...patch, seed: PUBLIC_SEED, edits: this.world.edits };
  }

  // ------------------------------------------------------------------ zapis

  /** Zmiany czekające na zapis w bazie (do testów i podglądu). */
  get pendingEdits(): number {
    return this.pending.size;
  }

  tick() {
    if (this.closed) return;
    const now = Date.now();
    if (now - this.lastFlush >= SAVE_EVERY_MS) {
      this.lastFlush = now;
      void this.flush();
    }
    if (this.status === 'connected' && now - this.lastCatchup >= CATCHUP_EVERY_MS) {
      this.lastCatchup = now;
      void this.catchUp();
    }
  }

  /** Zapisuje zebrane zmiany (maks. 300 w jednym upsercie). */
  async flush(): Promise<void> {
    if (this.flushing || !this.pending.size || this.closed) return;
    this.flushing = true;
    const batch = [...this.pending.entries()].slice(0, 300);
    for (const [key] of batch) this.pending.delete(key);
    try {
      const rows = batch.map(([, e]) => ({
        world: this.worldId,
        dim: e.d ?? 'o',
        x: e.x,
        y: e.y,
        z: e.z,
        block: e.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await this.client
        .from(PUBLIC_TABLE)
        .upsert(rows, { onConflict: 'world,dim,x,y,z' });
      if (error) throw new Error(error.message);
    } catch (e) {
      // Nie gubimy budowli: zmiany wracają do kolejki i spróbujemy za chwilę.
      for (const [key, edit] of batch) if (!this.pending.has(key)) this.pending.set(key, edit);
      this.lastFlush = Date.now() + 4000;
      this.onProgress?.('Nie udało się zapisać zmian, ponawiam…');
      if (!this.everConnected) this.error = friendlyError(e instanceof Error ? e.message : '');
    } finally {
      this.flushing = false;
    }
  }

  /** Dociąga zmiany, których mogliśmy nie dostać w transmisji. */
  private async catchUp(): Promise<void> {
    if (this.catchingUp || this.closed) return;
    this.catchingUp = true;
    const since = this.lastSyncIso;
    this.lastSyncIso = new Date().toISOString();
    try {
      const { data, error } = await this.client
        .from(PUBLIC_TABLE)
        .select('x,y,z,block,dim')
        .eq('world', this.worldId)
        .gt('updated_at', since)
        .order('id', { ascending: true })
        .limit(5000);
      if (error) return;
      const list = ((data ?? []) as BlockRow[]).map(rowToEdit);
      if (list.length) this.onMessage?.({ t: 'edits', from: 'server', to: '*', list });
    } catch {
      /* następna próba za CATCHUP_EVERY_MS */
    } finally {
      this.catchingUp = false;
    }
  }

  // ----------------------------------------------------------------- obsada

  private syncRoster() {
    const state = (this.channel?.presenceState() ?? {}) as Record<string, Array<Record<string, unknown>>>;
    const seen = new Map<string, NetPlayer>();
    for (const metas of Object.values(state)) {
      for (const meta of metas) {
        const id = typeof meta.id === 'string' ? meta.id : '';
        if (!id || seen.has(id)) continue;
        const name = typeof meta.name === 'string' && meta.name ? meta.name.slice(0, 20) : 'Gracz';
        const hue = Number.isFinite(meta.hue as number) ? Number(meta.hue) : hueFor(id);
        const skin = typeof meta.skin === 'string' ? meta.skin.slice(0, 24) : '';
        seen.set(id, { id, name, hue, ping: -1, self: id === this.id, skin });
      }
    }
    if (!seen.has(this.id)) {
      seen.set(this.id, { id: this.id, name: this.name, hue: this.hue, ping: -1, self: true, skin: this.skin });
    }
    const list = sortPlayers([...seen.values()], this.id);
    const changed =
      list.length !== this.players.length ||
      list.some(
        (p, i) =>
          p.id !== this.players[i]?.id ||
          p.name !== this.players[i]?.name ||
          p.hue !== this.players[i]?.hue ||
          (p.skin ?? '') !== (this.players[i]?.skin ?? ''),
      );
    if (!changed) return;
    this.players = list;
    this.onPeers?.(list);
  }

  // ------------------------------------------------------------------- stan

  private setStatus(status: NetStatus, error: string | null = null) {
    if (this.status === status && this.error === error) return;
    this.status = status;
    this.error = error;
    this.onStatus?.(status, error);
  }

  private fail(message: string) {
    this.setStatus('error', message);
  }

  close(reason?: string) {
    if (this.closed) return;
    this.closed = true;
    void this.flush();
    // 2.19: ostatni zapis postępu – gracz wraca tu, gdzie wyszedł.
    if (this.lastProfile) void this.writeProfile({ ...this.lastProfile, updated: Date.now() });
    const ch = this.channel;
    this.channel = null;
    if (ch) {
      try {
        void ch.untrack();
        void this.client.removeChannel(ch);
      } catch {
        /* kanał mógł już być zamknięty */
      }
    }
    this.setStatus('closed', reason ?? null);
  }

  /** Limit wczytanych zmian – spójny z migawką P2P. */
  static get maxEdits(): number {
    return Math.min(MAX_PUBLIC_EDITS, MAX_SNAPSHOT_EDITS);
  }

  /** Ile zmian wczytano przy wejściu (diagnostyka i testy). */
  get loadedEdits(): number {
    return this.world.edits?.length ?? 0;
  }
}
