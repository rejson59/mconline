// Real PostgreSQL WASM, real plot/city writers. Synthetic local capabilities only.
// Account gateway membership is unchanged and tested separately in CI.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const read = (name) =>
  fs.readFile(
    new URL("../supabase/migrations/" + name, import.meta.url),
    "utf8",
  );
let checks = 0;
const check = (name, value) => {
  assert.ok(value, name);
  checks++;
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table blockcraft_blocks(id bigserial primary key,world text,dim text,x int,y int,z int,block int,updated_at timestamptz, unique(world,dim,x,y,z));`);
  await db.exec(await read("202610300001_plots.sql"));
  await db.exec(await read("202611010001_builder_city.sql"));
  // Same restrictive writer privileges as the current account gateway.
  await db.exec(`revoke all on function blockcraft_write_blocks(text,text,jsonb),blockcraft_city_write_blocks(text,text,jsonb) from public,anon,authenticated;
    grant execute on function blockcraft_write_blocks(text,text,jsonb),blockcraft_city_write_blocks(text,text,jsonb) to service_role;`);
  const before = (
    await db.query(
      "select oid,proacl::text,prosecdef,proconfig from pg_proc where proname in ('blockcraft_write_blocks','blockcraft_city_write_blocks') order by oid",
    )
  ).rows;
  const migration = await read("202611070011_trapdoor_states.sql");
  const definitions = () =>
    db.query(
      "select proname,pg_get_functiondef(oid) definition from pg_proc where proname in ('blockcraft_write_blocks','blockcraft_city_write_blocks') order by oid",
    );
  const old = (await definitions()).rows;
  const a = "1".repeat(64),
    b = "2".repeat(64);
  await assert.rejects(
    db.query("select blockcraft_write_blocks($1,$2,$3)", [
      "public",
      a,
      [{ x: 16, y: 65, z: 16, d: "o", id: 518 }],
    ]),
  );
  checks++;
  await db.exec(migration);
  const after = (
    await db.query(
      "select oid,proacl::text,prosecdef,proconfig from pg_proc where proname in ('blockcraft_write_blocks','blockcraft_city_write_blocks') order by oid",
    )
  ).rows;
  assert.deepEqual(after, before);
  checks++;
  const modern = (await definitions()).rows;
  for (let i = 0; i < old.length; i++)
    check(
      "only the block ID bound changes",
      modern[i].definition ===
        old[i].definition.replace(
          "e.id not between 0 and 511",
          "e.id not between 0 and 518",
        ),
    );
  await db.exec(migration);
  assert.deepEqual((await definitions()).rows, modern);
  checks++;
  await db.query("select blockcraft_city_plot($1,$2,$3,0,0)", [
    "city",
    a,
    "claim",
  ]);
  await db.query("select blockcraft_plot($1,$2,$3,1,1)", [
    "public",
    a,
    "claim",
  ]);
  await db.exec("set role service_role");
  const write = async (city, key, edits) =>
    (
      await db.query(
        `select ${city ? "blockcraft_city_write_blocks" : "blockcraft_write_blocks"}($1,$2,$3) r`,
        [city ? "city" : "public", key, edits],
      )
    ).rows[0].r;
  for (const city of [false, true]) {
    for (let id = 503; id <= 518; id++) {
      const e = { x: 16, y: 65, z: 16, d: "o", id };
      const r = await write(city, a, [e]);
      check(
        "new state accepted by authorized plot writer",
        r.accepted.length === 1 && r.accepted[0].id === id,
      );
      const denied = await write(city, b, [{ ...e, id: 0 }]);
      check(
        "other player cannot erase new state",
        denied.accepted.length === 0 && denied.rejected[0].id === id,
      );
    }
    for (const id of [-1, 519, 65535]) {
      await assert.rejects(
        write(city, a, [{ x: 16, y: 65, z: 16, d: "o", id }]),
      );
      checks++;
    }
    const oldState = await write(city, a, [
      { x: 16, y: 65, z: 16, d: "o", id: 68 },
    ]);
    check("legacy IDs remain accepted", oldState.accepted[0].id === 68);
  }
  check(
    "city road remains protected",
    (await write(true, a, [{ x: 0, y: 65, z: 0, d: "o", id: 518 }])).accepted
      .length === 0,
  );
  check(
    "city nether remains protected",
    (await write(true, a, [{ x: 16, y: 65, z: 16, d: "n", id: 518 }])).accepted
      .length === 0,
  );
  await db.exec("set role anon");
  await assert.rejects(
    write(false, a, [{ x: 16, y: 65, z: 16, d: "o", id: 518 }]),
  );
  checks++;
  await assert.rejects(
    write(true, a, [{ x: 16, y: 65, z: 16, d: "o", id: 518 }]),
  );
  checks++;
  // Unexpected deployed definitions must abort the whole migration, including
  // any earlier writer patched in the same DO statement.
  await db.exec("reset role");
  for (const row of old) await db.exec(row.definition);
  const cityOld = old.find(
    (row) => row.proname === "blockcraft_city_write_blocks",
  );
  await db.exec(
    cityOld.definition.replace(
      "e.id not between 0 and 511",
      "e.id not between 0 and 519",
    ),
  );
  const unexpected = (await definitions()).rows;
  await assert.rejects(db.exec(migration));
  checks++;
  assert.deepEqual((await definitions()).rows, unexpected);
  checks++;
  console.log(`${checks} trapdoor-state PostgreSQL checks passed`);
} finally {
  await db.close();
}
