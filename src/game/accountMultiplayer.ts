/** Supabase-shaped adapter for the existing game protocol. No public Realtime
 * channel: inbox, roster, blocks, inventory, drops and plots all require a
 * server-verified account on EVERY HTTP call. No capability leaves the gateway. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentAccountTransport } from './accountWorlds';
type RecordData = Record<string, unknown>;
export async function openAccountServer(world: 'public' | 'city') {
  const authority = currentAccountTransport();
  const session = crypto.randomUUID();
  const request = (op: string, args?: unknown) => authority.request(op, world, session, args);
  const joined = await request('join') as { pid: string; username: string; cursor: number };
  let closed = false;
  const channels = new Set<AccountChannel>();
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
  const release = () => {
    if (closed) return;
    closed = true; for (const channel of channels) channel.close();
    void request('leave').catch(() => {});
  };
  return { pid: joined.pid, name: joined.username, client: client as unknown as SupabaseClient, release };
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
