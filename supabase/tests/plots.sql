-- Run as a migration administrator. Everything is rolled back.
-- Synthetic capability strings below are test fixtures, not real player keys.
begin;
do $$ begin
  if exists(select 1 from public.blockcraft_plots where world='public' and cx between 1500000 and 1500007 and cz=-1500000)
    or exists(select 1 from public.blockcraft_blocks where world='public' and x between 24000000 and 24000127 and z=-24000000)
    or exists(select 1 from public.blockcraft_players where world='public' and pid='p00000000000000000ab') then
    raise exception 'Occupied test fixtures; refusing to touch them.';
  end if;
end $$;
set local role anon;
do $$
declare a text:=repeat('1',64); b text:=repeat('2',64); r jsonb; version_before bigint; blocked boolean;
begin
  assert not has_table_privilege(current_user,'public.blockcraft_blocks','INSERT');
  assert not has_table_privilege(current_user,'public.blockcraft_blocks','UPDATE');
  assert not has_table_privilege(current_user,'public.blockcraft_blocks','DELETE');
  r:=public.blockcraft_plot('public',a,'claim',1500000,-1500000,'Owner A');
  assert r->>'owner'=encode(sha256(convert_to(a,'UTF8')),'hex');
  assert jsonb_array_length(r->'plots')>=1;
  blocked:=false;
  begin perform public.blockcraft_plot('public',b,'claim',1500000,-1500000,'Impostor A');
  exception when others then if sqlerrm like '%zajęta%' then blocked:=true; else raise; end if; end;
  assert blocked, 'An occupied plot must not change owners';
  r:=public.blockcraft_write_blocks('public',a,'[{"x":24000000,"y":255,"z":-24000000,"id":3,"d":"o"}]');
  assert jsonb_array_length(r->'accepted')=1;
  version_before:=(r->'accepted'->0->>'version')::bigint;
  r:=public.blockcraft_write_blocks('public',b,'[{"x":24000000,"y":255,"z":-24000000,"id":0,"d":"o"},{"x":24000000,"y":0,"z":-24000000,"id":3,"d":"o"}]');
  assert jsonb_array_length(r->'accepted')=0 and jsonb_array_length(r->'rejected')=2;
  assert (r->'rejected'->0->>'id')::integer=3;
  assert r->'rejected'->1->'id'='null'::jsonb;
  assert (select block=3 from public.blockcraft_blocks where world='public' and dim='o' and x=24000000 and y=255 and z=-24000000);
  r:=public.blockcraft_write_blocks('public',a,'[{"x":24000000,"y":255,"z":-24000000,"id":4,"d":"o"}]');
  assert (r->'accepted'->0->>'version')::bigint>version_before;
  r:=public.blockcraft_write_blocks('public',b,'[{"x":24000000,"y":10,"z":-24000000,"id":3,"d":"n"}]');
  assert jsonb_array_length(r->'accepted')=1, 'Plots protect only the overworld';
  blocked:=false;
  begin insert into public.blockcraft_blocks(world,dim,x,y,z,block) values('public','o',24000000,255,-24000000,0);
  exception when insufficient_privilege then blocked:=true; end;
  assert blocked, 'Direct table writes cannot bypass the RPC';
  blocked:=false;
  begin perform public.blockcraft_plot('public',b,'release',1500000,-1500000);
  exception when others then if sqlerrm like '%twoja%' then blocked:=true; else raise; end if; end;
  assert blocked;
  perform public.blockcraft_plot('public',a,'claim',1500001,-1500000);
  perform public.blockcraft_plot('public',a,'claim',1500002,-1500000);
  perform public.blockcraft_plot('public',a,'claim',1500003,-1500000);
  blocked:=false;
  begin perform public.blockcraft_plot('public',a,'claim',1500004,-1500000);
  exception when others then if sqlerrm like '%Limit%' then blocked:=true; else raise; end if; end;
  assert blocked, 'Four-plot quota is enforced in SQL';
  perform public.blockcraft_plot('public',a,'release',1500000,-1500000);
  blocked:=false;
  begin perform public.blockcraft_plot('public',b,'claim',1500000,-1500000);
  exception when others then if sqlerrm like '%budowle%' then blocked:=true; else raise; end if; end;
  assert blocked, 'Releasing does not let someone claim another player''s building';
  perform public.blockcraft_plot('public',a,'claim',1500000,-1500000);
  -- A write to wilderness is attributable and prevents someone else claiming it.
  perform public.blockcraft_write_blocks('public',a,'[{"x":24000080,"y":1,"z":-24000000,"id":3,"d":"o"}]');
  blocked:=false;
  begin perform public.blockcraft_plot('public',b,'claim',1500005,-1500000);
  exception when others then if sqlerrm like '%budowle%' then blocked:=true; else raise; end if; end;
  assert blocked;
  blocked:=false;
  begin perform public.blockcraft_write_blocks('other-world',a,'[]'); exception when others then blocked:=true; end;
  assert blocked, 'RPC cannot modify other worlds';
  blocked:=false;
  begin perform public.blockcraft_write_blocks('public','bad-key','[]'); exception when others then blocked:=true; end;
  assert blocked, 'RPC validates capability format';
  blocked:=false;
  begin perform public.blockcraft_write_blocks('public',a,'[{"x":24000000,"y":256,"z":-24000000,"id":3,"d":"o"}]'); exception when others then blocked:=true; end;
  assert blocked, 'Out-of-range blocks cannot be written';
end $$;
-- The achievement trigger preserves both tabs and even old clients' short arrays.
do $$
declare items jsonb := '[]'; saved jsonb;
begin
  while jsonb_array_length(items)<50 loop items:=items || 'null'::jsonb; end loop;
  items:=items || '[["wood"]]'::jsonb;
  insert into public.blockcraft_players(world,pid,inv,updated_at) values('public','p00000000000000000ab',items::text,clock_timestamp());
  items:=jsonb_set(items,'{50}','["wolf"]');
  update public.blockcraft_players set inv=items::text,updated_at=clock_timestamp()+interval '1 second' where world='public' and pid='p00000000000000000ab';
  select inv::jsonb into saved from public.blockcraft_players where world='public' and pid='p00000000000000000ab';
  assert saved->50 @> '["wood","wolf"]'::jsonb;
  update public.blockcraft_players set inv='[]',updated_at=clock_timestamp()+interval '2 seconds' where world='public' and pid='p00000000000000000ab';
  select inv::jsonb into saved from public.blockcraft_players where world='public' and pid='p00000000000000000ab';
  assert saved->50 @> '["wood","wolf"]'::jsonb, 'Legacy saves cannot erase earned achievements';
end $$;
rollback;
