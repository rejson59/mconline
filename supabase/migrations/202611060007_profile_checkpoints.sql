-- WORLD only. No reset. Fence profile writes atomically with account membership.
alter table public.blockcraft_players add column if not exists save_id text;
create or replace function public.mconline_profile(p_account uuid,p_username text,p_session text,p_world text,p_profile jsonb,p_guard boolean default false,p_expected timestamptz default null,p_save text default null,p_leave boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare member jsonb; previous public.blockcraft_players%rowtype; next public.blockcraft_players%rowtype; stamp timestamptz;
begin
 -- The member/world locks are held until the profile commit (and optional leave).
 member:=public.mconline_member_v2(p_account,p_username,p_session,p_world,'touch',null);
 select * into previous from public.blockcraft_players where world=p_world and pid=member->>'pid' for update;
 if p_save is not null and previous.save_id=p_save then
   if p_leave then perform public.mconline_member_v2(p_account,p_username,p_session,p_world,'leave',null); end if;
   return jsonb_build_array(to_jsonb(previous));
 end if;
 if p_guard and previous.updated_at is distinct from p_expected then
   raise exception 'Zapis ekwipunku zmienił się. Kopia lokalna została zachowana.' using errcode='P0410';
 end if;
 if jsonb_typeof((p_profile->>'inv')::jsonb) is distinct from 'array' or jsonb_typeof((p_profile->>'armor')::jsonb) is distinct from 'array' then
   raise exception 'Nieprawidłowy zapis ekwipunku.';
 end if;
 stamp:=greatest(clock_timestamp(),coalesce(previous.updated_at,'epoch')+interval '1 microsecond');
 select * into next from jsonb_populate_record(null::public.blockcraft_players,
   jsonb_build_object('x',0,'y',70,'z',0,'yaw',0,'pitch',0,'health',20,'hunger',20,'xp',0,'skin','','dim','o') ||
   p_profile || jsonb_build_object('world',p_world,'pid',member->>'pid','name',member->>'username','updated_at',stamp,'save_id',coalesce(p_save,extensions.gen_random_uuid()::text)));
 insert into public.blockcraft_players select next.*
 on conflict(world,pid) do update set name=excluded.name,skin=excluded.skin,x=excluded.x,y=excluded.y,z=excluded.z,dim=excluded.dim,yaw=excluded.yaw,pitch=excluded.pitch,health=excluded.health,hunger=excluded.hunger,xp=excluded.xp,inv=excluded.inv,armor=excluded.armor,updated_at=excluded.updated_at,save_id=excluded.save_id returning * into next;
 if p_leave then perform public.mconline_member_v2(p_account,p_username,p_session,p_world,'leave',null); end if;
 return jsonb_build_array(to_jsonb(next));
end $$;
revoke all on function public.mconline_profile(uuid,text,text,text,jsonb,boolean,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.mconline_profile(uuid,text,text,text,jsonb,boolean,timestamptz,text,boolean) to service_role;
