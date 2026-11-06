-- Non-destructive synthetic fixture. Always ROLLBACK.
begin;
create temporary table checkpoint_result(checks integer);
do $$
declare a uuid:=extensions.gen_random_uuid(); s text:=extensions.gen_random_uuid()::text; s2 text:=extensions.gen_random_uuid()::text; proof text:=repeat('a',64); row jsonb; again jsonb; p jsonb:='{"inv":"[{\"id\":1,\"count\":17}]","armor":"[]","health":11.833333333333,"hunger":20,"pid":"victim","world":"city","name":"forged"}'; v timestamptz; checks int:=0;
begin
 if has_function_privilege('anon','public.mconline_profile(uuid,text,text,text,jsonb,boolean,timestamptz,text,boolean)','execute') then raise exception 'anon can save'; end if; checks:=checks+1;
 if has_function_privilege('authenticated','public.mconline_profile(uuid,text,text,text,jsonb,boolean,timestamptz,text,boolean)','execute') then raise exception 'authenticated can save'; end if; checks:=checks+1;
 if not has_function_privilege('service_role','public.mconline_profile(uuid,text,text,text,jsonb,boolean,timestamptz,text,boolean)','execute') then raise exception 'service cannot save'; end if; checks:=checks+1;
 perform public.mconline_member_v2(a,'Fixture',s,'public','join',proof);
 row:=public.mconline_profile(a,'Fixture',s,'public',p,true,null,'save-1',false)->0;
 if row->>'pid'='victim' or row->>'world'<>'public' or row->>'name'<>'Fixture' or (row->>'inv')::jsonb->0->>'count'<>'17' then raise exception 'ownership/inventory'; end if; checks:=checks+1;
 if abs((row->>'health')::float8-11.833333333333)>0.000001 then raise exception 'fractional regen'; end if; checks:=checks+1;
 if jsonb_array_length((row->>'inv')::jsonb)<51 then raise exception 'committed trigger-normalized row not returned'; end if; checks:=checks+1;
 v:=(row->>'updated_at')::timestamptz;
 again:=public.mconline_profile(a,'Fixture',s,'public',p||'{"inv":"[]"}'::jsonb,true,null,'save-1',false)->0;
 if again is distinct from row then raise exception 'duplicate commit changed inventory'; end if; checks:=checks+1;
 row:=public.mconline_profile(a,'Fixture',s,'public',p,true,v,'save-2',false)->0;
 if (row->>'updated_at')::timestamptz<=v then raise exception 'version not monotonic'; end if; checks:=checks+1;
 begin perform public.mconline_profile(a,'Fixture',s,'public',p||'{"inv":"[]"}'::jsonb,true,v,'stale',false); raise exception 'stale CAS accepted'; exception when sqlstate 'P0410' then null; end; checks:=checks+1;
 begin perform public.mconline_profile(a,'Fixture',s,'public',p||'{"inv":"bad"}'::jsonb,false,null,'bad',false); raise exception 'bad JSON accepted'; exception when invalid_text_representation then null; end; checks:=checks+1;
 row:=public.mconline_profile(a,'Fixture',s,'public',p,true,(row->>'updated_at')::timestamptz,'save-final',true)->0;
 if row->>'save_id'<>'save-final' or exists(select 1 from public.mconline_members where account=a and session is not null) then raise exception 'checkpoint+leave not atomic'; end if; checks:=checks+1;
 begin perform public.mconline_profile(a,'Fixture',s,'public',p,false,null,null,false); raise exception using errcode='XX001',message='post-leave write accepted'; exception when raise_exception then null; end; checks:=checks+1;
 perform public.mconline_member_v2(a,'Fixture',s2,'public','join',proof);
 begin perform public.mconline_profile(a,'Fixture',s,'public',p,false,null,null,false); raise exception using errcode='XX001',message='old generation accepted'; exception when raise_exception then null; end; checks:=checks+1;
 insert into checkpoint_result values(checks);
end $$;
select checks,'PASS, synthetic fixture rolled back' as result from checkpoint_result;
rollback;
