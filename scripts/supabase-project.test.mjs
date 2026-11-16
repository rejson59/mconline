/** Prevent partial project cutovers (URL changed but old JWT/gateway left behind).
 * No network access, private keys, credentials or user sessions.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const ref = 'hzbqzfimtroixnldzjeq';
const retired = 'bewwejewgqzctnjrbclu';
const read = file => readFileSync(file, 'utf8');
const online = read('src/game/online.ts');
const account = read('src/game/accountWorlds.ts');
const fixture = read('.harness/fixtures/rejson-account/rejson-account.js');

test('world, identity and cloud endpoints share rejson-widgets', () => {
  assert.equal(/SUPABASE_URL = '([^']+)'/.exec(online)?.[1], `https://${ref}.supabase.co`);
  assert.equal(/WORLD_GATEWAY = '([^']+)'/.exec(account)?.[1], `https://${ref}.supabase.co/functions/v1/mconline-gateway`);
  assert.match(account, new RegExp(`ACCOUNT_DB = 'https://${ref}\\.supabase\\.co'`));
});

test('public JWT belongs to the destination, stays anon, and matches account helper', () => {
  const key = /SUPABASE_ANON\s*=\s*'([^']+)'/.exec(online)?.[1];
  assert.ok(key);
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  assert.equal(payload.ref, ref);
  assert.equal(payload.role, 'anon');
  assert.equal(key, /var KEY = "([^"]+)"/.exec(fixture)?.[1]);
  assert.equal(key, /ACCOUNT_ANON = '([^']+)'/.exec(account)?.[1]);
});

test('runtime, owner panel and operational scripts have no retired backend endpoints', () => {
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(file);
      else if (/\.(?:ts|tsx|js|mjs|html)$/.test(file) && file !== 'scripts/supabase-project.test.mjs') {
        assert.ok(!read(file).includes(retired), `${file} still references retired project`);
      }
    }
  }
  for (const dir of ['src', 'public', 'scripts', 'supabase/functions']) scan(dir);
});

test('reference archive remains locked and server credentials never enter runtime', () => {
  assert.match(read('supabase/functions/mconline-reference-archive/index.ts'), /budgetBytes:\s*0/);
  for (const file of ['src/game/online.ts', 'src/game/accountWorlds.ts', 'public/testy/app.js']) {
    assert.doesNotMatch(read(file), /SUPABASE_SERVICE_ROLE_KEY|MCONLINE_MIGRATION_SOURCE_KEY/);
  }
});
