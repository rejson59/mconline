-- WORLD DB. Synthetic members/messages only; every fixture rolls back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s text:=gen_random_uuid()::text; s2 text:=gen_random_uuid()::text; m jsonb; n jsonb; p jsonb; cursor0 bigint; mid text:=gen_random_uuid()::text; i integer;
begin
 assert not has_table_privilege('anon','public.mconline_members','select'),'member capability readable';
 assert not has_table_privilege('anon','public.mconline_messages','select'),'anonymous inbox';
 assert not has_function_privilege('anon','public.mconline_member(uuid,text,text,text,text)','execute'),'forged account join RPC';
 assert not has_function_privilege('anon','public.mconline_poll(uuid,text,text,jsonb,jsonb,bigint)','execute'),'anonymous poll RPC';
 m:=public.mconline_member(a,'Alice',s,'public','join'); cursor0:=(m->>'cursor')::bigint;
 assert m->>'pid' ~ '^p[0-9a-f]{19}$','bad persistent account pid';
 begin perform public.mconline_member(a,'Alice',s2,'public','join'); raise exception 'concurrent device joined'; exception when raise_exception then if sqlerrm='concurrent device joined' then raise; end if; end;
 p:=public.mconline_poll(a,s,'public','{}',jsonb_build_array(jsonb_build_object('t','chat','text','test','from','victim','name','Forged','_mid',mid)),cursor0);
 assert p->'messages'->0->'payload'->>'from'=m->>'pid','spoofed packet sender';
 assert p->'messages'->0->'payload'->>'name'='Alice','spoofed verified username';
 n:=public.mconline_poll(a,s,'public','{}',jsonb_build_array(jsonb_build_object('t','chat','text','test','_mid',mid)),cursor0);
 assert jsonb_array_length(n->'messages')=1,'ambiguous retry duplicated event';
 begin perform public.mconline_poll(a,s,'city','{}','[]',0); raise exception 'wrong-world poll accepted'; exception when raise_exception then if sqlerrm='wrong-world poll accepted' then raise; end if; end;
 cursor0:=(p->>'cursor')::bigint;
 for i in 1..513 loop insert into public.mconline_messages(world,sender,message_id,payload) values('public',m->>'pid',gen_random_uuid()::text,jsonb_build_object('t','chat','text','page')); end loop;
 p:=public.mconline_poll(a,s,'public','{}','[]',cursor0);
 assert jsonb_array_length(p->'messages')=512,'wrong inbox page size';
 n:=public.mconline_poll(a,s,'public','{}','[]',(p->>'cursor')::bigint);
 assert jsonb_array_length(n->'messages')=1,'cursor skipped overflow';
 perform public.mconline_member(a,'Alice',s,'public','leave');
 n:=public.mconline_member(a,'Alice',s2,'city','join');
 assert m->>'pid'=n->>'pid' and m->>'capability'=n->>'capability','account identity/plot ownership changed across devices';
 begin perform public.mconline_member(a,'Alice',s,'public','touch'); raise exception 'stale session accepted'; exception when raise_exception then if sqlerrm='stale session accepted' then raise; end if; end;
 update public.mconline_members set lease_until=now()-interval '1 second' where account=a;
 begin perform public.mconline_member(a,'Alice',s2,'city','touch'); raise exception 'expired lease accepted'; exception when raise_exception then if sqlerrm='expired lease accepted' then raise; end if; end;
end $$;
rollback;
select jsonb_build_object('passed',15,'synthetic_fixtures_rolled_back',true) as multiplayer_integration;
