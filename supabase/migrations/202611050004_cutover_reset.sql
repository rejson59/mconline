-- WORLD DB, only after gateway verification. User approved a fresh start.
-- Device libraries and account/social data are NOT touched.
-- Retire every anonymous read/write/RPC route. SECURITY DEFINER game routines
-- are reachable exclusively through the Edge gateway's verified UUID mapping.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' and tablename like 'blockcraft\_%' escape '\' loop
   execute format('revoke all on public.%I from public,anon,authenticated',r.tablename);
 end loop;
 for r in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'blockcraft\_%' escape '\' loop
   execute format('revoke all on function %s from public,anon,authenticated',r.signature);
   execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;

delete from public.blockcraft_drops where world in ('public','city');
delete from public.blockcraft_plots where world in ('public','city');
delete from public.blockcraft_players where world in ('public','city');
delete from public.blockcraft_blocks where world in ('public','city');
