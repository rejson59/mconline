// Opaque general-site sessions are NOT Supabase JWTs. Verify every request
// against the account database before using the world project's service role.
// No tokens, capabilities or raw upstream errors are logged or returned.
const ACCOUNT = 'https://hzbqzfimtroixnldzjeq.supabase.co';
const ACCOUNT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YnF6ZmltdHJvaXhubGR6amVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTEsImV4cCI6MjEwODE3MjM5MX0.oeZWOaNd6p3wZBZQQu3QWjRHlrkxV_BFQRNSN-6YntE';
const ORIGIN = 'https://rejson59.github.io';
type Obj = Record<string, any>;
export function gateway(worldURL: string, serviceKey: string, request: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    const headers = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type, apikey, authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json', Vary: 'Origin' };
    const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    // CORS isn't authentication; the token check below also protects non-browser callers.
    if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return response({ error: 'Niedozwolony origin.' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return response({ error: 'Wymagane POST.' }, 405);
    try {
      if (Number(req.headers.get('content-length')) > 524288) return response({ error: 'Zbyt duże żądanie.' }, 413);
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 524288) return response({ error: 'Zbyt duże żądanie.' }, 413);
      const b = JSON.parse(raw) as Obj;
      if (typeof b.token !== 'string' || b.token.length < 16 || b.token.length > 512) return response({ error: 'Zaloguj się, aby grać online.' }, 401);
      const identityResponse = await request(`${ACCOUNT}/rest/v1/rpc/mconline_identity`, { method: 'POST', headers: { apikey: ACCOUNT_KEY, Authorization: `Bearer ${ACCOUNT_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: b.token }), signal: AbortSignal.timeout(12000) });
      if (!identityResponse.ok) return response({ error: 'Nie można potwierdzić sesji konta. Zaloguj się ponownie.' }, identityResponse.status >= 500 ? 503 : 401);
      const identity = await identityResponse.json() as Obj;
      if (!/^[a-f0-9-]{36}$/.test(identity.id) || typeof identity.username !== 'string') return response({ error: 'Nieprawidłowa odpowiedź konta.' }, 503);
      if (!['public', 'city'].includes(b.world) || typeof b.session !== 'string' || !/^[a-f0-9-]{36}$/.test(b.session)) return response({ error: 'Nieprawidłowa sesja gry.' }, 400);
      const db = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
        const r = await request(`${worldURL}/rest/v1/${path}`, { method, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
        const result = await r.json();
        if (!r.ok) {
          // SQL messages are hand-written and do not contain RPC arguments.
          const message = typeof result.message === 'string' && !/token|capability|key|uuid|syntax|constraint|column|relation/i.test(result.message) ? result.message : 'Serwer odrzucił żądanie.';
          const error = new Error(message) as Error & { code?: string }; error.code = result.code; throw error;
        }
        return result;
      };
      const rpc = (name: string, args: Obj) => db(`rpc/${name}`, args);
      const args = (b.args && typeof b.args === 'object' && !Array.isArray(b.args) ? b.args : {}) as Obj;
      if (!['join','replace','leave','poll','read','profile','rpc'].includes(b.op)) return response({ error: 'Nieznana operacja.' }, 400);
      const saveProfile = async (profile: Obj, leave = false) => {
        const row: Obj = {};
        for (const field of ['x','y','z','yaw','pitch','health','hunger','inv','armor','xp','skin','dim']) if (Object.prototype.hasOwnProperty.call(profile,field)) row[field] = profile[field];
        return rpc('mconline_profile', { p_account: identity.id, p_username: identity.username, p_session: b.session, p_world: b.world, p_profile: row, p_guard: profile.mconline_guard === true, p_expected: profile.mconline_base ?? null, p_save: profile.mconline_save ?? null, p_leave: leave });
      };
      // A final checkpoint and leave MUST share one fenced SQL transaction.
      if (b.op === 'leave' && args.profile) return response({ data: await saveProfile(args.profile, true) });
      if (b.op === 'profile') return response({ data: await saveProfile(args) });
      const member = await rpc('mconline_member_v2', { p_account: identity.id, p_username: identity.username, p_session: b.session, p_world: b.world, p_op: ['join','replace','leave'].includes(b.op) ? b.op : 'touch', p_resume: ['join','replace'].includes(b.op) ? args.resume ?? null : null });
      if (b.op === 'join' || b.op === 'replace') return response({ data: { pid: member.pid, username: member.username, cursor: member.cursor } });
      if (b.op === 'leave') return response({ data: null });
      let data: unknown;
      if (b.op === 'poll') {
        data = await rpc('mconline_poll', { p_account: identity.id, p_session: b.session, p_world: b.world, p_presence: args.presence ?? {}, p_messages: args.messages ?? [], p_since: Math.max(0, Math.trunc(Number(args.since) || 0)) });
      } else if (b.op === 'read') {
        const q = new URLSearchParams({ world: `eq.${b.world}` });
        if (args.table === 'blockcraft_players') { q.set('pid', `eq.${member.pid}`); q.set('select', '*'); q.set('limit', '1'); }
        else if (args.table === 'blockcraft_blocks') {
          const selects = ['version', 'x,y,z,block,dim', 'x,y,z,block,dim,version'];
          if (!selects.includes(args.select)) throw new Error('Nieprawidłowy odczyt bloków.');
          q.set('select', args.select);
          if (args.after !== undefined) q.set('version', `gt.${Math.max(0, Math.trunc(Number(args.after) || 0))}`);
          const order = ['id', 'version'].includes(args.order) ? args.order : 'id';
          q.set('order', `${order}.${args.ascending === false ? 'desc' : 'asc'}`);
          q.set('offset', String(Math.max(0, Math.min(400000, Math.trunc(Number(args.offset) || 0)))));
          q.set('limit', String(Math.max(1, Math.min(5000, Math.trunc(Number(args.limit) || 1000)))));
        } else throw new Error('Niedozwolona tabela.');
        data = await db(`${args.table}?${q}`);
      } else if (b.op === 'rpc') {
        const city = b.world === 'city';
        const plot = city ? 'blockcraft_city_plot' : 'blockcraft_plot';
        const write = city ? 'blockcraft_city_write_blocks' : 'blockcraft_write_blocks';
        const a = args.params ?? {};
        if (args.name === plot) data = await rpc(plot, { p_world: b.world, p_key: member.capability, p_op: a.p_op, p_cx: a.p_cx ?? 0, p_cz: a.p_cz ?? 0, p_name: member.username });
        else if (args.name === write) data = await rpc(write, { p_world: b.world, p_key: member.capability, p_edits: a.p_edits });
        else if (args.name === 'blockcraft_drop_op') data = await rpc('blockcraft_drop_op', { p_world: b.world, p_actor: member.pid, p_op: a.p_op, p_drop: a.p_drop ? { ...a.p_drop, owner: member.pid } : null, p_uid: a.p_uid ?? null, p_dim: a.p_dim ?? null });
        else throw new Error('Niedozwolona operacja serwera.');
      } else throw new Error('Nieznana operacja.');
      return response({ data });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P0410') return response({ error: 'Zapis ekwipunku zmienił się. Kopia lokalna zachowana; nie nadpisano serwera.', code: 'PROFILE_CONFLICT' }, 409);
      if ((error as { code?: string })?.code === 'P0409') return response({ error: 'Serwer pamięta wcześniejsze połączenie konta. Może to być poprzednia karta lub inne urządzenie. Poczekaj do minuty albo świadomie odzyskaj połączenie.', code: 'ACCOUNT_IN_USE' }, 409);
      if (error instanceof SyntaxError) return response({ error: 'Nieprawidłowy JSON.' }, 400);
      if (error instanceof Error && !/fetch|network|abort|timeout|json|token|apikey|bearer/i.test(error.message)) return response({ error: error.message.slice(0,240) }, 409);
      return response({ error: 'Brak połączenia z serwerem. Spróbuj ponownie.' }, 503);
    }
  };
}
// Deno environment secrets are supplied by Supabase, never copied to the client.
declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
if (typeof Deno !== 'undefined') Deno.serve(gateway(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!));
