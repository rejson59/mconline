import assert from "node:assert/strict";
import {
  ProfileCheckpoint,
  sameProfileVersion,
} from "../src/game/profileCheckpoint";
import { sanitizeProfile, profileRow, PROFILE_KEY } from "../src/game/profile";
import { foodClockDelta } from "../src/game/hunger";
let count = 0;
const test = (name: string, fn: () => void) => {
  fn();
  count++;
  console.log("✓ " + name);
};
const pid = "p" + "a".repeat(19),
  values = new Map<string, string>();
const storage = {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => {
    values.set(k, v);
  },
  removeItem: (k: string) => {
    values.delete(k);
  },
};
const make = (n: number) =>
  sanitizeProfile({
    pid,
    x: 3,
    y: 70,
    z: 5,
    inv: [{ id: 1, count: n }],
    armor: [],
    updated: n,
    health: 12,
    hunger: 20,
  })!;
const remote = {
  ...profileRow(make(1), "public"),
  updated_at: "2026-11-06T10:00:00.000001+00:00",
  save_id: "initial",
};
test("ordinary remote read cannot silently replace an unacknowledged inventory", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  c.load(remote);
  c.stage(make(2));
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(remote)!.inv[0]!.count,
    2,
  );
});
test("recovered writes compare the exact server version, not browser clocks", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  const p = c.load(remote)!;
  const r = c.row(p);
  assert.equal(r.mconline_base, remote.updated_at);
  assert.equal(r.mconline_guard, true);
  assert.equal(r.pid, pid);
});
test("lost response to an older in-flight write still preserves the newer queued inventory", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  c.load(remote);
  c.stage(make(3));
  const r = c.row(make(3));
  c.stage(make(4));
  const committed = {
    ...profileRow(make(3), "public"),
    updated_at: "2026-11-06T10:00:00.000002+00:00",
    save_id: r.mconline_save,
  };
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(committed)!.inv[0]!
      .count,
    4,
  );
});
test("a truly changed remote inventory is never overwritten by stale local recovery", () => {
  const key = `${PROFILE_KEY}:public:${pid}:pending`,
    before = values.get(key);
  const changed = {
    ...remote,
    updated_at: "2099-01-01T00:00:00Z",
    save_id: "other-device",
  };
  const c = new ProfileCheckpoint("public", pid, storage);
  assert.equal(c.load(changed)!.inv[0]!.count, 1);
  assert.equal(c.recoveries()[0].pending, before);
  assert.deepEqual(c.recoveries()[0].remote, changed);
  assert.equal(values.has(key), false);
  assert.ok(c.recoveryNotice?.includes("/kopie"));
  c.stage(make(9));
  assert.equal(c.row(make(9)).mconline_base, changed.updated_at);
  assert.equal(c.recoveries()[0].pending, before);
});
values.clear();
test("acknowledging a write does not clear a newer queued snapshot", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  c.load(remote);
  c.stage(make(5));
  c.row(make(5));
  c.stage(make(6));
  const ack = { ...remote, updated_at: "2026-11-06T10:00:01+00:00" };
  c.acknowledge(ack, make(5));
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(ack)!.inv[0]!.count,
    6,
  );
});
test("a successful final acknowledgement clears only its own pending journal", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  const p = c.load({ ...remote, updated_at: "2026-11-06T10:00:01+00:00" })!;
  const row = c.row(p);
  const ack = {
    ...row,
    updated_at: "2026-11-06T10:00:02+00:00",
    save_id: row.mconline_save,
  };
  c.acknowledge(ack, p);
  assert.equal(values.has(`${PROFILE_KEY}:public:${pid}:pending`), false);
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(ack)!.inv[0]!.count,
    6,
  );
});
test("world and owner journals cannot leak into one another", () => {
  const c = new ProfileCheckpoint("public", pid, storage);
  c.load(remote);
  c.stage(make(8));
  assert.equal(new ProfileCheckpoint("city", pid, storage).load(null), null);
  assert.equal(
    new ProfileCheckpoint("public", "p" + "b".repeat(19), storage).load(null),
    null,
  );
});
test("corrupt inventory JSON fails closed rather than producing an empty inventory", () => {
  for (const inv of ["{bad", "null", "{}", null])
    assert.equal(sanitizeProfile({ ...remote, inv }), null);
  assert.equal(sanitizeProfile({ ...remote, armor: "bad" }), null);
  assert.ok(sanitizeProfile({ ...remote, inv: "[]", armor: "[]" }));
});
test("quota failure is reported and cloud version checks remain available", () => {
  const c = new ProfileCheckpoint("public", pid, {
    ...storage,
    getItem: () => null,
    setItem() {
      throw Error("quota");
    },
  });
  c.load(remote);
  assert.equal(c.stage(make(9)), false);
  assert.equal(c.row(make(9)).mconline_base, remote.updated_at);
});
test("invalid pending journal is preserved, not silently replaced", () => {
  const key = `${PROFILE_KEY}:public:${pid}:pending`;
  values.set(key, "{bad");
  const c = new ProfileCheckpoint("public", pid, storage);
  assert.equal(c.stage(make(9)), false);
  assert.throws(() => c.row(make(9)));
  assert.equal(values.get(key), "{bad");
  assert.equal(c.load(remote)!.inv[0]!.count, 1);
  assert.equal(c.recoveries().at(-1)!.pending, "{bad");
});
function fresh() {
  values.clear();
  return new ProfileCheckpoint("public", pid, storage);
}
test("two snapshots in one millisecond cannot acknowledge away newer items", () => {
  const c = fresh();
  c.load(remote);
  const old = make(2),
    next = make(3);
  next.updated = old.updated;
  c.stage(old);
  const row = c.row(old);
  c.stage(next);
  const ack = {
    ...profileRow(old, "public"),
    updated_at: "2026-11-06T10:01:00Z",
    save_id: row.mconline_save,
  };
  c.acknowledge(ack, old);
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(ack)!.inv[0]!.count,
    3,
  );
});
test("clock rollback does not erase a newer queued snapshot", () => {
  const c = fresh();
  c.load(remote);
  const old = make(2),
    next = make(3);
  next.updated = 1;
  c.stage(old);
  c.row(old);
  c.stage(next);
  const ack = { ...remote, updated_at: "2026-11-06T10:01:00Z" };
  c.acknowledge(ack, old);
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(ack)!.inv[0]!.count,
    3,
  );
});
test("final exit row after an ACK persists its intent before an uncertain response", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(2));
  const first = c.row(make(2));
  const ack = {
    ...profileRow(make(2), "public"),
    updated_at: "2026-11-06T10:01:00Z",
    save_id: first.mconline_save,
  };
  c.acknowledge(ack, make(2));
  const exit = c.row(make(3)),
    committed = {
      ...exit,
      updated_at: "2026-11-06T10:02:00Z",
      save_id: exit.mconline_save,
    };
  const resumed = new ProfileCheckpoint("public", pid, storage);
  assert.equal(resumed.load(committed)!.inv[0]!.count, 3);
  assert.equal(resumed.recoveries().length, 0);
});
test("shared transaction rows do not stage speculative inventory outside their WAL", () => {
  const c = fresh();
  c.load(remote);
  c.row(make(7), false);
  assert.equal(values.size, 0);
  assert.equal(
    new ProfileCheckpoint("public", pid, storage).load(remote)!.inv[0]!.count,
    1,
  );
});
test("equivalent timestamp spellings are equal without losing microseconds", () => {
  assert.ok(
    sameProfileVersion(
      "2026-11-06T10:00:00.000001+00:00",
      "2026-11-06T11:00:00.000001+01:00",
    ),
  );
  assert.ok(
    sameProfileVersion(
      "2026-11-06T10:00:00.120000+00:00",
      "2026-11-06T10:00:00.12Z",
    ),
  );
  assert.ok(
    !sameProfileVersion(remote.updated_at, "2026-11-06T10:00:00.000002Z"),
  );
  assert.ok(!sameProfileVersion(null, remote.updated_at));
  assert.ok(!sameProfileVersion("bad", "worse"));
  const c = fresh();
  c.load(remote);
  c.stage(make(3));
  const resumed = new ProfileCheckpoint("public", pid, storage);
  assert.equal(
    resumed.load({ ...remote, updated_at: "2026-11-06T10:00:00.000001Z" })!
      .inv[0]!.count,
    3,
  );
  assert.equal(resumed.recoveries().length, 0);
});
test("a genuine one-microsecond conflict selects remote only after archiving local", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(3));
  const resumed = new ProfileCheckpoint("public", pid, storage);
  assert.equal(
    resumed.load({ ...remote, updated_at: "2026-11-06T10:00:00.000002Z" })!
      .inv[0]!.count,
    1,
  );
  assert.equal(resumed.recoveries().length, 1);
});
test("archive preserves exact bytes, unknown fields and both branches", () => {
  fresh();
  const key = `${PROFILE_KEY}:public:${pid}:pending`,
    original = JSON.stringify({
      profile: { ...make(8), future: { items: "do not strip" } },
      base: "old-version",
      sent: [],
      future: "root field",
    });
  values.set(key, original);
  const c = new ProfileCheckpoint("public", pid, storage);
  c.load(remote);
  const exported = JSON.parse(c.exportRecoveries().json);
  assert.equal(exported.copies[0].pending, original);
  assert.deepEqual(exported.copies[0].remote, remote);
  assert.equal(exported.pid, pid);
  assert.equal(exported.world, "public");
});
test("invalid server data is not mistaken for an empty or recoverable profile", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const before = [...values];
  for (const raw of [
    { ...remote, inv: "broken" },
    { ...remote, pid: "wrong" },
    { ...remote, updated_at: null },
  ])
    assert.throws(() =>
      new ProfileCheckpoint("public", pid, storage).load(raw),
    );
  assert.deepEqual([...values], before);
});
test("missing inventory columns are not treated as an empty remote inventory", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const before = [...values];
  for (const missing of ["inv", "armor"]) {
    const raw: any = { ...remote };
    delete raw[missing];
    assert.throws(() =>
      new ProfileCheckpoint("public", pid, storage).load(raw),
    );
  }
  assert.deepEqual([...values], before);
});
test("incomplete local profile is archived rather than restored as empty slots", () => {
  fresh();
  const key = `${PROFILE_KEY}:public:${pid}:pending`;
  values.set(
    key,
    JSON.stringify({
      profile: { ...make(8), inv: undefined },
      base: remote.updated_at,
      sent: [],
    }),
  );
  const c = new ProfileCheckpoint("public", pid, storage);
  assert.equal(c.load(remote)!.inv[0]!.count, 1);
  assert.equal(c.recoveries()[0].reason, "invalid-pending");
});
test("missing server profile archives an old branch rather than resurrecting it", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const resumed = new ProfileCheckpoint("public", pid, storage);
  assert.equal(resumed.load(null), null);
  assert.equal(resumed.recoveries().length, 1);
  assert.equal(resumed.row(make(1)).mconline_base, null);
});
test("archive failure never deletes or rebases the only local copy", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const before = [...values];
  const broken = {
    ...storage,
    setItem() {
      throw Error("quota");
    },
  };
  const resumed = new ProfileCheckpoint("public", pid, broken);
  assert.throws(
    () => resumed.load({ ...remote, updated_at: "2099-01-01T00:00:00Z" }),
    /Oryginalna kopia/,
  );
  assert.deepEqual([...values], before);
  assert.equal(resumed.row(make(8)).mconline_base, remote.updated_at);
});
test("a silently ignored archive write is not treated as a durable backup", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const before = [...values];
  const resumed = new ProfileCheckpoint("public", pid, {
    ...storage,
    setItem() {},
  });
  assert.throws(() =>
    resumed.load({ ...remote, updated_at: "2099-01-01T00:00:00Z" }),
  );
  assert.deepEqual([...values], before);
});
test("corrupt archive cannot be overwritten by a new recovery", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  values.set(c.recoveryKey, "broken");
  const before = [...values];
  assert.throws(() =>
    new ProfileCheckpoint("public", pid, storage).load({
      ...remote,
      updated_at: "2099-01-01T00:00:00Z",
    }),
  );
  assert.deepEqual([...values], before);
});
test("failed journal removal does not duplicate archives or lose the retained branch", () => {
  const c = fresh();
  c.load(remote);
  c.stage(make(8));
  const noRemove = {
      ...storage,
      removeItem() {
        throw Error("readonly remove");
      },
    },
    changed = { ...remote, updated_at: "2099-01-01T00:00:00Z" };
  new ProfileCheckpoint("public", pid, noRemove).load(changed);
  const resumed = new ProfileCheckpoint("public", pid, noRemove);
  resumed.load(changed);
  assert.equal(resumed.recoveries().length, 1);
  const backup = resumed.recoveries()[0].pending;
  resumed.stage(make(9));
  assert.equal(resumed.recoveries()[0].pending, backup);
});
test("recovery archives remain isolated per server and verified PID", () => {
  assert.equal(
    new ProfileCheckpoint("city", pid, storage).exportRecoveries().count,
    0,
  );
  assert.equal(
    new ProfileCheckpoint(
      "public",
      "p" + "b".repeat(19),
      storage,
    ).exportRecoveries().count,
    0,
  );
});
test("visible regeneration clock is independent of the 100ms physics cap", () => {
  for (const fps of [2, 5, 10, 20, 30, 60, 144]) {
    let seconds = 0;
    for (let i = 0; i < fps * 4; i++) seconds += foodClockDelta(1000 / fps);
    assert.ok(Math.abs(seconds - 4) < 1e-8);
  }
});
test("hidden tabs and invalid/stalled frames cannot bank unlimited healing", () => {
  assert.equal(foodClockDelta(60000, true), 0);
  assert.equal(foodClockDelta(60000), 1);
  assert.equal(foodClockDelta(NaN), 0);
  assert.equal(foodClockDelta(-1), 0);
});
console.log(`${count} inventory checkpoint/food clock checks passed`);
