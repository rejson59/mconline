-- Run after the shared-drops migration. All synthetic data is rolled back.
-- Exercise the actual privileges and security-definer RPC used by the browser.
begin;
set local role anon;
do $$
declare d jsonb; n integer; t bigint := floor(extract(epoch from now())*1000);
begin
 d := jsonb_build_object('uid','arena-regression-drop','owner','p1111111111111111111','d','o',
   'stack',jsonb_build_object('id',7,'count',12,'name','test-only'),
   'pos',jsonb_build_array(0,65,0),'vel',jsonb_build_array(0,0,0),'created',t,'expires',t+300000);
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p1111111111111111111','put',d); assert n=1, 'publish';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','claim',null,'arena-regression-drop','n'); assert n=0, 'dimension';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','claim',null,'arena-regression-drop','o'); assert n=1, 'winner';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p1111111111111111111','claim',null,'arena-regression-drop','o'); assert n=0, 'single winner';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','claim',null,'arena-regression-drop','o'); assert n=1, 'retry grant';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','list'); assert n=1, 'recover reserved';
 perform public.blockcraft_drop_op('arena-regression-20261029','p1111111111111111111','ack',null,'arena-regression-drop');
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','list'); assert n=1, 'unauthorized ack';
 perform public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','ack',null,'arena-regression-drop');
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p2222222222222222222','list'); assert n=0, 'delivered';
 select count(*) into n from public.blockcraft_drop_op('arena-regression-20261029','p1111111111111111111','put',d); assert n=0, 'no resurrection';
 assert not has_table_privilege('anon','public.blockcraft_drops','SELECT'), 'table protected';
end $$;
rollback;
