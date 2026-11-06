-- Synthetic data only. Changes and normal expiry housekeeping are rolled back.
begin;
create temporary table pickup_delay_result(checks integer);
do $$
declare
 w text := 'fixture-' || extensions.gen_random_uuid()::text;
 a text := 'p1111111111111111111'; b text := 'p2222222222222222222';
 stamp numeric := extract(epoch from clock_timestamp())*1000;
 d jsonb; n integer; checks integer := 0;
begin
 if has_function_privilege('anon','public.blockcraft_drop_op(text,text,text,jsonb,text,text)','execute') then raise exception 'anon bypass'; end if; checks:=checks+1;
 if has_function_privilege('authenticated','public.blockcraft_drop_op(text,text,text,jsonb,text,text)','execute') then raise exception 'JWT bypass'; end if; checks:=checks+1;
 if not has_function_privilege('service_role','public.blockcraft_drop_op(text,text,text,jsonb,text,text)','execute') then raise exception 'service denied'; end if; checks:=checks+1;
 d:=jsonb_build_object('uid','throw-1','owner',a,'d','o','created',stamp,'expires',stamp+300000,'pickupAfter',stamp+2000,'stack',jsonb_build_object('id',1,'count',7),'pos','[0,65,0]'::jsonb,'vel','[0,2,-4]'::jsonb);
 perform public.blockcraft_drop_op(w,a,'put',d);
 perform public.blockcraft_drop_op(w,a,'put',d);
 select count(*) into n from public.blockcraft_drops where world=w; if n<>1 then raise exception 'put not idempotent'; end if; checks:=checks+1;
 select count(*) into n from public.blockcraft_drop_op(w,a,'claim',null,'throw-1','o'); if n<>0 then raise exception 'instant owner reclaim'; end if; checks:=checks+1;
 select count(*) into n from public.blockcraft_drop_op(w,b,'claim',null,'throw-1','n'); if n<>0 then raise exception 'dimension leak'; end if; checks:=checks+1;
 select count(*) into n from public.blockcraft_drop_op(w,b,'claim',null,'throw-1','o'); if n<>1 then raise exception 'other player blocked by owner grace'; end if; checks:=checks+1;
 select count(*) into n from public.blockcraft_drop_op(w,b,'claim',null,'throw-1','o'); if n<>1 then raise exception 'lost grant not replayable'; end if; checks:=checks+1;
 select count(*) into n from public.blockcraft_drop_op(w,a,'claim',null,'throw-1','o'); if n<>0 then raise exception 'grant stolen'; end if; checks:=checks+1;
 perform public.blockcraft_drop_op(w,a,'ack',null,'throw-1');
 if not exists(select 1 from public.blockcraft_drops where world=w and uid='throw-1' and not acknowledged) then raise exception 'wrong ack accepted'; end if; checks:=checks+1;
 perform public.blockcraft_drop_op(w,b,'ack',null,'throw-1'); perform public.blockcraft_drop_op(w,a,'put',d);
 select count(*) into n from public.blockcraft_drop_op(w,b,'list'); if n<>0 then raise exception 'resurrected after ack'; end if; checks:=checks+1;
 d:=d||jsonb_build_object('uid','throw-2','created',stamp-2100,'expires',stamp+297900,'pickupAfter',stamp-100);
 perform public.blockcraft_drop_op(w,a,'put',d);
 select count(*) into n from public.blockcraft_drop_op(w,a,'claim',null,'throw-2','o'); if n<>1 then raise exception 'expired owner grace still blocks'; end if; checks:=checks+1;
 d:=(d-'pickupAfter')||jsonb_build_object('uid','ordinary-drop'); perform public.blockcraft_drop_op(w,a,'put',d);
 select count(*) into n from public.blockcraft_drop_op(w,a,'claim',null,'ordinary-drop','o'); if n<>1 then raise exception 'ordinary mining loot unnecessarily delayed'; end if; checks:=checks+1;
 begin
  perform public.blockcraft_drop_op(w,a,'put',d||jsonb_build_object('uid','invalid-delay','pickupAfter',stamp+500000));
  raise exception using errcode='XX001',message='unbounded delay accepted';
 exception when raise_exception then checks:=checks+1; end;
 begin
  perform public.blockcraft_drop_op(w,a,'put',d||jsonb_build_object('uid','invalid-type','pickupAfter','forever'));
  raise exception using errcode='XX001',message='text delay accepted';
 exception when raise_exception or invalid_text_representation then checks:=checks+1; end;
 insert into pickup_delay_result values(checks);
end $$;
select checks, 'PASS — synthetic fixture rolled back' as result from pickup_delay_result;
rollback;
