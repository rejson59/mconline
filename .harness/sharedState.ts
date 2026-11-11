import assert from "node:assert/strict";
import { StateJournal, type StateTransaction } from "../src/game/sharedState";
import { cleanDrop, DROP_LIFETIME } from "../src/game/sharedDrops";
import { Mob } from "../src/game/mobs";
import { World } from "../src/game/world";
const ctx: any = new Proxy(
  {
    canvas: { width: 16, height: 16 },
    getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  },
  { get: (o, k) => o[k] ?? (() => {}) },
);
Object.assign(globalThis, {
  document: {
    createElement: () => ({
      width: 16,
      height: 16,
      getContext: () => ctx,
      toDataURL: () => "data:,",
    }),
  },
});
let checks = 0;
const test = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log("✓ " + name);
};
const values = new Map<string, string>();
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => {
    values.set(k, v);
  },
  removeItem: (k: string) => {
    values.delete(k);
  },
};
const tx: StateTransaction = {
  id: crypto.randomUUID(),
  ref: { d: "o", x: 1, y: 65, z: 1 },
  revision: 4,
  slots: Array(27).fill(null),
  profile: { inv: "[]" },
  drops: [],
};
const journal = new StateJournal("public", "fixture", storage);
test("journal is written before a request and survives a new instance", () => {
  journal.write(tx);
  assert.deepEqual(new StateJournal("public", "fixture", storage).read(), tx);
});
test("another action cannot replace an uncertain operation", () => {
  assert.throws(() => journal.write({ ...tx, id: crypto.randomUUID() }));
  assert.deepEqual(journal.read(), tx);
});
test("corrupt journal fails closed without deleting evidence", () => {
  storage.setItem(journal.key, "broken");
  assert.throws(() => journal.read());
  assert.equal(storage.getItem(journal.key), "broken");
});
test("invalid journal coordinates/version/id fail closed without deletion", () => {
  for (const bad of [
    { ...tx, id: "bad" },
    { ...tx, kind: "unsupported" },
    { ...tx, revision: -1 },
    { ...tx, ref: { ...tx.ref, x: null } },
    { ...tx, profile: [] },
  ]) {
    const text = JSON.stringify(bad);
    storage.setItem(journal.key, text);
    assert.throws(() => journal.read());
    assert.equal(storage.getItem(journal.key), text);
  }
});
test("storage denial blocks a transfer before sending", () => {
  assert.throws(
    () =>
      new StateJournal("public", "fixture", {
        ...storage,
        getItem: () => null,
        setItem() {
          throw Error("denied");
        },
      }).write(tx),
    /denied/,
  );
});
test("world/account journals never collide", () => {
  assert.notEqual(
    journal.key,
    new StateJournal("city", "fixture", storage).key,
  );
  assert.notEqual(
    journal.key,
    new StateJournal("public", "other", storage).key,
  );
  journal.clear();
});
test("shared XP is accepted only through the shared-drop protocol", () => {
  const now = Date.now();
  const xp = cleanDrop({
    uid: "xp-once",
    owner: "fixture",
    d: "o",
    stack: { id: 65535, count: 4 },
    pos: [1, 65, 1],
    vel: [0, 2, 0],
    created: now,
    expires: now + DROP_LIFETIME,
  });
  assert.equal(xp?.stack.count, 4);
  assert.equal(cleanDrop({ ...xp, stack: { id: 65535, count: 65 } }), null);
});
test("mob state handoff preserves identity, HP, velocity, home, wool and AI timers", () => {
  const a = new Mob("sheep", 2, 65, 3);
  a.netId = "shared-id";
  a.health = 2;
  a.body.vel.set(1, 2, 3);
  a.aiTimer = 1.25;
  a.shear();
  const s = a.snapshot();
  const b = new Mob(
    "sheep",
    30,
    65,
    40,
    0,
    s.variant,
    s.state.woolColor as number,
  );
  b.restoreSnapshot(s);
  assert.equal(b.netId, a.netId);
  assert.equal(b.health, 2);
  assert.equal(b.sheared, true);
  assert.equal(b.woolColor, a.woolColor);
  assert.deepEqual(b.body.vel.toArray(), [1, 2, 3]);
  assert.deepEqual(b.home.toArray(), [2, 65, 3]);
  assert.equal(b.aiTimer, 1.25);
});
test("taming/death/loot tombstones survive handoff without a new loot roll", () => {
  const a = new Mob("wolf", 2, 65, 3);
  a.netId = "wolf-id";
  a.tame();
  a.dead = true;
  a.looted = true;
  const s = a.snapshot();
  const b = new Mob("wolf", 2, 65, 3);
  b.restoreSnapshot(s);
  assert.ok(b.tamed && b.dead && b.looted);
  assert.equal(b.netId, "wolf-id");
});
test("villager stock/level is canonical, not copied by object reference", () => {
  const a = new Mob("villager", 2, 65, 3);
  a.netId = "villager-id";
  const s = a.snapshot();
  const b = new Mob("villager", 2, 65, 3);
  b.restoreSnapshot(s);
  assert.deepEqual(b.trade, a.trade);
  assert.notEqual(b.trade, a.trade);
});
test("network scalar restoration cannot overwrite a body, model or prototype", () => {
  const a = new Mob("pig", 2, 65, 3),
    s = a.snapshot();
  s.state.body = "corruption";
  s.state.group = "corruption";
  s.state.constructor = "corruption";
  a.restoreSnapshot(s);
  assert.ok(a.body.pos);
  assert.ok(a.group.isGroup);
  assert.equal(typeof a.constructor, "function");
});
test("primed TNT is a persistent entity with a fenced fuse, not a private local timer", () => {
  const a = new Mob("creeper", 2, 65, 3);
  a.netId = "tnt-id";
  a.isTnt = true;
  a.primeFuse = 0.1;
  const s = a.snapshot();
  const b = new Mob("creeper", 2, 65, 3);
  b.restoreSnapshot(s);
  assert.equal(b.damage(100, 0, 0), false);
  const world = new World(1, true);
  world.getChunk(0, 0); // A loaded scene, not an ungenerated world.
  b.update(
    0.2,
    world,
    b.body.pos,
    () => {},
    () => {},
    false,
  );
  assert.ok(b.dead && b.exploded);
  assert.equal(b.netId, "tnt-id");
});

// Real PublicServer protocol, synthetic RPC transport: an exception is NOT an
// abort, and leaving during ambiguity must not upload the old inventory.
const { PublicServer } = await import("../src/game/online");
Object.assign(globalThis, { localStorage: storage });
{
  const pid = "p" + "a".repeat(19);
  let writes = 0;
  const client: any = {
    from: () => ({
      upsert: async () => {
        writes++;
        return { data: [], error: null };
      },
    }),
  };
  const net: any = new PublicServer({
    name: "Fixture",
    pid,
    id: pid,
    accountBound: true,
    client,
  });
  net.stateJournal.write(tx);
  net.stateBusy = true;
  net.lastProfile = { pid };
  net.close();
  await Promise.resolve();
  await Promise.resolve();
  test("exit during uncertainty never uploads a pre-transaction profile", () => {
    assert.equal(writes, 0);
    assert.equal(net.stateJournal.read().id, tx.id);
  });
  net.stateJournal.clear();
  test('failed local preflight unlocks only when no uncertain journal exists',()=>{
    net.stateBusy=true;net.abortPreparedSharedAction();assert.equal(net.stateBusy,false);
    net.stateJournal.write(tx);net.stateBusy=true;net.abortPreparedSharedAction();
    assert.equal(net.stateBusy,true);assert.equal(net.stateJournal.read().id,tx.id);
    net.stateJournal.clear();
  });
  let calls = 0;
  const ops: string[] = [];
  const raw = {
    pid,
    world: "public",
    name: "Fixture",
    inv: "[]",
    armor: "[]",
    x: 1,
    y: 65,
    z: 1,
    health: 20,
    hunger: 20,
    xp: 0,
    updated_at: "2026-11-06T21:00:00.000001Z",
  };
  const retryClient: any = {
    rpc: async (_name: string, args: any) => {
      assert.equal(args.id, tx.id);
      assert.deepEqual(args.slots, tx.slots);
      ops.push(args.op);
      if (++calls === 1) throw Error("Transport threw AFTER sending");
      return {
        data: {
          committed: true,
          profile: raw,
          chest: { ...tx.ref, revision: 5, slots: tx.slots, destroyed: false },
        },
        error: null,
      };
    },
  };
  const retry: any = new PublicServer({
    name: "Fixture",
    pid,
    id: pid,
    accountBound: true,
    client: retryClient,
  });
  retry.stateJournal.write(tx);
  const result = await retry.resolveState({
    ...tx,
    slots: [{ id: 1, count: 64 }],
  });
  test("thrown/ambiguous transport resolves through a same-ID cancel fence", () => {
    assert.deepEqual(ops, ["commit", "cancel"]);
    assert.equal(result.committed, true);
    assert.equal(retry.stateBusy, false);
    assert.equal(retry.stateJournal.read(), null);
  });
}
console.log(
  `${checks} total shared-state model/journal/transport checks passed`,
);
