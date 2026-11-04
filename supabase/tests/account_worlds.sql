-- ACCOUNT DB. Synthetic fixtures only. All inserts roll back. No live rows read.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ta text:=encode(extensions.gen_random_bytes(32),'hex'); tb text:=encode(extensions.gen_random_bytes(32),'hex'); wid text; d jsonb; r jsonb; rev bigint; previous bigint;
begin
 insert into public.community_users(id,username,pin_hash) values(a,'mc'||left(replace(a::text,'-',''),16),'synthetic-unusable-hash'),(b,'mc'||left(replace(b::text,'-',''),16),'synthetic-unusable-hash');
 insert into public.community_sessions(token_hash,user_id) values(encode(extensions.digest('rejson_comm_sess_v1:'||ta,'sha256'),'hex'),a),(encode(extensions.digest('rejson_comm_sess_v1:'||tb,'sha256'),'hex'),b);
 assert public.mconline_identity(ta)->>'id'=a::text,'identity is not stable UUID';
 begin perform public.mconline_identity('invalid-session-test-only'); raise exception 'invalid token accepted'; exception when invalid_authorization_specification then null; end;
 wid:='a'||a::text||'_'||gen_random_uuid()::text; d:=jsonb_build_object('id',wid,'seed',17,'mods',jsonb_build_object('1,2,3',4),'health',13);
 r:=public.mconline_worlds_op(ta,'put',wid,0,d); rev:=(r->>'revision')::bigint;
 assert jsonb_array_length(public.mconline_worlds_op(tb,'list')->'worlds')=0,'another account read world';
 assert public.mconline_worlds_op(ta,'list')->'worlds'->0->'data'->>'health'='13','cross-device snapshot missing';
 begin perform public.mconline_worlds_op(tb,'put',wid,rev,d); raise exception 'foreign world write accepted'; exception when raise_exception then if sqlerrm='foreign world write accepted' then raise; end if; end;
 r:=public.mconline_worlds_op(ta,'put',wid,rev,d||'{"health":8}'::jsonb); previous:=rev; rev:=(r->>'revision')::bigint;
 begin perform public.mconline_worlds_op(ta,'put',wid,previous,d); raise exception 'stale device overwrote'; exception when serialization_failure then null; end;
 begin perform public.mconline_worlds_op(ta,'delete',wid,previous); raise exception 'stale deletion accepted'; exception when serialization_failure then null; end;
 perform public.mconline_worlds_op(ta,'delete',wid,rev); r:=public.mconline_worlds_op(ta,'put',wid,0,d);
 assert (r->>'revision')::bigint>rev,'delete/recreate revision ABA';
 begin perform public.mconline_worlds_op(ta,'put',wid,rev,d); raise exception 'ABA stale overwrite'; exception when serialization_failure then null; end;
 delete from public.community_sessions where user_id=a;
 begin perform public.mconline_worlds_op(ta,'list'); raise exception 'revoked session accepted'; exception when invalid_authorization_specification then null; end;
 assert not has_table_privilege('anon','public.mconline_worlds','select'),'anonymous direct read';
 assert not has_table_privilege('anon','public.mconline_worlds','insert'),'anonymous direct insert';
end $$;
rollback;
select jsonb_build_object('passed',12,'synthetic_fixtures_rolled_back',true) as account_worlds_integration;
