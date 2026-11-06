-- No reset. Existing drop expiry/tombstone lifecycle remains unchanged.
-- Adds owner-only throw cooldown to the existing CAS arbiter.
create or replace function public.blockcraft_drop_op(
  p_world text, p_actor text, p_op text, p_drop jsonb default null,
  p_uid text default null, p_dim text default null
) returns setof jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.blockcraft_drops%rowtype; expiry timestamptz; n numeric;
begin
  if p_world is null or length(p_world) not between 1 and 80 or
     p_actor is null or p_actor !~ '^p[0-9a-f]{19}$' then
    raise exception 'Invalid world or player identity';
  end if;
  if p_op = 'put' then
    if p_drop ? 'pickupAfter' and (jsonb_typeof(p_drop->'pickupAfter') is distinct from 'number' or
       (p_drop->>'pickupAfter')::numeric < (p_drop->>'created')::numeric or
       (p_drop->>'pickupAfter')::numeric > (p_drop->>'created')::numeric + 2000) then raise exception 'Invalid pickup delay'; end if;
    if p_drop is null or octet_length(p_drop::text) > 8192 or
       p_drop->>'owner' is distinct from p_actor or p_drop ? 'claimedBy' or
       coalesce(p_drop->>'uid','') !~ '^[a-zA-Z0-9_:-]{1,160}$' or
       coalesce(p_drop->>'d','') not in ('o','n') or
       jsonb_typeof(p_drop->'created') is distinct from 'number' or
       jsonb_typeof(p_drop->'expires') is distinct from 'number' or
       jsonb_typeof(p_drop->'stack') is distinct from 'object' or
       jsonb_typeof(p_drop->'pos') is distinct from 'array' or
       jsonb_typeof(p_drop->'vel') is distinct from 'array' then
      raise exception 'Invalid drop';
    end if;
    if jsonb_array_length(p_drop->'pos') <> 3 or jsonb_array_length(p_drop->'vel') <> 3 then raise exception 'Invalid vectors'; end if;
    for n in select value::text::numeric from jsonb_array_elements(p_drop->'pos') loop
      if n is null or abs(n) > 1000000 then raise exception 'Position out of range'; end if;
    end loop;
    for n in select value::text::numeric from jsonb_array_elements(p_drop->'vel') loop
      if n is null or abs(n) > 100 then raise exception 'Velocity out of range'; end if;
    end loop;
    n := (p_drop->'stack'->>'count')::numeric;
    if n is null or n <> trunc(n) or n not between 1 and 64 then raise exception 'Invalid count'; end if;
    n := (p_drop->'stack'->>'id')::numeric;
    if n is null or n <> trunc(n) or n not between 1 and 65535 then raise exception 'Invalid item'; end if;
    expiry := to_timestamp((p_drop->>'expires')::double precision / 1000);
    if expiry is null or expiry > now() + interval '5 minutes 10 seconds' or
       (p_drop->>'created')::numeric > extract(epoch from now())*1000 + 10000 or
       (p_drop->>'expires')::numeric - (p_drop->>'created')::numeric not between 1 and 300000 then raise exception 'Invalid lifetime'; end if;
    -- Retain tombstones longer than the entire retry/outbox lifetime.
    delete from public.blockcraft_drops where expires_at < now() - interval '1 day' and (acknowledged or claimed_by is null);
    if expiry <= now() then return; end if;
    insert into public.blockcraft_drops(world,uid,owner,payload,expires_at)
      values(p_world,p_drop->>'uid',p_actor,p_drop,expiry) on conflict do nothing;
    return query select payload from public.blockcraft_drops where world=p_world and uid=p_drop->>'uid' and not acknowledged and claimed_by is null;
  elsif p_op = 'claim' then
    if p_dim is null or p_dim not in ('o','n') then return; end if;
    select * into r from public.blockcraft_drops where world=p_world and uid=p_uid for update;
    if not found or r.acknowledged or r.payload->>'d' <> p_dim or
       (r.claimed_by is null and r.expires_at <= now()) or
       (r.claimed_by is not null and r.claimed_by <> p_actor) then return; end if;
    -- An already granted delivery is always replayable, even during grace.
    if r.claimed_by is null and r.owner = p_actor and
       coalesce((r.payload->>'pickupAfter')::numeric, 0) > extract(epoch from clock_timestamp()) * 1000 then return; end if;
    update public.blockcraft_drops set claimed_by=p_actor where world=p_world and uid=p_uid;
    return next jsonb_set(r.payload,'{claimedBy}',to_jsonb(p_actor));
  elsif p_op = 'ack' then
    update public.blockcraft_drops set acknowledged=true where world=p_world and uid=p_uid and claimed_by=p_actor;
  elsif p_op = 'list' then
    return query select case when claimed_by is null then payload else jsonb_set(payload,'{claimedBy}',to_jsonb(claimed_by)) end
      from public.blockcraft_drops where world=p_world and not acknowledged and
      ((claimed_by is null and expires_at > now()) or claimed_by=p_actor)
      order by expires_at desc limit 2048;
  else raise exception 'Invalid operation';
  end if;
end; $$;

-- Keep the authenticated gateway as the only public-world entry point.
revoke all on function public.blockcraft_drop_op(text,text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.blockcraft_drop_op(text,text,text,jsonb,text,text) to service_role;
