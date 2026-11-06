-- Account-fenced containers. No resets. Inventory and chest changes commit
-- together; a lost response is replayable, a rejected operation is tombstoned.
create table public.mconline_chests (
 world text not null, dim text not null, x integer not null,y integer not null,z integer not null,
 slots jsonb not null default '[]', revision bigint not null default 0, destroyed boolean not null default false,
 primary key(world,dim,x,y,z)
);
create table public.mconline_chest_operations (
 world text not null,pid text not null,operation text not null,committed boolean not null,
 primary key(world,pid,operation)
);
create table public.mconline_chest_imports (
 world text not null,pid text not null,dim text not null,x integer not null,y integer not null,z integer not null,
 original jsonb not null,done boolean not null default false,
 primary key(world,pid,dim,x,y,z)
);
alter table public.mconline_chests enable row level security;
alter table public.mconline_chest_operations enable row level security;
alter table public.mconline_chest_imports enable row level security;
revoke all on public.mconline_chests,public.mconline_chest_operations,public.mconline_chest_imports from public,anon,authenticated;

create function public.mconline_container_access(p_world text,p_member jsonb,p_ref jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare x integer:=(p_ref->>'x')::integer; y integer:=(p_ref->>'y')::integer; z integer:=(p_ref->>'z')::integer; owner_hash text; actor text;
begin
 if x is null or z is null or y is null or abs(x::bigint)>1000000 or abs(z::bigint)>1000000 or y not between 0 and 255 or coalesce(p_ref->>'d','') not in ('o','n') then raise exception 'Nieprawidłowa pozycja skrzyni.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('blockcraft-plots:'||p_world,0));
 actor:=encode(sha256(convert_to(p_member->>'capability','UTF8')),'hex');
 select owner into owner_hash from public.blockcraft_plots where world=p_world and cx=floor(x/(case when p_world='city' then 48.0 else 16.0 end))::integer and cz=floor(z/(case when p_world='city' then 48.0 else 16.0 end))::integer;
 if p_world='city' then
  if p_ref->>'d'<>'o' or y not between 1 and 127 or floor(x/48.0) not between -16 and 15 or floor(z/48.0) not between -16 and 15 or ((x%48)+48)%48<16 or ((z%48)+48)%48<16 or owner_hash is distinct from actor then raise exception 'Chroniona działka lub ulica.'; end if;
 elsif p_ref->>'d'='o' and owner_hash is not null and owner_hash<>actor then raise exception 'To nie twoja działka.';
 end if;
end $$;

-- Canonical multiset including metadata: no id-only merges, no hidden cursor
-- loss. The inventory tail after slot 47 contains receipts/status, not stacks.
create function public.mconline_item_totals(p_inv jsonb,p_armor jsonb,p_slots jsonb,p_drops jsonb default '[]') returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select coalesce(jsonb_object_agg(item,total),'{}') from (
  select (v-'count')::text item,sum((v->>'count')::numeric) total from (
   select value v from jsonb_array_elements(p_inv) with ordinality a(value,n) where n<=48
   union all select value from jsonb_array_elements(p_armor)
   union all select value from jsonb_array_elements(p_slots)
   union all select value->'stack' from jsonb_array_elements(p_drops)
  ) a where jsonb_typeof(v)='object' and v ? 'id' group by (v-'count')::text
 ) sums
$$;

create function public.mconline_chest(p_account uuid,p_username text,p_session text,p_world text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare
 m jsonb; ref jsonb:=p_args->'ref'; c public.mconline_chests%rowtype; previous public.blockcraft_players%rowtype;
 r record; incoming jsonb; original jsonb; pending boolean:=false; slot integer; target jsonb; item jsonb;
 ok boolean:=false; operation text:=p_args->>'id'; p jsonb:=p_args->'profile'; saved jsonb; drops jsonb:=coalesce(p_args->'drops','[]');
 stamp numeric; result jsonb; block_result jsonb; extra jsonb:='[]';
begin
 m:=public.mconline_member_v2(p_account,p_username,p_session,p_world,'touch',null);
 if p_args->>'op'<>'cancel' then perform public.mconline_container_access(p_world,m,ref); end if;
 if octet_length(p_args::text)>131072 then raise exception 'Za duża transakcja.'; end if;
 select * into previous from public.blockcraft_players where world=p_world and pid=m->>'pid' for update;
 select * into c from public.mconline_chests where world=p_world and dim=ref->>'d' and x=(ref->>'x')::int and y=(ref->>'y')::int and z=(ref->>'z')::int for update;
 if p_args->>'op'='open' then
  if not found then
   incoming:=coalesce(p_args->'seed','[]');
   if jsonb_typeof(incoming)<>'array' or jsonb_array_length(incoming)>27 then raise exception 'Nieprawidłowa skrzynia.'; end if;
   while jsonb_array_length(incoming)<27 loop incoming:=incoming||'[null]'::jsonb; end loop;
   insert into public.mconline_chests(world,dim,x,y,z,slots) values(p_world,ref->>'d',(ref->>'x')::int,(ref->>'y')::int,(ref->>'z')::int,incoming) returning * into c;
  end if;
  if c.destroyed and exists(select 1 from public.blockcraft_blocks b where b.world=p_world and b.dim=c.dim and b.x=c.x and b.y=c.y and b.z=c.z and b.block in (54,74,438,439,440,441,442,443)) then
   update public.mconline_chests set destroyed=false,slots=(select jsonb_agg(null::text) from generate_series(1,27)),revision=revision+1 where world=p_world and dim=c.dim and x=c.x and y=c.y and z=c.z returning * into c;
  end if;
  -- Preserve legacy private inventories once per account/coordinate. Import is
  -- all-or-nothing; if full, the original remains durably archived for retry.
  if p_args ? 'legacy' and jsonb_typeof(p_args->'legacy')='array' and jsonb_array_length(p_args->'legacy')<=27 then
   insert into public.mconline_chest_imports(world,pid,dim,x,y,z,original) values(p_world,m->>'pid',c.dim,c.x,c.y,c.z,p_args->'legacy') on conflict do nothing;
  end if;
  select i.original into original from public.mconline_chest_imports i where i.world=p_world and i.pid=m->>'pid' and i.dim=c.dim and i.x=c.x and i.y=c.y and i.z=c.z and not i.done for update;
  if found and not c.destroyed then
   incoming:=c.slots; pending:=false;
   for item in select value from jsonb_array_elements(original) where jsonb_typeof(value)='object' loop
    slot:=null;
    select (n-1)::int into slot from jsonb_array_elements(incoming) with ordinality a(value,n) where value='null'::jsonb order by n limit 1;
    if slot is null then pending:=true; exit; end if;
    incoming:=jsonb_set(incoming,array[slot::text],item);
   end loop;
   if not pending then
    update public.mconline_chests set slots=incoming,revision=revision+1 where world=p_world and dim=c.dim and x=c.x and y=c.y and z=c.z returning * into c;
    update public.mconline_chest_imports set done=true where world=p_world and pid=m->>'pid' and dim=c.dim and x=c.x and y=c.y and z=c.z;
   end if;
  end if;
  return jsonb_build_object('d',c.dim,'x',c.x,'y',c.y,'z',c.z,'slots',c.slots,'revision',c.revision,'destroyed',c.destroyed,'legacyPending',pending);
 end if;
 if operation is null or operation !~ '^[a-f0-9-]{36}$' or coalesce(p_args->>'op','') not in ('commit','cancel') then raise exception 'Nieprawidłowa operacja.'; end if;
 select committed into ok from public.mconline_chest_operations where world=p_world and pid=m->>'pid' and mconline_chest_operations.operation=p_args->>'id';
 if not found then
  ok:=p_args->>'op'='commit' and previous.updated_at is not distinct from (p->>'mconline_base')::timestamptz and c.revision=(p_args->>'revision')::bigint and not c.destroyed and c.world is not null;
  if ok then
   target:=p_args->'slots';
   if jsonb_typeof(target) is distinct from 'array' or jsonb_array_length(target)<>27 or jsonb_typeof(drops) is distinct from 'array' or jsonb_array_length(drops)>100 then raise exception 'Nieprawidłowe sloty.'; end if;
   if coalesce((p_args->>'dropBlock')::boolean,false) then
    if not coalesce((p_args->>'destroy')::boolean,false) or p_world='city' then raise exception 'Nieprawidłowy łup bloku.'; end if;
    extra:='[{"stack":{"id":54,"count":1}}]';
   end if;
   if public.mconline_item_totals(previous.inv::jsonb,previous.armor::jsonb,c.slots,extra) is distinct from public.mconline_item_totals((p->>'inv')::jsonb,(p->>'armor')::jsonb,target,drops) then raise exception 'Niezgodny bilans przedmiotów.'; end if;
   if coalesce((p_args->>'destroy')::boolean,false) then
    if exists(select 1 from jsonb_array_elements(target) a where jsonb_typeof(a)='object') then raise exception 'Niszczenie nie opróżniło skrzyni.'; end if;
    incoming:=jsonb_build_array(jsonb_build_object('x',c.x,'y',c.y,'z',c.z,'id',0,'d',c.dim));
    if p_world='city' then block_result:=public.blockcraft_city_write_blocks(p_world,m->>'capability',incoming);
    else block_result:=public.blockcraft_write_blocks(p_world,m->>'capability',incoming); end if;
   end if;
   saved:=public.mconline_profile(p_account,p_username,p_session,p_world,p,true,(p->>'mconline_base')::timestamptz,operation,false)->0;
   update public.mconline_chests set slots=target,revision=revision+1,destroyed=coalesce((p_args->>'destroy')::boolean,false) where world=p_world and dim=c.dim and x=c.x and y=c.y and z=c.z returning * into c;
   stamp:=extract(epoch from clock_timestamp())*1000;
   for item in select value from jsonb_array_elements(drops) loop
    item:=item||jsonb_build_object('owner',m->>'pid','d',c.dim,'created',stamp,'expires',stamp+300000);
    if item ? 'pickupAfter' then item:=item||jsonb_build_object('pickupAfter',stamp+2000); end if;
    perform public.blockcraft_drop_op(p_world,m->>'pid','put',item,null,null);
   end loop;
  end if;
  insert into public.mconline_chest_operations values(p_world,m->>'pid',operation,coalesce(ok,false));
 end if;
 select to_jsonb(a) into saved from public.blockcraft_players a where world=p_world and pid=m->>'pid';
 if p_args->>'op'='cancel' then c.slots:=(select jsonb_agg(null::text) from generate_series(1,27)); c.destroyed:=true; end if;
 return jsonb_build_object('committed',coalesce(ok,false),'profile',saved,'chest',jsonb_build_object('d',c.dim,'x',c.x,'y',c.y,'z',c.z,'slots',c.slots,'revision',c.revision,'destroyed',c.destroyed));
end $$;
revoke all on function public.mconline_container_access(text,jsonb,jsonb),public.mconline_item_totals(jsonb,jsonb,jsonb,jsonb),public.mconline_chest(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mconline_chest(uuid,text,text,text,jsonb) to service_role;
