/** Offline tests of the account transport and actual form; no real accounts. */
import assert from 'node:assert/strict';
const cases: Array<{ name: string; run: () => void | Promise<void> }> = [];
const test = (name: string, run: () => void | Promise<void>) => { cases.push({ name, run }); };
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { authenticateCommunity, COMMUNITY_SESSION_KEY, readCommunitySession, validCredentials, verifyCommunitySession } from '../src/game/communityAccount';

const token = 'a'.repeat(48);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
test('PIN only for old accounts, registration requires a password with correct UTF-8 limits', () => {
  assert.equal(validCredentials('login', 'Rejson', '1234'), true);
  assert.equal(validCredentials('register', 'Rejson', '1234'), false);
  assert.equal(validCredentials('register', 'Rejson', 'Poprawne hasło!'), true);
  assert.equal(validCredentials('register', 'Rejson', 'ą'.repeat(37)), false);
  assert.equal(validCredentials('login', '../../bad', '1234'), false);
});
test('login and registration call the existing RPC and verify identity without URL secrets', async () => {
  for (const mode of ['login', 'register'] as const) {
    const seen: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      const text = String(url); const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.ok(!text.includes(token) && !text.includes('Haslo-bardzo-dlugie'));
      seen.push({ url: text, body });
      return text.endsWith('community_whoami') ? json({ username: 'Rejson' }) : json({ token, username: 'forged' });
    };
    const result = await authenticateCommunity(mode, '  Rejson ', 'Haslo-bardzo-dlugie', fetcher as typeof fetch);
    assert.deepEqual(result, { token, username: 'Rejson' });
    assert.equal(seen[0].url.endsWith(mode === 'login' ? 'community_login' : 'community_register'), true);
    assert.deepEqual(seen[0].body, { p_username: 'Rejson', p_pin: 'Haslo-bardzo-dlugie' });
    assert.deepEqual(seen[1].body, { p_token: token });
  }
});
test('errors and invalid sessions do not masquerade as an authenticated user', async () => {
  const failed = (async () => json({ message: 'Nieprawidłowa nazwa lub hasło / PIN.' }, 401)) as typeof fetch;
  await assert.rejects(authenticateCommunity('login', 'Rejson', '1234', failed), /Nieprawidłowa/);
  assert.equal(await verifyCommunitySession({ token, username: 'forged' }, (async () => json({ username: null })) as typeof fetch), null);
  const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
  await assert.rejects(verifyCommunitySession({ token, username: 'forged' }, offline), /Nie udało się połączyć/);
  let n = 0;
  const partial = (async () => ++n === 1 ? json({ token, username: 'Rejson' }) : json({}, 503)) as typeof fetch;
  await assert.rejects(authenticateCommunity('register', 'Rejson', 'Password long enough', partial), /Konto utworzono/);
});
test('the game menu opens an optional in-place login, verifies it and leaves worlds untouched', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://rejson59.github.io/mconline/', pretendToBeVisual: true });
  const w = dom.window;
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLCanvasElement','Element','Node','Event','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','matchMedia']) {
    if (key in w) Object.defineProperty(g, key, { value: (w as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => String(url).endsWith('community_whoami') ? json({ username: 'Rejson' }) : json({ token, username: 'Rejson' })) as typeof fetch;
  w.localStorage.setItem('blockcraft-saves-v2', '[{"id":"world1","seed":42}]');
  w.localStorage.setItem('blockcraft-profile-v1', 'p1234567890123456789');
  const { createRoot } = await import('react-dom/client');
  const App = (await import('../src/App')).default;
  const container = w.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<App />); });
    const accountButton = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Konto Rejson'));
    assert.ok(accountButton, 'konto dostępne w menu bez zakładania konta');
    await act(async () => { accountButton.click(); });
    const dialog = container.querySelector('[role="dialog"][aria-labelledby="community-title"]');
    assert.ok(dialog);
    assert.match(dialog.textContent || '', /światy|Światy/);
    const fields = [...dialog.querySelectorAll('input')];
    const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(fields[0], 'Rejson'); fields[0].dispatchEvent(new w.Event('input', { bubbles: true })); });
    await act(async () => { setter.call(fields[1], '1234'); fields[1].dispatchEvent(new w.Event('input', { bubbles: true })); });
    await act(async () => { dialog.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)); });
    assert.match(dialog.textContent || '', /Zalogowano jako/);
    assert.equal(readCommunitySession(w.localStorage)?.username, 'Rejson');
    assert.ok(!w.localStorage.getItem(COMMUNITY_SESSION_KEY)?.includes('1234'));
    assert.equal(w.localStorage.getItem('blockcraft-saves-v2'), '[{"id":"world1","seed":42}]');
    assert.equal(w.localStorage.getItem('blockcraft-profile-v1'), 'p1234567890123456789');
    const logout = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes('Wyloguj na tym urządzeniu'))!;
    await act(async () => { logout.click(); });
    assert.equal(w.localStorage.getItem(COMMUNITY_SESSION_KEY), null);
    const registerMode = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Utwórz konto')!;
    await act(async () => { registerMode.click(); });
    const reg = [...dialog.querySelectorAll('input')];
    for (const [input, value] of [[reg[0], 'Rejson'], [reg[1], 'haslo co najmniej 10 znakow'], [reg[2], 'haslo co najmniej 10 znakow']] as const) {
      await act(async () => { setter.call(input, value); input.dispatchEvent(new w.Event('input', { bubbles: true })); });
    }
    await act(async () => { dialog.querySelector('form')!.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)); });
    assert.match(dialog.textContent || '', /Zalogowano jako/);
    assert.ok(!w.localStorage.getItem(COMMUNITY_SESSION_KEY)?.includes('haslo co najmniej'));
    assert.equal(w.localStorage.getItem('blockcraft-saves-v2'), '[{"id":"world1","seed":42}]');
    await act(async () => { dialog.querySelector<HTMLButtonElement>('button[aria-label="Zamknij konto"]')!.click(); });
    assert.equal(container.querySelector('[aria-labelledby="community-title"]'), null);
  } finally {
    await act(async () => { root.unmount(); });
    globalThis.fetch = originalFetch; dom.window.close();
  }
});

test('late identity response cannot replace a newer shared session', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://rejson59.github.io/mconline/', pretendToBeVisual: true });
  const w = dom.window;
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','Event','MouseEvent','KeyboardEvent','localStorage']) {
    if (key in w) Object.defineProperty(g, key, { value: (w as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const first = 'a'.repeat(48), second = 'b'.repeat(48);
  w.localStorage.setItem(COMMUNITY_SESSION_KEY, JSON.stringify({ token: first, username: 'untrusted' }));
  let finishFirst: (r: Response) => void = () => {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body)) as { p_token: string };
    if (req.p_token === first) return new Promise<Response>((resolve) => { finishFirst = resolve; });
    return json({ username: 'NoweKonto' });
  }) as typeof fetch;
  const { createRoot } = await import('react-dom/client');
  const Account = (await import('../src/components/CommunityAccount')).default;
  const container = w.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<Account onClose={() => {}} />); });
    await act(async () => {
      w.localStorage.setItem(COMMUNITY_SESSION_KEY, JSON.stringify({ token: second, username: 'forged' }));
      w.dispatchEvent(new w.StorageEvent('storage', { key: COMMUNITY_SESSION_KEY, newValue: w.localStorage.getItem(COMMUNITY_SESSION_KEY) }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => { finishFirst(json({ username: 'StareKonto' })); await new Promise((resolve) => setTimeout(resolve, 10)); });
    assert.match(container.textContent || '', /NoweKonto/);
    assert.doesNotMatch(container.textContent || '', /StareKonto/);
    assert.equal(readCommunitySession(w.localStorage)?.token, second);
  } finally { await act(async () => { root.unmount(); }); globalThis.fetch = originalFetch; w.close(); }
});

let failures = 0;
for (const item of cases) {
  try { await item.run(); console.log(`✓ ${item.name}`); }
  catch (error) { failures++; console.error(`✗ ${item.name}`, error); }
}
console.log(`${cases.length - failures}/${cases.length} account checks passed`);
process.exit(failures ? 1 : 0);
