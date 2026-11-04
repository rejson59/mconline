-- Deploy to the WORLD project bewwejewgqzctnjrbclu. No account credentials here.
create table public.mconline_members (
 account uuid primary key, pid text not null unique, capability text not null,
 username text not null, session text, world text, lease_until timestamptz,
 presence jsonb not null default '{}'
);
create table public.mconline_messages (
 id bigint generated always as identity primary key, world text not null, sender text not null,
 message_id text not null, payload jsonb not null, unique(world,sender,message_id), created_at timestamptz not null default now()
);
create index mconline_messages_world_id on public.mconline_messages(world,id);
alter table public.mconline_members enable row level security;
alter table public.mconline_messages enable row level security;
revoke all on public.mconline_members,public.mconline_messages from public,anon,authenticated;
create or replace function public.mconline_member(p_account uuid,p_username text,p_session text,p_world text,p_op text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare m public.mconline_members%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('mconline-inbox:'||p_world,0));
 if p_account is null or p_session is null or length(p_session)<>36 or p_world not in ('public','city') or p_world is null then raise exception 'Nieprawidłowa sesja gry.'; end if;
 insert into public.mconline_members(account,pid,capability,username)
 values(p_account,'p'||left(encode(sha256(convert_to(p_account::text,'UTF8')),'hex'),19),encode(extensions.gen_random_bytes(32),'hex'),left(p_username,20)) on conflict do nothing;
 select * into m from public.mconline_members where account=p_account for update;
 if p_op='join' then
   if m.lease_until>now() and m.session is distinct from p_session then raise exception 'Konto już gra na innym urządzeniu. Wyjdź tam z serwera lub odczekaj minutę.'; end if;
 elsif m.session is distinct from p_session or m.world is distinct from p_world or m.lease_until<=now() then raise exception 'Sesja gry wygasła. Połącz się ponownie.';
 end if;
 if p_op='leave' then
   update public.mconline_members set session=null,lease_until=null,presence='{}' where account=p_account;
 elsif p_op in ('join','touch') then
   update public.mconline_members set session=p_session,world=p_world,username=left(p_username,20),lease_until=now()+interval '60 seconds' where account=p_account;
 else raise exception 'Nieznana operacja sesji.'; end if;
 return jsonb_build_object('pid',m.pid,'capability',m.capability,'username',left(p_username,20),'cursor',(select coalesce(max(id),0) from public.mconline_messages where world=p_world));
end $$;
create or replace function public.mconline_poll(p_account uuid,p_session text,p_world text,p_presence jsonb,p_messages jsonb,p_since bigint default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare m public.mconline_members%rowtype; msgs jsonb; roster jsonb; head bigint; msg jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('mconline-inbox:'||p_world,0));
 select * into m from public.mconline_members where account=p_account for update;
 if not found or m.session is distinct from p_session or m.world is distinct from p_world or m.lease_until<=now() then raise exception 'Sesja gry wygasła.'; end if;
 if jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages)>40 or octet_length(p_messages::text)>65536 then raise exception 'Zbyt wiele wiadomości.'; end if;
 update public.mconline_members set presence=jsonb_build_object('id',m.pid,'name',m.username,'hue',p_presence->'hue','skin',left(p_presence->>'skin',24)) where account=p_account;
 delete from public.mconline_messages where created_at<now()-interval '2 minutes';
 for msg in select value from jsonb_array_elements(p_messages) loop
   if msg->>'t' not in ('pos','edits','drops','pvp','chat','tpa','bye') or msg->>'t' is null then raise exception 'Nieprawidłowa wiadomość.'; end if;
   if coalesce(msg->>'_mid','') !~ '^[a-f0-9-]{36}$' then raise exception 'Nieprawidłowy numer wiadomości.'; end if;
   insert into public.mconline_messages(world,sender,message_id,payload) values(p_world,m.pid,msg->>'_mid',msg||jsonb_build_object('from',m.pid,'name',m.username)) on conflict do nothing;
 end loop;
 -- Cursor is the last RETURNED row, never the table head when a page is full.
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'payload',payload) order by id),'[]'),coalesce(max(id),p_since) into msgs,head from
 (select id,payload from public.mconline_messages where world=p_world and id>p_since order by id limit 512) q;
 select coalesce(jsonb_object_agg(pid,jsonb_build_array(presence)),'{}') into roster from public.mconline_members where world=p_world and lease_until>now() and presence<>'{}'::jsonb;
 return jsonb_build_object('messages',msgs,'cursor',head,'presence',roster);
end $$;
revoke all on function public.mconline_member(uuid,text,text,text,text),public.mconline_poll(uuid,text,text,jsonb,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.mconline_member(uuid,text,text,text,text),public.mconline_poll(uuid,text,text,jsonb,jsonb,bigint) to service_role;
grant all on public.mconline_members,public.mconline_messages to service_role;
