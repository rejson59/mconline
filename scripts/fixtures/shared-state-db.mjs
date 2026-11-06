import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
export async function fixtureDB() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema extensions; create function extensions.gen_random_uuid() returns uuid language sql as $$select pg_catalog.gen_random_uuid()$$;
 create table blockcraft_players(world text,pid text,name text,skin text,x float8,y float8,z float8,dim text,yaw float8,pitch float8,health float8,hunger float8,xp integer,inv text,armor text,updated_at timestamptz,primary key(world,pid));
 create table blockcraft_blocks(world text,dim text,x int,y int,z int,block int,primary key(world,dim,x,y,z));
 create table blockcraft_plots(world text,cx int,cz int,owner text);
 create table blockcraft_drops(world text,uid text,owner text,payload jsonb,expires_at timestamptz,claimed_by text,acknowledged boolean default false,primary key(world,uid));
 create function mconline_member_v2(uuid,text,text,text,text,text) returns jsonb language sql as $$select jsonb_build_object('pid','p'||left(md5($1::text),19),'username',$2,'capability',repeat(md5($1::text),2))$$;
 create function blockcraft_write_blocks(text,text,jsonb) returns jsonb language plpgsql as $$declare e jsonb; begin for e in select value from jsonb_array_elements($3) loop insert into blockcraft_blocks values($1,e->>'d',(e->>'x')::int,(e->>'y')::int,(e->>'z')::int,(e->>'id')::int) on conflict(world,dim,x,y,z) do update set block=excluded.block; end loop; return jsonb_build_object('accepted',$3,'rejected','[]'::jsonb); end $$;
 create function blockcraft_city_write_blocks(text,text,jsonb) returns jsonb language sql as $$select blockcraft_write_blocks($1,$2,$3)$$;`);
  await db.exec(
    await fs.readFile(
      new URL('../../supabase/migrations/202611060007_profile_checkpoints.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await fs.readFile(
      new URL('../../supabase/migrations/202611060008_drop_pickup_delay.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await fs.readFile(
      new URL('../../supabase/migrations/202611060009_shared_chests.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await fs.readFile(
      new URL('../../supabase/migrations/202611060010_shared_mobs.sql', import.meta.url),
      'utf8',
    ),
  );
  return db;
}
