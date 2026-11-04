/** General rejson59.github.io account bridge. Historical filename is intentional.
 * No credentials, RPC transport, token persistence or game-data authorization here.
 */
export const ACCOUNT_ORIGIN = 'https://rejson59.github.io';
export const ACCOUNT_PENDING_KEY = 'mconline-account-pending-v1';
export const ACCOUNT_CONNECTED_KEY = 'mconline-account-connected-v1';
export const ACCOUNT_DISCONNECTED_KEY = 'mconline-account-disconnected-v1';
const RETURN_MAX_AGE = 30 * 60 * 1000;
const disconnectedDocuments = new WeakSet<Window>();
export type AccountIdentity = { username: string };
export interface RejsonAccountBridge {
  getSession(): Promise<{ username: string; token?: string } | null>;
  open(): void;
  subscribe(callback: () => void): () => void;
}
declare global { interface Window { RejsonAccount?: RejsonAccountBridge } }
export type AccountView = 'checking' | 'guest' | 'connected' | 'unavailable' | 'unsupported' | 'opening';
export interface AccountState { view: AccountView; identity: AccountIdentity | null; message: string }
export function accountOriginSupported(origin: string): boolean { return origin === ACCOUNT_ORIGIN; }
export function pendingAccountReturn(storage: Pick<Storage, 'getItem'>, now = Date.now()): boolean {
  try {
    const timestamp = Number(storage.getItem(ACCOUNT_PENDING_KEY));
    return timestamp > 0 && now >= timestamp && now - timestamp < RETURN_MAX_AGE;
  } catch { return false; }
}
export function shouldOpenAccountOnReturn(win: Window): boolean {
  try { return accountOriginSupported(win.location.origin) && pendingAccountReturn(win.sessionStorage); }
  catch { return false; }
}
function bridgeReady(win: Window, signal: AbortSignal): Promise<RejsonAccountBridge> {
  return new Promise((resolve, reject) => {
    const valid = () => {
      const api = win.RejsonAccount;
      return api && typeof api.getSession === 'function' && typeof api.open === 'function' && typeof api.subscribe === 'function' ? api : null;
    };
    const finish = (error?: Error) => {
      win.clearTimeout(timer); win.removeEventListener('rj:account-ready', ready);
      win.removeEventListener('rj:account-error', failed); signal.removeEventListener('abort', aborted);
      const api = valid();
      if (error) reject(error); else if (api) resolve(api); else reject(new Error('Account bridge unavailable'));
    };
    const ready = () => { if (valid()) finish(); };
    const failed = () => finish(new Error('Account bridge unavailable'));
    const aborted = () => finish(new Error('Aborted'));
    const timer = win.setTimeout(failed, 8000);
    win.addEventListener('rj:account-ready', ready); win.addEventListener('rj:account-error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else if (valid()) finish();
  });
}
function checkedSession(win: Window, api: RejsonAccountBridge, signal: AbortSignal): Promise<AccountIdentity | null> {
  return new Promise((resolve, reject) => {
    const done = (error: Error | null, identity: AccountIdentity | null = null) => {
      win.clearTimeout(timer); signal.removeEventListener('abort', aborted);
      if (error) reject(error); else resolve(identity);
    };
    const aborted = () => done(new Error('Aborted'));
    const timer = win.setTimeout(() => done(new Error('Account check timed out')), 12000);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) { aborted(); return; }
    Promise.resolve().then(() => api.getSession()).then(session => {
      if (session === null) { done(null); return; }
      if (!session || typeof session.username !== 'string' || !session.username.trim()) { done(new Error('Invalid identity')); return; }
      // Deliberately strip the provider token: this project has no account-bound RPC.
      done(null, { username: session.username });
    }, () => done(new Error('Account unavailable')));
  });
}
/** Controller holds only a verified display identity, never a shared token. */
export class ProjectAccount {
  private serial = 0;
  private disposed = false;
  private wanted = true;
  private request?: AbortController;
  private unsubscribe?: () => void;
  private provider?: RejsonAccountBridge;
  private state: AccountState = { view: 'checking', identity: null, message: '' };
  constructor(private win: Window, private changed: (state: AccountState) => void) {}
  private read(key: string): string | null { try { return this.win.sessionStorage.getItem(key); } catch { return null; } }
  private remove(key: string): void { try { this.win.sessionStorage.removeItem(key); } catch { /* display still resets */ } }
  private write(key: string, value: string): boolean {
    try { this.win.sessionStorage.setItem(key, value); return true; } catch { return false; }
  }
  private emit(view: AccountView, identity: AccountIdentity | null = null, message = ''): void {
    if (this.disposed) return;
    this.state = { view, identity, message }; this.changed(this.state);
  }
  private onReturn = () => { if (this.wanted) void this.refresh(false); };
  start(): void {
    if (!accountOriginSupported(this.win.location.origin)) { this.emit('unsupported'); return; }
    this.wanted = (!disconnectedDocuments.has(this.win) && this.read(ACCOUNT_DISCONNECTED_KEY) !== '1') || shouldOpenAccountOnReturn(this.win);
    this.win.addEventListener('pageshow', this.onReturn);
    this.win.addEventListener('focus', this.onReturn);
    if (this.wanted) void this.refresh(false);
    else this.emit('guest', null, 'Projekt jest rozłączony. Konto strony pozostaje bez zmian.');
  }
  async refresh(fromClick = false): Promise<void> {
    if (this.disposed || !accountOriginSupported(this.win.location.origin)) return;
    if (fromClick) { this.wanted = true; disconnectedDocuments.delete(this.win); this.remove(ACCOUNT_DISCONNECTED_KEY); }
    if (!this.wanted) return;
    const sequence = ++this.serial;
    this.request?.abort(); const request = new AbortController(); this.request = request;
    // Clear previous user's identity before any asynchronous verification.
    this.emit('checking');
    try {
      const api = await bridgeReady(this.win, request.signal);
      if (sequence !== this.serial || this.disposed) return;
      if (this.provider !== api) {
        this.unsubscribe?.(); this.provider = api;
        this.unsubscribe = api.subscribe(() => { if (this.wanted) void this.refresh(false); });
      }
      const identity = await checkedSession(this.win, api, request.signal);
      if (sequence !== this.serial || this.disposed) return;
      if (identity) {
        this.remove(ACCOUNT_PENDING_KEY); this.remove(ACCOUNT_DISCONNECTED_KEY);
        this.write(ACCOUNT_CONNECTED_KEY, '1'); this.emit('connected', identity); return;
      }
      this.remove(ACCOUNT_CONNECTED_KEY);
      if (!fromClick) {
        this.remove(ACCOUNT_PENDING_KEY); this.emit('guest', null, 'Brak potwierdzonej sesji. Możesz zalogować się przez stronę konta.'); return;
      }
      this.open(api);
    } catch {
      if (sequence === this.serial && !this.disposed) {
        this.remove(ACCOUNT_CONNECTED_KEY);
        this.emit('unavailable', null, 'Nie można potwierdzić konta. Sprawdź połączenie i spróbuj ponownie.');
      }
    }
  }
  private open(api: RejsonAccountBridge): void {
    // Only an intent timestamp. Provider maintains its own same-origin return path.
    if (!this.write(ACCOUNT_PENDING_KEY, String(Date.now()))) {
      this.emit('unavailable', null, 'Przeglądarka blokuje pamięć sesji. Nie można bezpiecznie zapisać zamiaru logowania i powrotu.'); return;
    }
    this.emit('opening', null, 'Otwieram stronę konta w tej samej karcie…');
    try { api.open(); }
    catch { this.remove(ACCOUNT_PENDING_KEY); this.emit('unavailable', null, 'Nie udało się otworzyć strony konta. Spróbuj ponownie.'); }
  }
  manage(): void {
    if (!this.disposed && accountOriginSupported(this.win.location.origin) && this.provider && this.state.view === 'connected') this.open(this.provider);
  }
  disconnect(): void {
    ++this.serial; this.request?.abort(); this.wanted = false; disconnectedDocuments.add(this.win);
    this.remove(ACCOUNT_PENDING_KEY); this.remove(ACCOUNT_CONNECTED_KEY); this.write(ACCOUNT_DISCONNECTED_KEY, '1');
    this.emit('guest', null, 'Projekt rozłączony. Nadal możesz być zalogowany na rejson59.github.io. Nie wylogowano innych projektów.');
  }
  dispose(): void {
    this.disposed = true; ++this.serial; this.request?.abort(); this.unsubscribe?.();
    this.win.removeEventListener('pageshow', this.onReturn); this.win.removeEventListener('focus', this.onReturn);
  }
}
