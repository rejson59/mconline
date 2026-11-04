-- Deploy to the account project hzbqzfimtroixnldzjeq, not the old world DB.
-- Existing community_* tables/functions are not altered.
create sequence public.mconline_world_versions;
create table public.mconline_worlds (
 owner uuid not null references public.community_users(id) on delete cascade, id text not null,
 revision bigint not null default 1, data jsonb not null, updated_at timestamptz not null default now(),
 primary key(owner,id), check(octet_length(data::text)<=8388608)
);
alter table public.mconline_worlds enable row level security;
revoke all on public.mconline_worlds from public,anon,authenticated;
create or replace function public.mconline_identity(p_token text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,extensions as $$
declare u record;
begin
 if p_token is null or length(p_token) not between 16 and 512 then raise exception 'Wymagane logowanie.' using errcode='28000'; end if;
 select cu.id,cu.username into u from public.community_sessions cs join public.community_users cu on cu.id=cs.user_id
 where cs.token_hash=encode(extensions.digest('rejson_comm_sess_v1:'||trim(p_token),'sha256'),'hex');
 if u.id is null then raise exception 'Sesja wygasła. Zaloguj się ponownie.' using errcode='28000'; end if;
 return jsonb_build_object('id',u.id,'username',u.username);
end $$;
create or replace function public.mconline_worlds_op(p_token text,p_op text,p_id text default null,p_expected bigint default 0,p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare uid uuid; current_revision bigint; next_revision bigint; result jsonb; identity jsonb;
begin
 identity:=public.mconline_identity(p_token); uid:=(identity->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('mconline-worlds:'||uid::text,0));
 if p_op='list' then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'data',data) order by updated_at desc),'[]') into result from public.mconline_worlds where owner=uid;
   return jsonb_build_object('identity',identity,'worlds',result,'epoch','2026-11-05');
 end if;
 if p_id is null or length(p_id) not between 1 and 120 or p_id !~ ('^a'||uid::text||'_[a-f0-9-]{36}$') then raise exception 'Nieprawidłowy identyfikator świata.'; end if;
 select revision into current_revision from public.mconline_worlds where owner=uid and id=p_id for update;
 if coalesce(current_revision,0) is distinct from p_expected then raise exception 'Konflikt wersji: świat zmieniono na innym urządzeniu.' using errcode='40001'; end if;
 if p_op='delete' then
   delete from public.mconline_worlds where owner=uid and id=p_id;
   return jsonb_build_object('revision',0);
 elsif p_op='put' then
   if p_data is null or jsonb_typeof(p_data)<>'object' or p_data->>'id' is distinct from p_id or jsonb_typeof(p_data->'seed') is distinct from 'number' or octet_length(p_data::text)>8388608 then raise exception 'Nieprawidłowy lub zbyt duży zapis (limit 8 MiB).'; end if;
   if current_revision is null and (select count(*) from public.mconline_worlds where owner=uid)>=8 then raise exception 'Limit 8 światów na koncie.'; end if;
   if (select coalesce(sum(octet_length(data::text)),0) from public.mconline_worlds where owner=uid and id<>p_id)+octet_length(p_data::text)>33554432 then raise exception 'Limit 32 MiB zapisów na koncie.'; end if;
   next_revision:=nextval('public.mconline_world_versions');
   insert into public.mconline_worlds(owner,id,revision,data) values(uid,p_id,next_revision,p_data)
   on conflict(owner,id) do update set revision=excluded.revision,data=excluded.data,updated_at=clock_timestamp();
   return jsonb_build_object('revision',next_revision);
 else raise exception 'Nieznana operacja świata.'; end if;
end $$;
revoke all on function public.mconline_identity(text),public.mconline_worlds_op(text,text,text,bigint,jsonb) from public;
grant execute on function public.mconline_identity(text),public.mconline_worlds_op(text,text,text,bigint,jsonb) to anon,authenticated;
