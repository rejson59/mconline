-- Account DB: harden the initial deployment before opening the client.
-- 001 in the repository already includes this correction for fresh installs.
create sequence if not exists public.mconline_world_versions;
do $$ declare definition text; begin
 select pg_get_functiondef('public.mconline_worlds_op(text,text,text,bigint,jsonb)'::regprocedure) into definition;
 if definition like '%coalesce(current_revision,0)+1%' then
   definition:=replace(definition,'current_revision bigint;','current_revision bigint; next_revision bigint;');
   definition:=replace(definition,'insert into public.mconline_worlds(owner', 'next_revision:=nextval(''public.mconline_world_versions''); insert into public.mconline_worlds(owner');
   definition:=replace(definition,'coalesce(current_revision,0)+1','next_revision');
   execute definition;
 end if;
end $$;
revoke all on sequence public.mconline_world_versions from public,anon,authenticated;
