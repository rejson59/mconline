-- Separate additive city RPCs. Survival's functions, seed and writes are unchanged.
-- 48-block grid: protected 16-block avenues + private 32x32 parcels.
-- Cells -16..15 on each axis (1024 plots); at most 4 per capability.
-- Releasing a parcel intentionally lets its next owner edit the remaining build.
-- Keep constants in src/game/city.ts synchronized. All block mutation paths must
-- use this capability-checked writer; direct table DML remains revoked.
create or replace function public.blockcraft_city_plot(p_world text, p_key text, p_op text, p_cx integer default 0, p_cz integer default 0, p_name text default 'Gracz')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor text; existing text; rows jsonb;
begin
  if p_world is distinct from 'city' or p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy klucz działek.'; end if;
  actor := encode(sha256(convert_to(p_key,'UTF8')), 'hex');
  if p_op is distinct from 'list' then
    if p_cx is null or p_cz is null or p_cx not between -16 and 15 or p_cz not between -16 and 15 then raise exception 'Działka poza granicami świata.'; end if;
    -- Same lock as block writes: claim/check/write cannot race each other.
    perform pg_advisory_xact_lock(hashtextextended('blockcraft-plots:' || p_world,0));
    select owner into existing from public.blockcraft_plots where world=p_world and cx=p_cx and cz=p_cz;
    if p_op='claim' then
      if existing is not null then raise exception 'Działka jest już zajęta.'; end if;
      if (select count(*) from public.blockcraft_plots where world=p_world and owner=actor)>=4 then raise exception 'Limit czterech działek.'; end if;
      insert into public.blockcraft_plots(world,cx,cz,owner,name) values(p_world,p_cx,p_cz,actor,left(coalesce(p_name,'Gracz'),20));
    elsif p_op='release' then
      if existing is distinct from actor then raise exception 'To nie jest twoja działka.'; end if;
      delete from public.blockcraft_plots where world=p_world and cx=p_cx and cz=p_cz;
    else raise exception 'Nieznana operacja działki.';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('cx',cx,'cz',cz,'owner',owner,'name',name)), '[]'::jsonb) into rows from public.blockcraft_plots where world=p_world;
  return jsonb_build_object('owner',actor,'plots',rows);
end $$;

create or replace function public.blockcraft_city_write_blocks(p_world text, p_key text, p_edits jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor text; e record; owner_hash text; old_id integer; rev bigint; accepted jsonb := '[]'; rejected jsonb := '[]';
begin
  if p_world is distinct from 'city' or p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy klucz działek.'; end if;
  if p_edits is null or jsonb_typeof(p_edits) <> 'array' or jsonb_array_length(p_edits)>300 then raise exception 'Nieprawidłowa paczka bloków.'; end if;
  actor := encode(sha256(convert_to(p_key,'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('blockcraft-plots:' || p_world,0));
  for e in select * from jsonb_to_recordset(p_edits) as r(x integer,y integer,z integer,id integer,d text) loop
    if e.x is null or e.y is null or e.z is null or e.id is null or e.d is null or e.d not in ('o','n') or e.y not between 0 and 255 or abs(e.x::bigint)>31999999 or abs(e.z::bigint)>31999999 or e.id not between 0 and 511 then raise exception 'Nieprawidłowy blok.'; end if;
    owner_hash := null;
    if e.d='o' then select owner into owner_hash from public.blockcraft_plots where world=p_world and cx=floor(e.x/48.0)::integer and cz=floor(e.z/48.0)::integer; end if;
    if e.d<>'o' or e.y not between 1 and 127 or floor(e.x/48.0) not between -16 and 15 or floor(e.z/48.0) not between -16 and 15 or ((e.x%48)+48)%48<16 or ((e.z%48)+48)%48<16 or owner_hash is distinct from actor then
      old_id := null;
      select block into old_id from public.blockcraft_blocks where world=p_world and dim=e.d and x=e.x and y=e.y and z=e.z;
      rejected := rejected || jsonb_build_array(jsonb_build_object('x',e.x,'y',e.y,'z',e.z,'id',old_id,'d',e.d));
    else
      rev := nextval('public.blockcraft_block_versions');
      insert into public.blockcraft_blocks(world,dim,x,y,z,block,builder,version,updated_at) values(p_world,e.d,e.x,e.y,e.z,e.id,actor,rev,clock_timestamp())
      on conflict(world,dim,x,y,z) do update set block=excluded.block,builder=excluded.builder,version=excluded.version,updated_at=excluded.updated_at;
      accepted := accepted || jsonb_build_array(jsonb_build_object('x',e.x,'y',e.y,'z',e.z,'id',e.id,'d',e.d,'version',rev));
    end if;
  end loop;
  return jsonb_build_object('accepted',accepted,'rejected',rejected);
end $$;
revoke all on function public.blockcraft_city_plot(text,text,text,integer,integer,text) from public;
revoke all on function public.blockcraft_city_write_blocks(text,text,jsonb) from public;
grant execute on function public.blockcraft_city_plot(text,text,text,integer,integer,text) to anon, authenticated;
grant execute on function public.blockcraft_city_write_blocks(text,text,jsonb) to anon, authenticated;
