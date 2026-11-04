/** Real account-owned cloud saves. The opaque token stays in this module's
 * closure, never in React state, save data, logs, exports, URLs or a new store. */
import { ACCOUNT_ORIGIN, ProjectAccount } from './communityAccount';
import { readScopedSaves, replaceScopedSaves, readSaveJournal, writeSaveJournal, SAVES_CHANGED, SAVES_FAILED, setSaveNamespace, type StoredWorld } from './saves';
export const ACCOUNT_DB = 'https://hzbqzfimtroixnldzjeq.supabase.co';
export const ACCOUNT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YnF6ZmltdHJvaXhubGR6amVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTEsImV4cCI6MjEwODE3MjM5MX0.oeZWOaNd6p3wZBZQQu3QWjRHlrkxV_BFQRNSN-6YntE';
const WORLD_GATEWAY = 'https://bewwejewgqzctnjrbclu.supabase.co/functions/v1/mconline-gateway';
export type CloudPhase = 'guest' | 'loading' | 'ready' | 'saving' | 'error' | 'conflict';
export interface CloudState { phase: CloudPhase; owner: string | null; username: string | null; message: string }
export const CLOUD_CHANGED = 'mconline-cloud-changed';
let state: CloudState = { phase: 'guest', owner: null, username: null, message: 'Bez konta: światy tylko na tym urządzeniu. Zaloguj się: zapis w chmurze i multiplayer.' };
let active: AccountWorlds | null = null;
let failedStorageOwner: string | null | undefined;
let notifyLibrary: (() => void) | null = null;
export function cloudState(): CloudState { return state; }
function publish(next: CloudState) { if (failedStorageOwner !== undefined && next.owner === failedStorageOwner) next = { ...next, phase: 'error', message: 'Nie udało się zapisać aktualnego postępu: pamięć przeglądarki jest pełna lub zablokowana. Nie zamykaj gry. Zwolnij miejsce i ponów zapis.' }; state = next; window.dispatchEvent(new Event(CLOUD_CHANGED)); }
export function cloudPlayable() { return state.phase === 'guest' || (state.phase === 'ready' && active !== null); }
export function currentAccountTransport() {
  const session = active;
  if (!session) throw new Error('Zaloguj się, aby grać w trybie wieloosobowym.');
  return { owner: session.owner, username: session.username, request: (op: string, world: string, id: string, args?: unknown) => session.multiplayer(op, world, id, args) };
}
export async function syncCloudNow() { if (active) await active.sync(); }
export async function refreshCloud() { if (active) await active.refresh(); }
export async function resolveCloudConflict() {
  if (!active) return;
  // Caller first downloads the recovery backup; never silently overwrite it.
  const journal = readSaveJournal(active.owner);
  journal.dirty = []; journal.conflicts = []; writeSaveJournal(active.owner, journal);
  await active.refresh();
}
export class AccountWorlds {
  private stopped = false;
  private running: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private again = false;
  constructor(readonly owner: string, readonly username: string, private token: string, private transport: typeof fetch = (input, init) => fetch(input, init)) {}
  updateToken(token: string) { this.token = token; }
  stop() { this.stopped = true; this.token = ''; }
  private emit(phase: CloudPhase, message: string) {
    if (this.stopped) return;
    publish({ phase, owner: this.owner, username: this.username, message });
    notifyLibrary?.();
  }
  private async rpc(op: string, id?: string, expected = 0, data?: StoredWorld) {
    if (this.stopped) throw new Error('Konto zmieniono.');
    const r = await this.transport(`${ACCOUNT_DB}/rest/v1/rpc/mconline_worlds_op`, {
      method: 'POST', cache: 'no-store', headers: { apikey: ACCOUNT_ANON, Authorization: `Bearer ${ACCOUNT_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: this.token, p_op: op, p_id: id ?? null, p_expected: expected, p_data: data ?? null }), signal: AbortSignal.timeout(20000),
    });
    const result = await r.json();
    if (this.stopped) throw new Error('Konto zmieniono.');
    if (!r.ok) {
      const error = new Error(result.code === '40001' ? 'Konflikt wersji. Świat zmieniono na innym urządzeniu.' : result.message || 'Nie można zsynchronizować świata.') as Error & { conflict?: boolean };
      error.conflict = result.code === '40001'; throw error;
    }
    return result;
  }
  async multiplayer(op: string, world: string, session: string, args?: unknown) {
    if (this.stopped || active !== this) throw new Error('Konto zmieniono lub rozłączono.');
    const r = await this.transport(WORLD_GATEWAY, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.token, op, world, session, args }), signal: AbortSignal.timeout(20000) });
    const result = await r.json();
    if (this.stopped || active !== this) throw new Error('Konto zmieniono lub rozłączono.');
    if (!r.ok || result.error) throw new Error(result.error || 'Nie można połączyć się z serwerem kontowym.');
    return result.data;
  }
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refreshOnce().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  private async refreshOnce() {
    // Serialize reconciliation with uploads, including rapid focus/pageshow.
    while (this.running) { await this.running; if (this.stopped) return; }
    this.running = this.reconcile();
    try { await this.running; } finally { this.running = null; }
    await this.sync();
  }
  private async reconcile() {
    this.emit('loading', 'Wczytuję światy przypisane do konta…');
    try {
      const response = await this.rpc('list');
      if (response.identity?.id !== this.owner || !Array.isArray(response.worlds)) throw new Error('Nieprawidłowy właściciel biblioteki.');
      const journal = readSaveJournal(this.owner);
      const local = readScopedSaves(this.owner);
      const remote = response.worlds as { id: string; revision: number; data: StoredWorld }[];
      if (remote.some(w => !w.id.startsWith(`a${this.owner}_`) || w.data?.id !== w.id || typeof w.data.seed !== 'number')) throw new Error('Nieprawidłowy zapis konta.');
      const revisions = new Map(remote.map(w => [w.id, Number(w.revision)]));
      for (const id of journal.dirty) {
        if ((journal.revisions[id] ?? 0) !== (revisions.get(id) ?? 0)) journal.conflicts = [...new Set([...journal.conflicts, id])];
      }
      const dirty = new Set(journal.dirty);
      const merged = [...remote.filter(w => !dirty.has(w.id)).map(w => w.data), ...local.filter(w => dirty.has(w.id))];
      for (const w of remote) if (!dirty.has(w.id)) journal.revisions[w.id] = Number(w.revision);
      // An uploaded deletion can be acknowledged even after the page closed.
      for (const id of Object.keys(journal.revisions)) if (!dirty.has(id) && !revisions.has(id)) delete journal.revisions[id];
      // Never mark recovery data clean before the replacement can be persisted.
      replaceScopedSaves(this.owner, merged); writeSaveJournal(this.owner, journal);
      this.emit(journal.conflicts.length ? 'conflict' : 'ready', journal.conflicts.length ? 'Konflikt z innym urządzeniem. Kopia lokalna jest zachowana; rozwiąż konflikt w menu.' : `Konto ${this.username} · światy w chmurze · multiplayer dostępny`);
    } catch {
      this.emit('error', 'Nie można wczytać biblioteki konta. Kopie lokalne pozostają nienaruszone. Ponów synchronizację.');
    }
  }
  sync(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) { this.again = true; return this.running; }
    this.running = this.upload();
    return this.running.finally(() => {
      this.running = null;
      if (this.again && !this.stopped) { this.again = false; void this.sync(); }
    });
  }
  private async upload() {
    const initial = readSaveJournal(this.owner);
    if (initial.conflicts.length) { this.emit('conflict', 'Konflikt wersji — niczego nie nadpisano w chmurze. Kopia lokalna czeka w menu.'); return; }
    if (!initial.dirty.length) return;
    this.emit('saving', 'Zapisuję światy na koncie… Nie zamykaj gry, dopóki zapis trwa.');
    const localIds = new Set(readScopedSaves(this.owner).map(w => w.id));
    // Apply explicitly requested deletions before puts when the account is full.
    for (const id of [...initial.dirty].sort((a,b) => Number(localIds.has(a))-Number(localIds.has(b)))) {
      if (this.stopped) return;
      const snapshot = readScopedSaves(this.owner).find(w => w.id === id);
      const serialized = JSON.stringify(snapshot);
      const journal = readSaveJournal(this.owner);
      try {
        const result = await this.rpc(snapshot ? 'put' : 'delete', id, journal.revisions[id] ?? 0, snapshot);
        const current = readSaveJournal(this.owner);
        current.revisions[id] = Number(result.revision);
        if (JSON.stringify(readScopedSaves(this.owner).find(w => w.id === id)) === serialized) current.dirty = current.dirty.filter(key => key !== id);
        else this.again = true;
        writeSaveJournal(this.owner, current);
      } catch (error) {
        if (this.stopped) return;
        if ((error as { conflict?: boolean }).conflict) {
          const current = readSaveJournal(this.owner); current.conflicts = [...new Set([...current.conflicts, id])]; writeSaveJournal(this.owner, current);
          this.emit('conflict', 'Świat zmieniono na innym urządzeniu. Niczego nie nadpisano; zachowano kopię lokalną.');
        } else this.emit('error', 'Brak potwierdzenia zapisu w chmurze (sieć, sesja lub limit: 8 światów, 8 MiB/świat, 32 MiB/konto). Postęp jest w kopii lokalnej. Ponów zapis.');
        return;
      }
    }
    this.emit('ready', `Zapisano na koncie ${this.username}. Możesz kontynuować na innym urządzeniu.`);
  }
}
/** One coordinator per app, not per account dialog. Stops old sessions before
 * binding a new namespace. React receives a UUID/display name, never the token. */
export function startAccountWorlds(changedOwner: () => void, libraryChanged: () => void): () => void {
  let disposed = false, sequence = 0, controller: ProjectAccount;
  notifyLibrary = libraryChanged;
  const clear = () => {
    if (active) { active.stop(); active = null; changedOwner(); } setSaveNamespace(null);
  };
  const start = () => {
    controller = new ProjectAccount(window, account => {
      if (disposed) return;
      if (account.view === 'checking' || account.view === 'opening') { if (!active) publish({ phase: 'loading', owner: null, username: null, message: 'Sprawdzam konto i bibliotekę światów…' }); return; }
      if (account.view !== 'connected') {
        ++sequence; clear();
        publish({ phase: 'guest', owner: null, username: null, message: 'Bez konta: światy tylko na tym urządzeniu. Zaloguj się: chmura na wielu urządzeniach i multiplayer.' }); libraryChanged(); return;
      }
      const current = ++sequence;
      void (async () => {
        try {
          const provider = await window.RejsonAccount?.getSession();
          if (disposed || current !== sequence) return;
          if (!provider?.token || window.location.origin !== ACCOUNT_ORIGIN) throw new Error('Brak sesji.');
          const result = await fetch(`${ACCOUNT_DB}/rest/v1/rpc/mconline_identity`, { method: 'POST', cache: 'no-store', headers: { apikey: ACCOUNT_ANON, Authorization: `Bearer ${ACCOUNT_ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: provider.token }), signal: AbortSignal.timeout(12000) });
          const identity = await result.json();
          if (disposed || current !== sequence) return;
          if (!result.ok || !/^[a-f0-9-]{36}$/.test(identity.id) || typeof identity.username !== 'string') throw new Error('Brak autoryzacji.');
          // Rechecking an unchanged account must not evict a running game.
          if (active && active.owner === identity.id) { active.updateToken(provider.token); if (!document.querySelector('canvas')) await active.refresh(); return; }
          changedOwner(); clear();
          active = new AccountWorlds(identity.id, identity.username, provider.token);
          setSaveNamespace(identity.id); libraryChanged(); await active.refresh();
        } catch {
          if (disposed || current !== sequence) return;
          clear(); publish({ phase: 'error', owner: null, username: null, message: 'Nie można potwierdzić dostępu do światów konta. Spróbuj ponownie w panelu konta.' }); libraryChanged();
        }
      })();
    });
    controller.start();
  };
  const policy = () => { ++sequence; controller.dispose(); clear(); start(); };
  const dirty = (event: Event) => {
    const owner = (event as CustomEvent).detail?.owner;
    if (owner === failedStorageOwner) failedStorageOwner = undefined;
    if (owner === active?.owner) void active?.sync();
    else if (!active && owner === null) publish({ phase: 'guest', owner: null, username: null, message: 'Zapisano lokalnie. Zaloguj się, aby mieć światy w chmurze i multiplayer.' });
  };
  const failed = (event: Event) => {
    const owner = (event as CustomEvent).detail?.owner;
    if (owner !== (active?.owner ?? null)) return;
    failedStorageOwner = owner; publish({ ...state, owner, phase: 'error' });
  };
  const sessionChanging = (event: Event) => {
    if (event.type === 'storage' && ![null, 'rejson_community_session_v1'].includes((event as StorageEvent).key)) return;
    ++sequence; clear(); publish({ phase: 'loading', owner: null, username: null, message: 'Zmiana konta — potwierdzam nową sesję…' }); libraryChanged();
  };
  window.addEventListener('rj:session-change', sessionChanging, true);
  window.addEventListener('storage', sessionChanging, true);
  window.addEventListener('mconline-account-policy', policy);
  window.addEventListener(SAVES_CHANGED, dirty);
  window.addEventListener(SAVES_FAILED, failed);
  const timer = window.setInterval(() => { if (active && state.phase === 'error') void active.refresh(); }, 20000);
  start();
  return () => { disposed = true; ++sequence; controller.dispose(); clearInterval(timer); window.removeEventListener('rj:session-change', sessionChanging, true); window.removeEventListener('storage', sessionChanging, true); window.removeEventListener('mconline-account-policy', policy); window.removeEventListener(SAVES_CHANGED, dirty); window.removeEventListener(SAVES_FAILED, failed); active?.stop(); active = null; notifyLibrary = null; };
}
