-- Public building rights are capabilities, not the spoofable nickname/pid.
-- Private keys never leave RPC arguments. Public rows contain only SHA-256.
alter table public.blockcraft_blocks add column if not exists builder text;
create sequence if not exists public.blockcraft_block_versions;
alter table public.blockcraft_blocks add column if not exists version bigint not null default nextval('public.blockcraft_block_versions');
create index if not exists blockcraft_blocks_version on public.blockcraft_blocks(world, version);
create table if not exists public.blockcraft_plots (
  world text not null, cx integer not null, cz integer not null,
  owner text not null check (owner ~ '^[a-f0-9]{64}$'),
  name text not null check (length(name) <= 20),
  created_at timestamptz not null default now(), primary key(world,cx,cz)
);
alter table public.blockcraft_plots enable row level security;
create policy plots_read on public.blockcraft_plots for select to anon, authenticated using (true);
grant select on public.blockcraft_plots to anon, authenticated;
-- Old direct writes must NOT be an alternative around the protected RPC.
revoke insert, update, delete on public.blockcraft_blocks from anon, authenticated;
revoke all on public.blockcraft_plots from anon, authenticated;
grant select on public.blockcraft_plots to anon, authenticated;

create or replace function public.blockcraft_plot(p_world text, p_key text, p_op text, p_cx integer default 0, p_cz integer default 0, p_name text default 'Gracz')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor text; existing text; rows jsonb;
begin
  if p_world is distinct from 'public' or p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy klucz działek.'; end if;
  actor := encode(sha256(convert_to(p_key,'UTF8')), 'hex');
  if p_op is distinct from 'list' then
    if p_cx is null or p_cz is null or abs(p_cx::bigint)>1999999 or abs(p_cz::bigint)>1999999 then raise exception 'Działka poza granicami świata.'; end if;
    -- Same lock as block writes: claim/check/write cannot race each other.
    perform pg_advisory_xact_lock(hashtextextended('blockcraft-plots:' || p_world,0));
    select owner into existing from public.blockcraft_plots where world=p_world and cx=p_cx and cz=p_cz;
    if p_op='claim' then
      if existing is not null then raise exception 'Działka jest już zajęta.'; end if;
      if (select count(*) from public.blockcraft_plots where world=p_world and owner=actor)>=4 then raise exception 'Limit czterech działek.'; end if;
      if exists(select 1 from public.blockcraft_blocks where world=p_world and dim='o' and x between p_cx*16 and p_cx*16+15 and z between p_cz*16 and p_cz*16+15 and builder is distinct from actor) then raise exception 'Teren zawiera cudze lub starsze budowle. Wybierz wolne miejsce.'; end if;
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

create or replace function public.blockcraft_write_blocks(p_world text, p_key text, p_edits jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare actor text; e record; owner_hash text; old_id integer; rev bigint; accepted jsonb := '[]'; rejected jsonb := '[]';
begin
  if p_world is distinct from 'public' or p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy klucz działek.'; end if;
  if p_edits is null or jsonb_typeof(p_edits) <> 'array' or jsonb_array_length(p_edits)>300 then raise exception 'Nieprawidłowa paczka bloków.'; end if;
  actor := encode(sha256(convert_to(p_key,'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('blockcraft-plots:' || p_world,0));
  for e in select * from jsonb_to_recordset(p_edits) as r(x integer,y integer,z integer,id integer,d text) loop
    if e.x is null or e.y is null or e.z is null or e.id is null or e.d is null or e.d not in ('o','n') or e.y not between 0 and 255 or abs(e.x::bigint)>31999999 or abs(e.z::bigint)>31999999 or e.id not between 0 and 511 then raise exception 'Nieprawidłowy blok.'; end if;
    owner_hash := null;
    if e.d='o' then select owner into owner_hash from public.blockcraft_plots where world=p_world and cx=floor(e.x/16.0)::integer and cz=floor(e.z/16.0)::integer; end if;
    if owner_hash is not null and owner_hash<>actor then
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
revoke all on function public.blockcraft_plot(text,text,text,integer,integer,text) from public;
revoke all on function public.blockcraft_write_blocks(text,text,jsonb) from public;
grant execute on function public.blockcraft_plot(text,text,text,integer,integer,text) to anon, authenticated;
grant execute on function public.blockcraft_write_blocks(text,text,jsonb) to anon, authenticated;
