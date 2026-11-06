import assert from 'node:assert/strict';
import { fixtureDB } from './fixtures/shared-state-db.mjs';
const db = await fixtureDB(),
  alice = crypto.randomUUID(),
  bob = crypto.randomUUID(),
  session = crypto.randomUUID();
const refs = [
  { d: 'o', x: 0, z: 0 },
  { d: 'o', x: -1, z: 0 },
];
const profile = () => ({
  inv: JSON.stringify(Array(52).fill(null)),
  armor: '[]',
  x: 64,
  y: 65,
  z: 64,
  health: 20,
  hunger: 20,
});
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const save = async (a) =>
  (
    await one('select mconline_profile($1,$2,$3,$4,$5,false,null,null,false)->0 p', [
      a,
      'Fixture',
      session,
      'public',
      profile(),
    ])
  ).p;
const exchange = async (a, updates = [], regions = refs, pos = { d: 'o', x: 64, y: 65, z: 64 }) =>
  (
    await one('select mconline_mobs($1,$2,$3,$4,$5) r', [
      a,
      'Fixture',
      session,
      'public',
      { updates, regions, position: pos },
    ])
  ).r;
const action = async (a, p) =>
  (await one('select mconline_mob_action($1,$2,$3,$4,$5) r', [a, 'Fixture', session, 'public', p])).r;
const snapshot = (id = crypto.randomUUID()) => ({
  id,
  type: 'pig',
  variant: 'temperate',
  pos: [64, 65, 64],
  vel: [0, 0, 0],
  home: [64, 65, 64],
  state: { health: 10, dead: false, looted: false },
  trade: null,
});
const update = (r, extra = {}) => ({ ...r, drops: [], hits: [], edits: [], ...extra });
let checks = 0;
const check = (label, yes) => {
  assert.ok(yes, label);
  checks++;
};
try {
  const pa = await save(alice),
    pb = await save(bob);
  let a = await exchange(alice);
  const pidA = a.regions[0].owner;
  let b = await exchange(bob, [], refs, { d: 'o', x: 65, y: 65, z: 64 });
  check(
    'nearby viewers have exactly one coordinator',
    b.regions.every((r, i) => r.owner === a.regions[i].owner),
  );
  const initial = a.regions.map((r, i) => update(r, { mobs: [snapshot('entity-' + i)] }));
  a = await exchange(alice, initial);
  b = await exchange(bob, [], refs, { d: 'o', x: 65, y: 65, z: 64 });
  check(
    'both clients read the same IDs/positions/health',
    JSON.stringify(a.regions.map((r) => r.mobs)) === JSON.stringify(b.regions.map((r) => r.mobs)),
  );
  const notOwner = b.regions.map((r) => update(r, { mobs: [] }));
  b = await exchange(bob, notOwner, refs, { d: 'o', x: 65, y: 65, z: 64 });
  check(
    'a follower cannot publish a private population',
    b.regions.every((r) => r.mobs.length === 1),
  );
  const before = a.regions[0],
    corpse = structuredClone(before.mobs);
  corpse[0].state = { health: 0, dead: true, looted: true };
  const drop = (id, uid) => ({ uid, stack: { id, count: 1 }, pos: [64, 65, 64], vel: [0, 2, 0] });
  const kill = {
    op: 'commit',
    id: crypto.randomUUID(),
    ref: { ...refs[0], y: 0 },
    revision: before.revision,
    mobs: corpse,
    drops: [drop(112, 'meat-once'), drop(65535, 'xp-once')],
    profile: { ...profile(), mconline_base: pb.updated_at },
  };
  const killed = await action(bob, kill);
  check('follower attacks the canonical entity', killed.committed && killed.region.mobs[0].state.dead);
  const replay = await action(bob, kill);
  check('lost kill ACK is idempotent', replay.committed && replay.region.revision === killed.region.revision);
  check(
    'kill and XP have one durable drop each',
    (await one('select count(*)::int n from blockcraft_drops')).n === 2,
  );
  a = await exchange(
    alice,
    a.regions.map((r) =>
      update(r, { mobs: [snapshot('should-not-resurrect')], drops: [drop(112, 'stale-loot')] }),
    ),
  );
  check(
    'a stale AI tick never resurrects a killed mob',
    a.regions[0].mobs[0].id === 'entity-0' && a.regions[0].mobs[0].state.dead,
  );
  check(
    'multi-region tick rejects every region when one CAS is stale',
    a.regions[1].mobs[0].id === 'entity-1',
  );
  check(
    'stale AI tick cannot publish additional loot',
    (await one('select count(*)::int n from blockcraft_drops')).n === 2,
  );
  const oldEpoch = a.regions[0].epoch;
  await db.exec(
    "update mconline_mob_regions set lease_until=now()-interval '1 second';update mconline_mob_viewers set seen=now()-interval '4 seconds'",
  );
  b = await exchange(bob, [], refs, { d: 'o', x: 65, y: 65, z: 64 });
  check(
    'disconnect transfers ownership with a new epoch',
    b.regions[0].owner !== pidA && b.regions[0].epoch > oldEpoch,
  );
  check(
    'handoff preserves death/loot tombstone and identity',
    b.regions[0].mobs[0].id === 'entity-0' && b.regions[0].mobs[0].state.looted,
  );
  await exchange(
    alice,
    a.regions.map((r) => update(r, { mobs: [], drops: [drop(112, 'fenced-loot')] })),
    [{ d: 'o', x: 3, z: 0 }],
    { d: 'o', x: 400, y: 65, z: 64 },
  );
  check(
    'old coordinator cannot mutate after handoff',
    (await one('select mobs from mconline_mob_regions where x=0 and z=0')).mobs.length === 1,
  );
  check(
    'old coordinator cannot duplicate loot after handoff',
    (await one('select count(*)::int n from blockcraft_drops')).n === 2,
  );
  const aborted = {
    ...kill,
    id: crypto.randomUUID(),
    revision: b.regions[0].revision,
    profile: { ...profile(), mconline_base: killed.profile.updated_at },
  };
  const cancellation = await action(bob, { ...aborted, op: 'cancel' });
  check('interrupted interaction can be fenced', !cancellation.committed);
  check('delayed original cannot overwrite after cancel', !(await action(bob, aborted)).committed);
  await assert.rejects(
    () => exchange(bob, [], [{ d: 'n', x: 0, z: 0 }], { d: 'o', x: 65, z: 64 }),
    /Poza światem/,
  );
  checks++;
  await assert.rejects(
    () =>
      exchange(bob, [update(b.regions[0], { mobs: [snapshot('duplicate'), snapshot('duplicate')] })], refs, {
        d: 'o',
        x: 65,
        z: 64,
      }),
    /Powtórzone/,
  );
  checks++;
  // A chest explosion is committed with simulation state, never first to the
  // coordinator's private inventory and never re-spilled after a lost reply.
  await db.query("insert into mconline_chests(world,dim,x,y,z,slots) values('public','o',70,65,64,$1)", [
    JSON.stringify([{ id: 1, count: 3 }, ...Array(26).fill(null)]),
  ]);
  const current = (await exchange(bob, [], refs, { d: 'o', x: 65, z: 64 })).regions;
  const boom = update(current[0], { edits: [{ d: 'o', x: 70, y: 65, z: 64, id: 0, chestSeed: [] }] });
  await exchange(bob, [boom], refs, { d: 'o', x: 65, z: 64 });
  check(
    'explosion atomically empties the canonical chest',
    (await one('select destroyed from mconline_chests where x=70')).destroyed,
  );
  check(
    'explosion contents are one shared ground drop',
    (await one('select count(*)::int n from blockcraft_drops')).n === 3,
  );
  const replayTerrain = await exchange(bob, [boom], refs, { d: 'o', x: 65, z: 64 });
  check('lost terrain ACK replay returns canonical air for private-cache reconciliation',replayTerrain.edits.some(e=>e.x===70&&e.id===0));
  check(
    'explosion replay cannot spill twice',
    (await one('select count(*)::int n from blockcraft_drops')).n === 3,
  );
  check(
    'explosion removes the physical chest',
    (await one('select block from blockcraft_blocks where x=70')).block === 0,
  );
  console.log(`${checks} shared-mob PostgreSQL checks passed`);
} finally {
  await db.close();
}
