-- Real deployed membership/CAS/plot/drop functions, synthetic accounts only.
-- No real account tokens; NEVER remove the ROLLBACK.
begin;
create temporary table shared_state_results(label text);
create function pg_temp.shared_check(label text, ok boolean) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAIL: %',label;end if;insert into shared_state_results values(label);end$$;
do $$
declare
 a uuid:=extensions.gen_random_uuid();b uuid:=extensions.gen_random_uuid();sa text:=extensions.gen_random_uuid()::text;sb text:=extensions.gen_random_uuid()::text;
 ma jsonb;mb jsonb;pa jsonb;pb jsonb;c jsonb;r jsonb;again jsonb;tx jsonb;empty jsonb:=(select jsonb_agg(null::text) from generate_series(1,27));slots jsonb;
 ref jsonb:='{"d":"o","x":999876,"y":250,"z":999876}';regions jsonb:='[{"d":"o","x":7811,"z":7811}]';ea jsonb;eb jsonb;u jsonb;mob jsonb;
 old_epoch bigint;nonce text;fname text;tname text;v text;
begin
 foreach fname in array array['mconline_chest','mconline_mobs','mconline_mob_action'] loop
  v:='public.'||fname||'(uuid,text,text,text,jsonb)';
  perform pg_temp.shared_check(fname||' denies anon',not has_function_privilege('anon',v,'execute'));
  perform pg_temp.shared_check(fname||' denies authenticated',not has_function_privilege('authenticated',v,'execute'));
  perform pg_temp.shared_check(fname||' permits service',has_function_privilege('service_role',v,'execute'));
 end loop;
 foreach tname in array array['mconline_chests','mconline_chest_operations','mconline_chest_imports','mconline_mob_regions','mconline_mob_viewers','mconline_mob_hits'] loop
  perform pg_temp.shared_check(tname||' private',not has_table_privilege('anon','public.'||tname,'select') and not has_table_privilege('authenticated','public.'||tname,'select'));
 end loop;
 ma:=public.mconline_member_v2(a,'Fixture A',sa,'public','join',repeat('a',64));mb:=public.mconline_member_v2(b,'Fixture B',sb,'public','join',repeat('b',64));
 pa:=public.mconline_profile(a,'Fixture A',sa,'public','{"inv":"[{\"id\":1,\"count\":7,\"name\":\"Shared metadata\"}]","armor":"[]","health":20,"hunger":20}',true,null,'initial-a',false)->0;
 pb:=public.mconline_profile(b,'Fixture B',sb,'public','{"inv":"[]","armor":"[]","health":20,"hunger":20}',true,null,'initial-b',false)->0;
 c:=public.mconline_chest(a,'Fixture A',sa,'public',jsonb_build_object('op','open','ref',ref,'seed',empty));
 slots:=jsonb_set(empty,'{0}','{"id":1,"count":7,"name":"Shared metadata"}');
 tx:=jsonb_build_object('op','commit','id',extensions.gen_random_uuid()::text,'ref',ref,'revision',c->'revision','slots',slots,'drops','[]'::jsonb,'profile',pa||jsonb_build_object('inv','[]','mconline_base',pa->>'updated_at'));
 r:=public.mconline_chest(a,'Fixture A',sa,'public',tx);
 perform pg_temp.shared_check('chest/profile deposit atomic',r->>'committed'='true' and r->'chest'->'slots'->0->>'count'='7' and not exists(select 1 from jsonb_array_elements((r->'profile'->>'inv')::jsonb) cells(item) where cells.item->>'id'='1'));
 again:=public.mconline_chest(a,'Fixture A',sa,'public',tx);perform pg_temp.shared_check('lost chest ACK replay',again->'chest'->'revision'=r->'chest'->'revision');
 c:=public.mconline_chest(b,'Fixture B',sb,'public',jsonb_build_object('op','open','ref',ref,'seed',empty));perform pg_temp.shared_check('other account sees same metadata',c->'slots'->0->>'name'='Shared metadata');
 tx:=jsonb_build_object('op','commit','id',extensions.gen_random_uuid()::text,'ref',ref,'revision',c->'revision','slots',empty,'drops','[]'::jsonb,'profile',pb||jsonb_build_object('inv',jsonb_build_array(slots->0)::text,'mconline_base',pb->>'updated_at'));
 pb:=public.mconline_chest(b,'Fixture B',sb,'public',tx);perform pg_temp.shared_check('one withdrawal commits',pb->>'committed'='true');
 tx:=tx||jsonb_build_object('id',extensions.gen_random_uuid()::text,'profile',r->'profile'||jsonb_build_object('inv',jsonb_build_array(slots->0)::text,'mconline_base',r->'profile'->>'updated_at'));
 again:=public.mconline_chest(a,'Fixture A',sa,'public',tx);perform pg_temp.shared_check('other stale withdrawal cannot duplicate',again->>'committed'='false');
 nonce:=extensions.gen_random_uuid()::text;tx:=tx||jsonb_build_object('id',nonce,'op','cancel');r:=public.mconline_chest(a,'Fixture A',sa,'public',tx);again:=public.mconline_chest(a,'Fixture A',sa,'public',tx||'{"op":"commit"}');
 perform pg_temp.shared_check('abort fences delayed original',r->>'committed'='false' and again->>'committed'='false');
 insert into public.blockcraft_plots(world,cx,cz,owner,name) values('public',floor(999876/16.0)::int,floor(999876/16.0)::int,repeat('c',64),'Fixture foreign plot');
 begin perform public.mconline_chest(a,'Fixture A',sa,'public',jsonb_build_object('op','open','ref',ref,'seed',empty));raise exception using errcode='XX001',message='foreign access accepted';exception when raise_exception then null;end;
 perform pg_temp.shared_check('foreign plot access denied',true);
 r:=public.mconline_chest(a,'Fixture A',sa,'public',tx);perform pg_temp.shared_check('cancel works after access changes without slot leak',r->>'committed'='false' and r->'chest'->>'destroyed'='true' and not exists(select 1 from jsonb_array_elements(r->'chest'->'slots') e where jsonb_typeof(e)='object'));
 ea:=public.mconline_mobs(a,'Fixture A',sa,'public',jsonb_build_object('regions',regions,'updates','[]'::jsonb,'position','{"d":"o","x":999872,"z":999872}'::jsonb));
 eb:=public.mconline_mobs(b,'Fixture B',sb,'public',jsonb_build_object('regions',regions,'updates','[]'::jsonb,'position','{"d":"o","x":999873,"z":999872}'::jsonb));
 perform pg_temp.shared_check('one coordinator for two members',ea->'regions'->0->>'owner'=eb->'regions'->0->>'owner');
 mob:='{"id":"shared-fixture","type":"pig","variant":"temperate","pos":[999872,250,999872],"vel":[0,0,0],"home":[999872,250,999872],"state":{"health":10,"dead":false,"looted":false},"trade":null}';
 u:=ea->'regions'->0||jsonb_build_object('mobs',jsonb_build_array(mob),'drops','[]'::jsonb,'hits','[]'::jsonb,'edits','[]'::jsonb);
 ea:=public.mconline_mobs(a,'Fixture A',sa,'public',jsonb_build_object('regions',regions,'updates',jsonb_build_array(u),'position','{"d":"o","x":999872,"z":999872}'::jsonb));
 eb:=public.mconline_mobs(b,'Fixture B',sb,'public',jsonb_build_object('regions',regions,'updates','[]'::jsonb,'position','{"d":"o","x":999873,"z":999872}'::jsonb));
 perform pg_temp.shared_check('canonical entity identity/HP',ea->'regions'->0->'mobs'=eb->'regions'->0->'mobs' and eb->'regions'->0->'mobs'->0->>'id'='shared-fixture');
 select to_jsonb(p) into pb from public.blockcraft_players p where world='public' and pid=mb->>'pid';
 tx:=jsonb_build_object('op','commit','id',extensions.gen_random_uuid()::text,'ref','{"d":"o","x":7811,"y":0,"z":7811}'::jsonb,'revision',eb->'regions'->0->'revision','mobs',jsonb_build_array(mob||'{"state":{"health":0,"dead":true,"looted":true}}'),'profile',pb||jsonb_build_object('mconline_base',pb->>'updated_at'),'drops',jsonb_build_array(jsonb_build_object('uid','fixture:'||extensions.gen_random_uuid()::text,'stack','{"id":65535,"count":3}'::jsonb,'pos','[999872,250,999872]'::jsonb,'vel','[0,2,0]'::jsonb)));
 r:=public.mconline_mob_action(b,'Fixture B',sb,'public',tx);perform pg_temp.shared_check('non-owner attack commits shared death/loot',r->>'committed'='true' and r->'region'->'mobs'->0->'state'->>'dead'='true');
 again:=public.mconline_mob_action(b,'Fixture B',sb,'public',tx);perform pg_temp.shared_check('lost mob ACK cannot repeat kill',again->'region'->'revision'=r->'region'->'revision' and(select count(*) from public.blockcraft_drops where uid=tx->'drops'->0->>'uid')=1);
 ea:=public.mconline_mobs(a,'Fixture A',sa,'public',jsonb_build_object('regions',regions,'updates',jsonb_build_array(u),'position','{"d":"o","x":999872,"z":999872}'::jsonb));
 perform pg_temp.shared_check('stale simulation cannot resurrect',ea->'regions'->0->'mobs'->0->'state'->>'dead'='true');
 old_epoch:=(ea->'regions'->0->>'epoch')::bigint;
 update public.mconline_mob_regions set lease_until=clock_timestamp()-interval '1 second' where world='public' and dim='o' and x=7811 and z=7811;
 update public.mconline_mob_viewers set seen=clock_timestamp()-interval '4 seconds' where world='public' and pid=ma->>'pid';
 eb:=public.mconline_mobs(b,'Fixture B',sb,'public',jsonb_build_object('regions',regions,'updates','[]'::jsonb,'position','{"d":"o","x":999873,"z":999872}'::jsonb));
 perform pg_temp.shared_check('handoff fences old epoch and preserves corpse',eb->'regions'->0->>'owner'=mb->>'pid' and(eb->'regions'->0->>'epoch')::bigint>old_epoch and eb->'regions'->0->'mobs'->0->'state'->>'looted'='true');
 perform public.mconline_member_v2(a,'Fixture A',extensions.gen_random_uuid()::text,'public','replace',repeat('d',64));
 begin perform public.mconline_mobs(a,'Fixture A',sa,'public',jsonb_build_object('regions',regions,'updates','[]'::jsonb,'position','{"d":"o","x":999872,"z":999872}'::jsonb));raise exception using errcode='XX001',message='old session accepted';exception when raise_exception then null;end;
 perform pg_temp.shared_check('replaced session cannot write shared mobs',true);
end$$;
select count(*) as checks,'PASS; real membership/plots/profile/triggers/drop RPCs; synthetic fixture ROLLBACK' result from shared_state_results;
rollback;
