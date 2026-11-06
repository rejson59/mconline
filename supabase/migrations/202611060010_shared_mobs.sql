-- One canonical population per dimension/128-block region. Browser simulation
-- is fenced by a short renewable lease + epoch AND snapshot CAS. Other players
-- transact interactions against the same snapshot, never a private mob copy.
create table public.mconline_mob_regions (
 world text not null,dim text not null,x integer not null,z integer not null,
 revision bigint not null default 0,epoch bigint not null default 0,owner text,lease_until timestamptz,
 mobs jsonb not null default '[]',primary key(world,dim,x,z)
);
create table public.mconline_mob_viewers (
 world text not null,pid text not null,dim text not null,x double precision not null,z double precision not null,seen timestamptz not null,
 primary key(world,pid)
);
alter table public.mconline_mob_viewers enable row level security;
revoke all on public.mconline_mob_viewers from public,anon,authenticated;
create table public.mconline_mob_hits (
 world text not null,uid text not null,target text not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(world,uid)
);
alter table public.mconline_mob_regions enable row level security;
alter table public.mconline_mob_hits enable row level security;
revoke all on public.mconline_mob_regions,public.mconline_mob_hits from public,anon,authenticated;
create function public.mconline_validate_mobs(p_mobs jsonb) returns void language plpgsql set search_path=pg_catalog,public as $$
declare m jsonb; v jsonb;
begin
 if jsonb_typeof(p_mobs) is distinct from 'array' or jsonb_array_length(p_mobs)>64 or octet_length(p_mobs::text)>120000 then raise exception 'Nieprawidłowa populacja.'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_mobs))<>jsonb_array_length(p_mobs) then raise exception 'Powtórzone ID encji.'; end if;
 for m in select value from jsonb_array_elements(p_mobs) loop
  if coalesce(m->>'id','') !~ '^[a-zA-Z0-9_:-]{1,160}$' or coalesce(m->>'type','') not in ('pig','cow','sheep','chicken','wolf','villager','golem','zombie','skeleton','creeper','spider','enderman','slime','ghast') or jsonb_typeof(m->'state') is distinct from 'object' then raise exception 'Nieprawidłowa encja.'; end if;
  for v in select m->'pos' union all select m->'vel' union all select m->'home' loop
   if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)<>3 or exists(select 1 from jsonb_array_elements(v) a where jsonb_typeof(a)<>'number' or abs(a::text::numeric)>1000000) then raise exception 'Nieprawidłowy wektor encji.'; end if;
  end loop;
 end loop;
end $$;
create function public.mconline_mob_drops(p_world text,p_pid text,p_dim text,p_drops jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb; stamp numeric:=extract(epoch from clock_timestamp())*1000;
begin
 if jsonb_typeof(p_drops) is distinct from 'array' or jsonb_array_length(p_drops)>128 then raise exception 'Nieprawidłowe łupy.'; end if;
 for item in select value from jsonb_array_elements(p_drops) loop
  item:=item||jsonb_build_object('owner',p_pid,'d',p_dim,'created',stamp,'expires',stamp+300000);
  if item ? 'pickupAfter' then item:=item||jsonb_build_object('pickupAfter',stamp+2000); end if;
  perform public.blockcraft_drop_op(p_world,p_pid,'put',item,null,null);
 end loop;
end $$;
-- Explosion/container destruction without touching anyone's inventory. Runs
-- INSIDE the fenced simulation commit; emptying, drops and air are one commit.
create function public.mconline_mob_chest_spill(p_world text,p_member jsonb,p_edit jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.mconline_chests%rowtype; slots jsonb:=coalesce(p_edit->'chestSeed','[]'); item jsonb; n integer:=0; stamp numeric:=extract(epoch from clock_timestamp())*1000;
begin
 perform public.mconline_container_access(p_world,p_member,p_edit);
 if jsonb_typeof(slots) is distinct from 'array' or jsonb_array_length(slots)>27 then raise exception 'Nieprawidłowa skrzynia.'; end if;
 while jsonb_array_length(slots)<27 loop slots:=slots||'[null]';end loop;
 insert into public.mconline_chests(world,dim,x,y,z,slots) values(p_world,p_edit->>'d',(p_edit->>'x')::int,(p_edit->>'y')::int,(p_edit->>'z')::int,slots) on conflict do nothing;
 select * into c from public.mconline_chests where world=p_world and dim=p_edit->>'d' and x=(p_edit->>'x')::int and y=(p_edit->>'y')::int and z=(p_edit->>'z')::int for update;
 if c.destroyed then return;end if;
 for item in select value from jsonb_array_elements(c.slots) where jsonb_typeof(value)='object' loop
  n:=n+1;
  perform public.blockcraft_drop_op(p_world,p_member->>'pid','put',jsonb_build_object('uid','mobchest:'||md5(p_world||c.dim||c.x||','||c.y||','||c.z||':'||c.revision||':'||n),'owner',p_member->>'pid','d',c.dim,'stack',item,'pos',jsonb_build_array(c.x+.5,c.y+.5,c.z+.5),'vel','[0,2,0]'::jsonb,'created',stamp,'expires',stamp+300000),null,null);
 end loop;
 update public.mconline_chests set slots=(select jsonb_agg(null::text) from generate_series(1,27)),destroyed=true,revision=revision+1 where world=p_world and dim=c.dim and x=c.x and y=c.y and z=c.z;
end $$;
create function public.mconline_mob_edits(p_world text,p_member jsonb,p_edits jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb; result jsonb; batch jsonb; accepted jsonb:='[]';
begin
 if jsonb_typeof(p_edits) is distinct from 'array' or jsonb_array_length(p_edits)>2048 then raise exception 'Nieprawidłowe zmiany świata.'; end if;
 if jsonb_array_length(p_edits)=0 then return '[]';end if;
 for item in select value from jsonb_array_elements(p_edits) loop
  if item ? 'chestSeed' then perform public.mconline_mob_chest_spill(p_world,p_member,item);end if;
 end loop;
 for batch in select jsonb_agg(value order by n) from jsonb_array_elements(p_edits) with ordinality a(value,n) group by (n-1)/300 order by (n-1)/300 loop
  if p_world='city' then result:=public.blockcraft_city_write_blocks(p_world,p_member->>'capability',batch);
  else result:=public.blockcraft_write_blocks(p_world,p_member->>'capability',batch);end if;
  if jsonb_array_length(coalesce(result->'rejected','[]'))>0 then raise exception 'Teren jest chroniony.';end if;
  accepted:=accepted||coalesce(result->'accepted','[]');
 end loop;
 return accepted;
end $$;
create function public.mconline_mobs(p_account uuid,p_username text,p_session text,p_world text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m jsonb; q jsonb; r public.mconline_mob_regions%rowtype; u jsonb; h jsonb; rows jsonb:='[]'; hits jsonb; changes jsonb:='[]'; edits jsonb; pos jsonb:=p_args->'position'; best text; valid boolean:=true;
begin
 m:=public.mconline_member_v2(p_account,p_username,p_session,p_world,'touch',null);
 if jsonb_typeof(p_args->'regions') is distinct from 'array' or jsonb_array_length(p_args->'regions')>9 or jsonb_typeof(p_args->'updates') is distinct from 'array' or jsonb_array_length(p_args->'updates')>9 or octet_length(p_args::text)>500000 then raise exception 'Nieprawidłowe regiony.'; end if;
 if coalesce(pos->>'d','') not in ('o','n') or pos->>'x' is null or pos->>'z' is null or abs((pos->>'x')::numeric)>1000000 or abs((pos->>'z')::numeric)>1000000 then raise exception 'Nieprawidłowy widz.';end if;
 insert into public.mconline_mob_viewers values(p_world,m->>'pid',pos->>'d',(pos->>'x')::float8,(pos->>'z')::float8,clock_timestamp()) on conflict(world,pid) do update set dim=excluded.dim,x=excluded.x,z=excluded.z,seen=excluded.seen;
 delete from public.mconline_mob_viewers where seen<now()-interval '1 minute';
 -- A multi-region tick is all-or-nothing (including cross-cell explosions).
 for u in select value from jsonb_array_elements(p_args->'updates') loop
  select * into r from public.mconline_mob_regions where world=p_world and dim=u->>'d' and x=(u->>'x')::int and z=(u->>'z')::int for update;
  if not found or r.owner is distinct from m->>'pid' or r.lease_until<=clock_timestamp() or r.epoch is distinct from (u->>'epoch')::bigint or r.revision is distinct from (u->>'revision')::bigint then valid:=false;end if;
 end loop;
 for u in select value from jsonb_array_elements(p_args->'updates') loop
  select * into r from public.mconline_mob_regions where world=p_world and dim=u->>'d' and x=(u->>'x')::int and z=(u->>'z')::int for update;
  if valid and found and r.owner=m->>'pid' and r.lease_until>clock_timestamp() and r.epoch=(u->>'epoch')::bigint and r.revision=(u->>'revision')::bigint then
   perform public.mconline_validate_mobs(u->'mobs');
   update public.mconline_mob_regions set mobs=u->'mobs',revision=revision+1 where world=p_world and dim=r.dim and x=r.x and z=r.z;
   perform public.mconline_mob_drops(p_world,m->>'pid',r.dim,coalesce(u->'drops','[]'));
   if jsonb_array_length(coalesce(u->'hits','[]'))>128 then raise exception 'Za wiele trafień.';end if;
   for h in select value from jsonb_array_elements(coalesce(u->'hits','[]')) loop
    if coalesce(h->>'uid','') !~ '^[a-zA-Z0-9_:-]{1,160}$' or coalesce((h->>'damage')::numeric,0) not between 0 and 30 then raise exception 'Nieprawidłowe obrażenia.'; end if;
    insert into public.mconline_mob_hits values(p_world,h->>'uid',h->>'target',h||jsonb_build_object('at',extract(epoch from clock_timestamp())*1000),now()) on conflict do nothing;
   end loop;
   changes:=changes||public.mconline_mob_edits(p_world,m,coalesce(u->'edits','[]'));
  end if;
 end loop;
 for q in select value from jsonb_array_elements(p_args->'regions') loop
  if q->>'d' is distinct from pos->>'d' or abs((q->>'x')::int-floor((pos->>'x')::float8/128))>1 or abs((q->>'z')::int-floor((pos->>'z')::float8/128))>1 or coalesce(q->>'d','') not in ('o','n') or abs((q->>'x')::bigint)>8000 or abs((q->>'z')::bigint)>8000 then raise exception 'Poza światem.'; end if;
  insert into public.mconline_mob_regions(world,dim,x,z) values(p_world,q->>'d',(q->>'x')::int,(q->>'z')::int) on conflict do nothing;
  select * into r from public.mconline_mob_regions where world=p_world and dim=q->>'d' and x=(q->>'x')::int and z=(q->>'z')::int for update;
  select pid into best from public.mconline_mob_viewers where world=p_world and dim=r.dim and seen>clock_timestamp()-interval '3 seconds' and abs(floor(x/128)-r.x)<=1 and abs(floor(z/128)-r.z)<=1 order by power(x-(r.x*128+64),2)+power(z-(r.z*128+64),2),pid limit 1;
  if r.owner is null or r.lease_until<=clock_timestamp() or (best is not null and best<>r.owner) then
   update public.mconline_mob_regions set owner=coalesce(best,m->>'pid'),epoch=epoch+1,lease_until=clock_timestamp()+interval '5 seconds' where world=p_world and dim=r.dim and x=r.x and z=r.z returning * into r;
  elsif r.owner=m->>'pid' then
   update public.mconline_mob_regions set lease_until=clock_timestamp()+interval '5 seconds' where world=p_world and dim=r.dim and x=r.x and z=r.z returning * into r;
  end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('d',r.dim,'x',r.x,'z',r.z,'revision',r.revision,'epoch',r.epoch,'owner',r.owner,'mobs',r.mobs));
 end loop;
 delete from public.mconline_mob_hits where created_at<now()-interval '30 seconds';
 select coalesce(jsonb_agg(payload),'[]') into hits from public.mconline_mob_hits where world=p_world and target=m->>'pid';
 -- Read back attempted terrain even on a stale replay. The client can then
 -- reconcile speculative PRIVATE legacy furnace/anvil/brewing caches without
 -- guessing whether a lost first response committed their destruction.
 select coalesce(jsonb_agg(jsonb_build_object('d',b.dim,'x',b.x,'y',b.y,'z',b.z,'id',b.block)),'[]') into changes from public.blockcraft_blocks b join (
  select distinct e.d,e.x,e.y,e.z from jsonb_array_elements(p_args->'updates') ticks(payload) cross join lateral jsonb_to_recordset(coalesce(ticks.payload->'edits','[]')) as e(d text,x int,y int,z int)
 ) e on b.world=p_world and b.dim=e.d and b.x=e.x and b.y=e.y and b.z=e.z;
 return jsonb_build_object('regions',rows,'hits',hits,'edits',changes);
end $$;
create function public.mconline_mob_action(p_account uuid,p_username text,p_session text,p_world text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m jsonb; ref jsonb:=p_args->'ref'; r public.mconline_mob_regions%rowtype; previous public.blockcraft_players%rowtype; ok boolean; saved jsonb; edits jsonb:='[]'; p jsonb:=p_args->'profile';
begin
 m:=public.mconline_member_v2(p_account,p_username,p_session,p_world,'touch',null);
 select * into previous from public.blockcraft_players where world=p_world and pid=m->>'pid' for update;
 select * into r from public.mconline_mob_regions where world=p_world and dim=ref->>'d' and x=(ref->>'x')::int and z=(ref->>'z')::int for update;
 if coalesce(p_args->>'id','') !~ '^[a-f0-9-]{36}$' or coalesce(p_args->>'op','') not in ('commit','cancel') then raise exception 'Nieprawidłowa operacja.'; end if;
 select committed into ok from public.mconline_chest_operations where world=p_world and pid=m->>'pid' and operation=p_args->>'id';
 if not found then
  ok:=p_args->>'op'='commit' and r.world is not null and r.revision=(p_args->>'revision')::bigint and previous.updated_at is not distinct from (p->>'mconline_base')::timestamptz;
  if ok then
   perform public.mconline_validate_mobs(p_args->'mobs');
   saved:=public.mconline_profile(p_account,p_username,p_session,p_world,p,true,(p->>'mconline_base')::timestamptz,p_args->>'id',false)->0;
   update public.mconline_mob_regions set mobs=p_args->'mobs',revision=revision+1 where world=p_world and dim=r.dim and x=r.x and z=r.z returning * into r;
   perform public.mconline_mob_drops(p_world,m->>'pid',r.dim,coalesce(p_args->'drops','[]'));
   edits:=public.mconline_mob_edits(p_world,m,coalesce(p_args->'edits','[]'));
  end if;
  insert into public.mconline_chest_operations values(p_world,m->>'pid',p_args->>'id',coalesce(ok,false));
 end if;
 select to_jsonb(a) into saved from public.blockcraft_players a where world=p_world and pid=m->>'pid';
 return jsonb_build_object('committed',coalesce(ok,false),'profile',saved,'edits',edits,'region',jsonb_build_object('d',r.dim,'x',r.x,'z',r.z,'revision',r.revision,'epoch',r.epoch,'owner',r.owner,'mobs',r.mobs));
end $$;
revoke all on function public.mconline_mob_chest_spill(text,jsonb,jsonb),public.mconline_mob_edits(text,jsonb,jsonb),public.mconline_validate_mobs(jsonb),public.mconline_mob_drops(text,text,text,jsonb),public.mconline_mobs(uuid,text,text,text,jsonb),public.mconline_mob_action(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mconline_mobs(uuid,text,text,text,jsonb),public.mconline_mob_action(uuid,text,text,text,jsonb) to service_role;
