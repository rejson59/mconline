-- Synthetic fixtures, real block writers and city permissions. Always rollback.
begin;
create temporary table shared_effect_results(label text);
create function pg_temp.effect_check(label text,ok boolean) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAIL: %',label;end if;insert into shared_effect_results values(label);end$$;
do $$
declare a uuid:=extensions.gen_random_uuid();sa text:=extensions.gen_random_uuid()::text;m jsonb;p jsonb;c jsonb;r jsonb;tx jsonb;e jsonb;ref jsonb:='{"d":"o","x":799010,"y":250,"z":799010}';empty jsonb:=(select jsonb_agg(null::text) from generate_series(1,27));before_n bigint;city_a uuid:=extensions.gen_random_uuid();city_s text:=extensions.gen_random_uuid()::text;cm jsonb;cx int;cz int;city_ref jsonb;
begin
 m:=public.mconline_member_v2(a,'Fixture',sa,'public','join',repeat('a',64));
 p:=public.mconline_profile(a,'Fixture',sa,'public','{"inv":"[]","armor":"[]","health":20,"hunger":20}',true,null,'effect-initial',false)->0;
 c:=public.mconline_chest(a,'Fixture',sa,'public',jsonb_build_object('op','open','ref',ref,'seed',jsonb_set(empty,'{0}','{"id":1,"count":3}')));
 tx:=jsonb_build_object('op','commit','id',extensions.gen_random_uuid()::text,'ref',ref,'revision',c->'revision','slots',empty,'destroy',true,'dropBlock',true,'profile',p||jsonb_build_object('mconline_base',p->>'updated_at'),'drops',jsonb_build_array(jsonb_build_object('uid','fixture:'||extensions.gen_random_uuid()::text,'stack','{"id":1,"count":3}'::jsonb,'pos','[799010,250,799010]'::jsonb,'vel','[0,2,0]'::jsonb),jsonb_build_object('uid','fixture:'||extensions.gen_random_uuid()::text,'stack','{"id":54,"count":1}'::jsonb,'pos','[799010,250,799010]'::jsonb,'vel','[0,2,0]'::jsonb)));
 r:=public.mconline_chest(a,'Fixture',sa,'public',tx);
 perform pg_temp.effect_check('survival mining creates one chest block plus contents',r->>'committed'='true' and r->'chest'->>'destroyed'='true' and(select count(*) from public.blockcraft_drops where uid in(tx->'drops'->0->>'uid',tx->'drops'->1->>'uid'))=2);
 perform pg_temp.effect_check('physical chest removal uses actual world writer',(select block=0 from public.blockcraft_blocks where world='public' and dim='o' and x=799010 and y=250 and z=799010));
 r:=public.mconline_chest(a,'Fixture',sa,'public',tx);perform pg_temp.effect_check('mining replay does not add another block drop',(select count(*) from public.blockcraft_drops where uid in(tx->'drops'->0->>'uid',tx->'drops'->1->>'uid'))=2);
 select jsonb_agg(jsonb_build_object('d','o','x',799100+n,'y',250,'z',799100,'id',0)) into e from generate_series(1,301) n;
 r:=public.mconline_mob_edits('public',m,e);perform pg_temp.effect_check('large simulation effect uses atomic 300-edit writer batches',jsonb_array_length(r)=301);
 ref:='{"d":"o","x":799011,"y":250,"z":799011}';
 c:=public.mconline_chest(a,'Fixture',sa,'public',jsonb_build_object('op','open','ref',ref,'seed',jsonb_set(empty,'{0}','{"id":1,"count":2}')));
 select count(*) into before_n from public.blockcraft_drops;
 e:=jsonb_build_array(ref||'{"id":0,"chestSeed":[]}');r:=public.mconline_mob_edits('public',m,e);
 perform pg_temp.effect_check('explosion empties canonical chest inside world transaction',(select destroyed from public.mconline_chests where world='public' and dim='o' and x=799011 and y=250 and z=799011));
 perform pg_temp.effect_check('explosion spills canonical contents once',(select count(*) from public.blockcraft_drops)=before_n+1);
 r:=public.mconline_mob_edits('public',m,e);perform pg_temp.effect_check('explosion repeat cannot spill twice',(select count(*) from public.blockcraft_drops)=before_n+1);
 cm:=public.mconline_member_v2(city_a,'Fixture city',city_s,'city','join',repeat('c',64));
 select x,z into cx,cz from generate_series(-16,15) x cross join generate_series(-16,15) z where not exists(select 1 from public.blockcraft_plots p where p.world='city' and p.cx=x and p.cz=z) limit 1;
 if cx is null then raise exception 'No free city fixture cell';end if;
 insert into public.blockcraft_plots(world,cx,cz,owner,name) values('city',cx,cz,encode(sha256(convert_to(cm->>'capability','UTF8')),'hex'),'Fixture city');
 city_ref:=jsonb_build_object('d','o','x',cx*48+16,'y',64,'z',cz*48+16);
 c:=public.mconline_chest(city_a,'Fixture city',city_s,'city',jsonb_build_object('op','open','ref',city_ref,'seed',empty));perform pg_temp.effect_check('own city plot chest is accessible',c->>'destroyed'='false');
 begin perform public.mconline_container_access('city',m,city_ref);raise exception using errcode='XX001',message='foreign city plot accepted';exception when raise_exception then null;end;perform pg_temp.effect_check('foreign city plot chest denied',true);
 begin perform public.mconline_container_access('city',cm,city_ref||jsonb_build_object('x',cx*48+1));raise exception using errcode='XX001',message='city street accepted';exception when raise_exception then null;end;perform pg_temp.effect_check('city streets remain protected',true);
end$$;
select count(*) checks,'PASS; synthetic real-writer fixtures ROLLBACK' result from shared_effect_results;
rollback;
