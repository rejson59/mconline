/** Real PostgreSQL WASM/PLpgSQL semantics. Identity/plot writer stubs here are
 * NOT proof of live authorization; deployed tests exercise real membership. */
import assert from 'node:assert/strict';
import { fixtureDB } from './fixtures/shared-state-db.mjs';
const db = await fixtureDB();
const alice = crypto.randomUUID(),
  bob = crypto.randomUUID(),
  session = crypto.randomUUID();
const ref = { d: 'o', x: 4, y: 65, z: 4 },
  empty = () => Array(27).fill(null);
const profile = (inv = []) => ({
  inv: JSON.stringify([...inv, ...Array(48 - inv.length).fill(null)]),
  armor: '[]',
  x: 4,
  y: 65,
  z: 4,
  health: 20,
  hunger: 20,
});
const sql = async (q, p = []) => (await db.query(q, p)).rows[0];
const save = async (a, p) =>
  (
    await sql('select mconline_profile($1,$2,$3,$4,$5,false,null,null,false)->0 as p', [
      a,
      'Fixture',
      session,
      'public',
      p,
    ])
  ).p;
const call = async (a, args) =>
  (await sql('select mconline_chest($1,$2,$3,$4,$5) as r', [a, 'Fixture', session, 'public', args])).r;
let checks = 0;
const check = (label, condition) => {
  assert.ok(condition, label);
  checks++;
};
try {
  let pa = await save(alice, profile([{ id: 1, count: 7, name: 'metadata' }]));
  let pb = await save(bob, profile());
  let ca = await call(alice, { op: 'open', ref, seed: empty() });
  let cb = await call(bob, { op: 'open', ref, seed: empty() });
  check('both accounts read the same chest', JSON.stringify(ca.slots) === JSON.stringify(cb.slots));
  const tx = {
    op: 'commit',
    id: crypto.randomUUID(),
    ref,
    revision: ca.revision,
    slots: empty(),
    drops: [],
    profile: { ...profile(), mconline_base: pa.updated_at },
  };
  tx.slots[0] = { id: 1, count: 7, name: 'metadata' };
  const deposited = await call(alice, tx);
  check(
    'deposit commits atomically',
    deposited.committed &&
      JSON.parse(deposited.profile.inv)[0] === null &&
      deposited.chest.slots[0].count === 7,
  );
  const retry = await call(alice, tx);
  check(
    'lost ACK replay cannot deposit twice',
    retry.committed && retry.chest.revision === deposited.chest.revision,
  );
  cb = await call(bob, { op: 'open', ref, seed: empty() });
  check('depositor is not the only reader', cb.slots[0].name === 'metadata');
  const take = (a) => ({
    op: 'commit',
    id: crypto.randomUUID(),
    ref,
    revision: cb.revision,
    slots: empty(),
    drops: [],
    profile: { ...profile([{ id: 1, count: 7, name: 'metadata' }]), mconline_base: a.updated_at },
  });
  const [ra, rb] = await Promise.all([call(alice, take(deposited.profile)), call(bob, take(pb))]);
  check('two withdrawals have exactly one winner', Number(ra.committed) + Number(rb.committed) === 1);
  check('loser inventory is not credited', JSON.parse((ra.committed ? rb : ra).profile.inv)[0] === null);
  const denied = {
    op: 'commit',
    id: crypto.randomUUID(),
    ref,
    revision: ra.chest.revision,
    slots: empty(),
    drops: [],
    profile: { ...profile([{ id: 2, count: 64 }]), mconline_base: ra.profile.updated_at },
  };
  await assert.rejects(() => call(alice, denied), /bilans/);
  checks++;
  const cancelled = await call(alice, { ...denied, op: 'cancel' });
  check('explicit cancel resolves a rejected operation', !cancelled.committed);
  const delayed = await call(alice, denied);
  check('cancel tombstone fences a delayed original request', !delayed.committed);
  const p2 = await save(alice, profile()),
    r2 = { ...ref, x: 8 };
  const legacy = [{ id: 102, count: 3, dur: undefined, name: 'legacy' }, ...Array(26).fill(null)];
  const imported = await call(alice, { op: 'open', ref: r2, seed: empty(), legacy });
  const importedAgain = await call(alice, { op: 'open', ref: r2, seed: empty(), legacy });
  check(
    'legacy contents are durably imported once',
    imported.slots.filter(Boolean).length === 1 && importedAgain.slots.filter(Boolean).length === 1,
  );
  const otherImport = await call(bob, {
    op: 'open',
    ref: r2,
    seed: empty(),
    legacy: [{ id: 103, count: 4 }, ...Array(26).fill(null)],
  });
  check('different prior private contents are preserved', otherImport.slots.filter(Boolean).length === 2);
  const fullRef = { ...ref, x: 12 },
    full = Array.from({ length: 27 }, () => ({ id: 1, count: 64 }));
  const pending = await call(alice, { op: 'open', ref: fullRef, seed: full, legacy });
  check(
    'full container archives rather than destroys old contents',
    pending.legacyPending && pending.slots.every((s) => s.id === 1),
  );
  const archives = await sql('select count(*)::int n from mconline_chest_imports where not done');
  check('pending import remains stored', archives.n === 1);
  const before = await call(alice, { op: 'open', ref: r2, seed: empty() });
  const destroy = {
    op: 'commit',
    id: crypto.randomUUID(),
    ref: r2,
    revision: before.revision,
    destroy: true,
    profile: { ...profile(), mconline_base: p2.updated_at },
    slots: empty(),
    drops: before.slots
      .filter(Boolean)
      .map((stack, i) => ({ uid: 'fixture-' + i, stack, pos: [8.5, 65.5, 4.5], vel: [0, 2, 0] })),
  };
  const destroyed = await call(alice, destroy);
  check(
    'destroy debits contents and writes the block in one transaction',
    destroyed.committed && destroyed.chest.destroyed,
  );
  const dropCount = (await sql('select count(*)::int n from blockcraft_drops')).n;
  await call(alice, destroy);
  check(
    'destroy retry cannot duplicate drops',
    (await sql('select count(*)::int n from blockcraft_drops')).n === dropCount,
  );
  check('destroy wrote air', (await sql('select block from blockcraft_blocks where x=8')).block === 0);
  await db.exec(`update blockcraft_blocks set block=54 where x=8`);
  const replaced = await call(alice, { op: 'open', ref: r2, seed: legacy });
  check(
    'new chest at the same position starts empty',
    !replaced.destroyed && replaced.slots.every((s) => s === null),
  );
  console.log(`${checks} shared-container PostgreSQL checks passed`);
} finally {
  await db.close();
}
