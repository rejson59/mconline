-- Achievements are monotonic, even when another tab/old client saves last.
-- Inventory tail 50 is compatible with the existing first 36 item slots.
create or replace function public.blockcraft_keep_achievements()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare items jsonb; previous jsonb := '[]'; achievements jsonb;
begin
  begin
    items := new.inv::jsonb;
    if tg_op='UPDATE' then previous := old.inv::jsonb; end if;
  exception when others then return new;
  end;
  if jsonb_typeof(items) is distinct from 'array' then return new; end if;
  select coalesce(jsonb_agg(to_jsonb(id) order by id),'[]'::jsonb) into achievements from (
    select distinct v #>> '{}' as id from jsonb_array_elements(
      (case when jsonb_typeof(items->50)='array' then items->50 else '[]'::jsonb end) ||
      (case when jsonb_typeof(previous->50)='array' then previous->50 else '[]'::jsonb end)
    ) v where jsonb_typeof(v)='string' and (v #>> '{}') ~ '^[a-z_]{1,40}$'
  ) a;
  while jsonb_array_length(items)<51 loop items := items || 'null'::jsonb; end loop;
  new.inv := jsonb_set(items,'{50}',achievements)::text;
  return new;
end $$;
drop trigger if exists blockcraft_achievement_union on public.blockcraft_players;
create trigger blockcraft_achievement_union before insert or update on public.blockcraft_players for each row execute function public.blockcraft_keep_achievements();
