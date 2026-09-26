/**
 * UI suite: renders the real React screens without a browser.
 *
 * Part 1 always runs – the menus are rendered to static markup with
 * react-dom/server, which catches crashes, bad props and missing labels.
 * Part 2 runs only when jsdom is installed (`npm i --no-save jsdom`): it mounts
 * the whole <App/>, walks through world creation and asserts that a missing
 * WebGL context ends in a readable error instead of a blank page.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainMenu, Controls, AchievementsPanel, PauseMenu } from '../src/components/Menus';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { DEFAULT_SETTINGS } from '../src/utils/settings';
import EnchantScreen from '../src/components/EnchantScreen';
import { Inventory } from '../src/game/inventory';
import { I } from '../src/game/items';
import { rollEnchantOptions } from '../src/game/enchant';

// ------------------------------------------------------------------- runner
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, extra = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name}${extra ? ' — ' + extra : ''}`); }
}
function section(t: string) { console.log(`\n— ${t}`); }

// --------------------------------------------------------------- DOM stubs
const store = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const noop = () => {};

// ============================================================ static renders
section('menus: static render');
{
  const menu = renderToStaticMarkup(
    <MainMenu saves={[]} onPlay={noop} onNew={noop} onDelete={noop} />
  );
  check('title is rendered', menu.includes('BLOCKCRAFT'));
  check('new world button', menu.includes('Nowy świat'));
  check('controls button', menu.includes('Sterowanie'));
  check('options button', menu.includes('Opcje'));
  check('fullscreen button', menu.includes('Pełny ekran'));
  check('export/import buttons', menu.includes('Eksport zapisów') && menu.includes('Import zapisów'));
  check('menu background is a relative url', !menu.includes('url("/menu-bg.jpg'));

  const withSaves = renderToStaticMarkup(
    <MainMenu
      saves={[{ id: 'w1', name: 'Wyspa', seed: 1234, mode: 'survival', day: 3, worldType: 'flat' }]}
      onPlay={noop}
      onNew={noop}
      onDelete={noop}
    />
  );
  check('saved worlds are listed', withSaves.includes('Wyspa') && withSaves.includes('1234'));
  check('world type shown on the card', withSaves.includes('płaski'));
  check('delete button present', withSaves.includes('Usuń'));

  const shared = renderToStaticMarkup(
    <MainMenu saves={[]} sharedSeed={99} sharedMode="creative" onPlay={noop} onNew={noop} onDelete={noop} />
  );
  check('shared link opens the creation form', shared.includes('Świat z linku') && shared.includes('99'));
  check('shared link keeps the mode', shared.includes('Kreatywny'));

  const controls = renderToStaticMarkup(<Controls />);
  check('controls list movement keys', controls.includes('W A S D'));
  check('controls list the enchanting table', /zakl/i.test(controls));

  const pause = renderToStaticMarkup(
    <PauseMenu settings={DEFAULT_SETTINGS} shareUrl="http://x/#seed=1" onSettings={noop} onResume={noop} onQuit={noop} onSave={noop} />
  );
  check('pause menu offers resume and save', pause.includes('Wróć do gry') && pause.includes('Zapisz świat'));
  check('pause menu counts achievements', pause.includes(`/${ACHIEVEMENTS.length}`));

  const ach = renderToStaticMarkup(<AchievementsPanel unlocked={['wood', 'diamond']} />);
  check('unlocked achievements are revealed', ach.includes('Pierwsze drewno') && ach.includes('Diamenty!'));
  check('locked achievements stay hidden', ach.includes('???'));
  check('achievement counter', ach.includes(`2 / ${ACHIEVEMENTS.length}`));
}

// ======================================================= enchanting screen
section('enchant screen: static render');
{
  // A Game-shaped stand-in – the screen only touches a handful of members.
  const inv = new Inventory();
  inv.slots[0] = { id: I.IRON_PICK, count: 1, dur: 90 };
  inv.slots[1] = { id: 150, count: 6 }; // lazuryt
  const item = { id: I.DIAMOND_SWORD, count: 1, dur: 1200, ench: { sharpness: 3 } as Record<string, number> };
  const options = rollEnchantOptions(item, 15, () => 0.5);
  const game = {
    inventory: inv,
    enchantItem: item,
    enchantPower: () => 15,
    enchOptions: options,
    mode: 'survival',
    xp: { info: () => ({ level: 22, inLevel: 4, need: 20 }) },
    canEnchantWith: () => true,
    enchantWith: () => false,
    clickEnchantSlot: () => {},
    closeInventory: () => {},
    emitHud: () => {},
  };
  const html = renderToStaticMarkup(
    <EnchantScreen game={game as never} icons={{}} onChange={() => {}} />
  );
  check('screen title renders', html.includes('Stół zaklęć'));
  check('shelf counter shows', html.includes('Biblioteczki: 15/15'));
  check('player level shows', html.includes('Poziom: 22'));
  check('the item sits in the slot', html.includes('Diamentowy miecz') || html.includes('img'));
  check('three offers listed', options.length === 3);
  for (const opt of options) check(`offer ${opt.ench} rendered`, html.includes(opt.cost + ' pkt'));
  check('lapis cost shown', html.includes('1◆'));
  check('inventory grid rendered', html.includes('mc-slot'));
}

// ============================================================ jsdom mounting
async function mountWithJsdom(): Promise<boolean> {
  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    console.log('  (jsdom niedostępny – pomijam test interaktywny: npm i --no-save jsdom)');
    return false;
  }

  section('ui: mounting the app in jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const w = dom.window as unknown as Record<string, unknown> & {
    document: Document; navigator: unknown; HTMLElement: unknown; MouseEvent: unknown;
  };
  const g = globalThis as unknown as Record<string, unknown>;
  for (const key of [
    'window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement',
    'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'matchMedia',
  ]) {
    if (!(key in w)) continue;
    // some globals (navigator) are getter-only in modern Node
    try {
      Object.defineProperty(g, key, { value: w[key], configurable: true, writable: true });
    } catch {
      try { g[key] = w[key]; } catch { /* leave the host global alone */ }
    }
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const App = (await import('../src/App')).default;

  const container = w.document.getElementById('root')!;
  const root = createRoot(container);
  await React.act(async () => { root.render(<App />); });

  const text = () => container.textContent ?? '';
  const buttons = () => [...container.querySelectorAll('button')] as HTMLButtonElement[];
  const byText = (label: string) => buttons().find((b) => (b.textContent ?? '').includes(label));

  check('app renders the title screen', text().includes('BLOCKCRAFT'));

  await React.act(async () => {
    byText('Nowy świat')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });
  check('creation form opened', text().includes('Utwórz nowy świat'));
  check('world type toggle exists', !!byText('Typ świata'));

  await React.act(async () => {
    byText('Typ świata')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });
  check('flat world selectable', text().includes('Płaski'));

  const nameInput = container.querySelector('input') as HTMLInputElement | null;
  if (nameInput) {
    await React.act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        (w as unknown as { HTMLInputElement: { prototype: HTMLInputElement } }).HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(nameInput, 'Testowy świat');
      nameInput.dispatchEvent(new (w.Event as unknown as new (t: string, o?: object) => Event)('input', { bubbles: true }));
    });
    check('world name is editable', nameInput.value === 'Testowy świat');
  }

  await React.act(async () => {
    byText('Stwórz świat')?.dispatchEvent(new (w.MouseEvent as unknown as new (t: string, o?: object) => Event)('click', { bubbles: true }));
  });

  // jsdom has no WebGL, so the game view must fall back to a readable message.
  const afterStart = text();
  check(
    'no WebGL → readable error, not a blank page',
    afterStart.includes('WebGL') || afterStart.includes('Błąd') || afterStart.includes('Świat gotowy'),
    afterStart.slice(0, 120)
  );
  check('something is still on screen', afterStart.length > 20);

  await React.act(async () => { root.unmount(); });
  check('unmount leaves no markup', (container.textContent ?? '').length === 0);
  dom.window.close();
  return true;
}

try {
  await mountWithJsdom();
} catch (e) {
  fail++;
  failures.push(`jsdom mount threw: ${(e as Error)?.message ?? e}`);
}

// =================================================================== report
console.log(`\n${'='.repeat(56)}`);
if (fail) {
  console.log(`${pass} checks passed, ${fail} FAILED`);
  for (const f of failures) console.log(`  ✗ ${f}`);
} else {
  console.log(`${pass} checks passed, 0 failed`);
  console.log('UI GREEN ✔');
}
process.exit(fail ? 1 : 0);
