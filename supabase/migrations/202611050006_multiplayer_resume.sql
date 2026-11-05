-- WORLD project only. Fix report 1b53b6a5-0561-46ac-b8ef-899eeb26f32f.
-- No resets: preserve every world, inventory, account mapping and capability.
alter table public.mconline_members add column if not exists resume_hash text;
create or replace function public.mconline_member_v2(p_account uuid,p_username text,p_session text,p_world text,p_op text,p_resume text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare m public.mconline_members%rowtype; proof text; at timestamptz;
begin
 if p_account is null or p_session is null or p_session !~ '^[a-f0-9-]{36}$' or p_world is null or p_world not in ('public','city') or p_op is null or p_op not in ('join','replace','touch','leave') then raise exception 'Nieprawidłowa sesja gry.'; end if;
 if p_resume is not null then
   if p_resume !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy identyfikator powrotu.'; end if;
   proof:=encode(sha256(convert_to(p_resume,'UTF8')),'hex');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('mconline-inbox:'||p_world,0));
 if p_op in ('join','replace') then
   insert into public.mconline_members(account,pid,capability,username)
   values(p_account,'p'||left(encode(sha256(convert_to(p_account::text,'UTF8')),'hex'),19),encode(extensions.gen_random_bytes(32),'hex'),left(p_username,20)) on conflict do nothing;
 end if;
 select * into m from public.mconline_members where account=p_account for update;
 at:=clock_timestamp(); -- Renew from lock acquisition, not an old transaction start.
 if not found then raise exception 'Sesja gry wygasła. Połącz się ponownie.'; end if;
 if p_op in ('join','replace') then
   -- Only the SAME live tab's secret can resume automatically. Every join has
   -- a new session generation, so delayed old leave/touch cannot affect it.
   if p_op='join' and m.lease_until>at and m.session is distinct from p_session and (proof is null or m.resume_hash is distinct from proof) then
     raise exception 'Serwer pamięta wcześniejsze połączenie konta.' using errcode='P0409';
   end if;
 elsif m.session is distinct from p_session or m.world is distinct from p_world or m.lease_until is null or m.lease_until<=at then
   raise exception 'Sesja gry wygasła. Połącz się ponownie.';
 end if;
 if p_op='leave' then
   update public.mconline_members set session=null,lease_until=null,presence='{}' where account=p_account;
 else
   update public.mconline_members set session=p_session,world=p_world,username=left(p_username,20),lease_until=at+interval '60 seconds',
     resume_hash=case when p_op in ('join','replace') then proof else resume_hash end,
     presence=case when p_op in ('join','replace') and (m.session is distinct from p_session or m.world is distinct from p_world) then '{}'::jsonb else presence end
   where account=p_account;
 end if;
 return jsonb_build_object('pid',m.pid,'capability',m.capability,'username',left(p_username,20),'cursor',(select coalesce(max(id),0) from public.mconline_messages where world=p_world));
end $$;
-- Legacy service-only callers keep working, but cannot implicitly take over.
create or replace function public.mconline_member(p_account uuid,p_username text,p_session text,p_world text,p_op text)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.mconline_member_v2(p_account,p_username,p_session,p_world,p_op,null)
$$;
revoke all on function public.mconline_member_v2(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mconline_member_v2(uuid,text,text,text,text,text) to service_role;
