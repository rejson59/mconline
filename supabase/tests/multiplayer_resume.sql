-- WORLD DB. No live player rows: synthetic account mapping, full rollback.
begin;
do $$
declare a uuid:=gen_random_uuid(); s1 text:=gen_random_uuid()::text; s2 text:=gen_random_uuid()::text; s3 text:=gen_random_uuid()::text; proof text:=encode(extensions.gen_random_bytes(32),'hex'); other text:=encode(extensions.gen_random_bytes(32),'hex'); one jsonb; two jsonb;
begin
 assert not has_function_privilege('anon','public.mconline_member_v2(uuid,text,text,text,text,text)','execute');
 assert not has_function_privilege('authenticated','public.mconline_member_v2(uuid,text,text,text,text,text)','execute');
 assert has_function_privilege('service_role','public.mconline_member_v2(uuid,text,text,text,text,text)','execute');
 one:=public.mconline_member_v2(a,'Synthetic',s1,'public','join',proof);
 two:=public.mconline_member_v2(a,'Synthetic',s2,'public','join',proof);
 assert one->>'pid'=two->>'pid' and one->>'capability'=two->>'capability','reload changed player ownership';
 assert (select session=s2 from public.mconline_members where account=a),'reload not resumed';
 assert (select resume_hash<>proof from public.mconline_members where account=a),'raw resume proof stored';
 begin perform public.mconline_member_v2(a,'Synthetic',s1,'public','leave'); raise exception 'old leave accepted'; exception when raise_exception then if sqlerrm='old leave accepted' then raise; end if; end;
 assert (select session=s2 from public.mconline_members where account=a),'late old leave removed new session';
 begin perform public.mconline_member_v2(a,'Synthetic',s1,'public','touch'); raise exception 'old heartbeat accepted'; exception when raise_exception then if sqlerrm='old heartbeat accepted' then raise; end if; end;
 begin perform public.mconline_member_v2(a,'Synthetic',s3,'city','join',other); raise exception 'other device bypassed'; exception when sqlstate 'P0409' then null; end;
 begin perform public.mconline_member(a,'Synthetic',s3,'public','join'); raise exception 'legacy caller bypassed'; exception when sqlstate 'P0409' then null; end;
 perform public.mconline_member_v2(a,'Synthetic',s3,'city','replace',other);
 assert (select session=s3 and world='city' from public.mconline_members where account=a),'explicit recovery failed';
 begin perform public.mconline_member_v2(a,'Synthetic',s2,'public','join',proof); raise exception 'replaced proof reclaimed session'; exception when sqlstate 'P0409' then null; end;
 begin perform public.mconline_poll(a,s2,'public','{}','[]',0); raise exception 'old poll accepted'; exception when raise_exception then if sqlerrm='old poll accepted' then raise; end if; end;
 perform public.mconline_member_v2(a,'Synthetic',s3,'city','leave');
 assert (select session is null and lease_until is null from public.mconline_members where account=a),'normal leave failed';
 perform public.mconline_member_v2(a,'Synthetic',s1,'public','join',proof);
 update public.mconline_members set lease_until=clock_timestamp()-interval '1 second' where account=a;
 perform public.mconline_member_v2(a,'Synthetic',s2,'city','join',other);
 assert (select session=s2 and world='city' from public.mconline_members where account=a),'expired lease cannot rejoin';
end $$;
rollback;
select jsonb_build_object('checks',16,'rolled_back',true) as resume_integration;
