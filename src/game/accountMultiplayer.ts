/** Supabase-shaped adapter for the existing game protocol. No public Realtime
 * channel: inbox, roster, blocks, inventory, drops and plots all require a
 * server-verified account on EVERY HTTP call. No capability leaves the gateway. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentAccountTransport, type MultiplayerDelivery } from './accountWorlds';
import { acquireTabLease, type TabLease } from './multiplayerLease';
type RecordData = Record<string, unknown>;
export interface ConnectionOptions { replace?: boolean; signal?: AbortSignal }
type Authority = ReturnType<typeof currentAccountTransport>;
export interface ConnectionEnvironment {
  acquire(owner: string): Promise<TabLease>;
  lifecycle?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>;
}
const opening = new Map<string, Promise<void>>();
const closing = new Map<string, Promise<void>>();
export function openAccountServer(world: 'public' | 'city', options: ConnectionOptions = {}) {
  return connectAccountServer(currentAccountTransport(), world, options, { acquire: acquireTabLease, lifecycle: window });
}
/** Exported for deterministic tests; production authority is obtained above. */
export async function connectAccountServer(authority: Authority, world: 'public' | 'city', options: ConnectionOptions, environment: ConnectionEnvironment) {
  while (opening.has(authority.owner)) await opening.get(authority.owner);
  let done!: () => void;
  const latch = new Promise<void>(resolve => { done = resolve; }); opening.set(authority.owner, latch);
  try { return await establishAccountServer(authority, world, options, environment); }
  finally { done(); if (opening.get(authority.owner) === latch) opening.delete(authority.owner); }
}
async function establishAccountServer(authority: Authority, world: 'public' | 'city', options: ConnectionOptions, environment: ConnectionEnvironment) {
  await closing.get(authority.owner);
  options.signal?.throwIfAborted();
  const guard = await environment.acquire(authority.owner);
  const session = crypto.randomUUID(); // Fresh generation fences old leave/touch after reload.
  const pending = new Set<Promise<unknown>>();
  const raw = (op: string, args?: unknown, delivery?: MultiplayerDelivery) => authority.request(op, world, session, args, delivery);
  const request = (op: string, args?: unknown) => {
    const task = raw(op, args); pending.add(task);
    void task.finally(() => pending.delete(task)).catch(() => {}); return task;
  };
  let closed = false, releasing: Promise<void> | null = null;
  const channels = new Set<AccountChannel>();
  const release = (settled: Promise<unknown> = Promise.resolve(), immediate = false): Promise<void> => {
    if (releasing) return releasing;
    for (const channel of channels) channel.close();
    environment.lifecycle?.removeEventListener('pagehide', pagehide);
    options.signal?.removeEventListener('abort', cancelled);
    releasing = (async () => {
      if (!immediate) { await Promise.allSettled([settled]); await Promise.allSettled([...pending]); }
      closed = true;
      try { await raw('leave', undefined, { keepalive: immediate, timeout: 5000 }); }
      catch { /* An ambiguous leave is recovered by resume/fencing, never by resetting other users. */ }
      finally { try { await guard.unlock(); } catch { /* Lost document/lock is already released. */ } }
    })();
    closing.set(authority.owner, releasing);
    void releasing.finally(() => { if (closing.get(authority.owner) === releasing) closing.delete(authority.owner); });
    return releasing;
  };
  const cancelled = () => { void release(); };
  const pagehide = () => {
    // pagehide also covers reload/navigation; process kills still use safe resume.
    const restored = (event: Event) => {
      if ((event as PageTransitionEvent).persisted) environment.lifecycle?.dispatchEvent(new Event('mconline-server-disconnected'));
    };
    environment.lifecycle?.addEventListener('pageshow', restored, { once: true });
    void release(Promise.resolve(), true);
  };
  try {
    options.signal?.throwIfAborted();
    const joined = await request(options.replace ? 'replace' : 'join', { resume: guard.resume }) as { pid: string; username: string; cursor: number };
    options.signal?.throwIfAborted();
    const call = async (op: string, args?: unknown) => {
      if (closed) return { data: null, error: { message: 'Sesja zamknięta.' } };
      try { return { data: await request(op, args), error: null }; }
      catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Błąd połączenia.' } }; }
    };
    const client = {
      from: (table: string) => new AccountQuery(table, call),
      rpc: (name: string, params: RecordData) => call('rpc', { name, params }),
      channel: () => { const channel = new AccountChannel(request, joined.cursor ?? 0); channels.add(channel); return channel; },
      removeChannel: (channel: AccountChannel) => { channel.close(); channels.delete(channel); },
    };
    environment.lifecycle?.addEventListener('pagehide', pagehide);
    options.signal?.addEventListener('abort', cancelled, { once: true });
    return { pid: joined.pid, name: joined.username, client: client as unknown as SupabaseClient, release };
  } catch (error) {
    // A timeout may hide a committed join. Clean up the SAME generation even
    // when there was no response; a delayed cleanup cannot remove a newer join.
    await release(); throw error;
  }
}

class AccountQuery {
  private args: RecordData;
  private op = 'read';
  constructor(table: string, private call: (op: string, args: RecordData) => Promise<unknown>) { this.args = { table }; }
  select(select: string) { this.args.select = select; return this; }
  eq(_field: string, _value: unknown) { return this; } // Backend binds world/pid; client filters are NOT authority.
  gt(field: string, value: number) { if (field === 'version') this.args.after = value; return this; }
  order(order: string, options: { ascending: boolean }) { Object.assign(this.args, { order, ascending: options.ascending }); return this; }
  limit(limit: number) { this.args.limit = limit; return this; }
  range(from: number, to: number) { Object.assign(this.args, { offset: from, limit: to - from + 1 }); return this; }
  upsert(row: RecordData) { this.op = 'profile'; this.args = row; return this; }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) { return this.call(this.op, this.args).then(resolve, reject); }
}
class AccountChannel {
  private listeners: { kind: string; callback: (value?: any) => void }[] = [];
  private status?: (status: string) => void;
  private roster: RecordData = {};
  private presence: RecordData = {};
  private messages: RecordData[] = [];
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private subscribed = false;
  private failures = 0;
  constructor(private request: (op: string, args?: unknown) => Promise<any>, private cursor: number) {}
  on(kind: string, _filter: unknown, callback: (value?: any) => void) { this.listeners.push({ kind, callback }); return this; }
  subscribe(callback: (status: string) => void) { this.status = callback; void this.poll(); return this; }
  presenceState() { return this.roster; }
  async track(value: RecordData) { this.presence = value; return 'ok'; }
  async untrack() { return 'ok'; }
  async send(packet: { payload: RecordData }) {
    if (this.stopped) return 'error';
    // Only the latest position matters; reliable transient events retain their
    // id across retries so an ambiguous HTTP failure cannot duplicate PvP/chat.
    if (packet.payload.t === 'pos') this.messages = this.messages.filter(m => m.t !== 'pos');
    if (this.messages.length >= 400) throw new Error('Kolejka serwera jest pełna.');
    this.messages.push({ ...packet.payload, _mid: crypto.randomUUID() }); return 'ok';
  }
  close() { this.stopped = true; clearTimeout(this.timer); }
  private async poll() {
    const batch = this.messages.slice(0, 40);
    try {
      const data = await this.request('poll', { since: this.cursor, presence: this.presence, messages: batch });
      if (this.stopped) return;
      const acknowledged = new Set(batch.map(m => m._mid));
      this.messages = this.messages.filter(m => !acknowledged.has(m._mid));
      this.cursor = data.cursor; this.roster = data.presence;
      this.failures = 0;
      if (!this.subscribed) { this.subscribed = true; this.status?.('SUBSCRIBED'); }
      for (const listener of this.listeners) if (listener.kind === 'presence') listener.callback();
      for (const message of data.messages) for (const listener of this.listeners) if (listener.kind === 'broadcast') listener.callback({ payload: message.payload });
    } catch {
      if (this.stopped) return;
      this.failures++;
      // Invalidate the official game connection rather than silently letting
      // an expired/disconnected account keep playing an unshared world.
      this.subscribed = false; this.status?.('CHANNEL_ERROR');
      if (this.failures >= 3) { this.close(); this.status?.('CLOSED'); return; }
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.poll(), this.failures ? 1500 : 250);
  }
}
