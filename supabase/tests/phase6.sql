begin;
insert into auth.users(id) values('a7157311-ace0-4a59-9600-000000000001'),('a7157311-ace0-4a59-9600-000000000002');
update public.users set latitude=-34.60,longitude=-58.38,timezone='America/Argentina/Buenos_Aires',reminder_time='00:00',weather_alerts=true,season_marker='south:2000:Invierno' where id='a7157311-ace0-4a59-9600-000000000001';
insert into public.user_plants(id,user_id,nickname) values('b7157311-ace0-4a59-9600-000000000001','a7157311-ace0-4a59-9600-000000000001','Planta con avisos');
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9600-000000000001',true);
select public.save_watering_schedule('b7157311-ace0-4a59-9600-000000000001',null,7,'manual','2026-01-01',true);
select public.save_push_subscription('https://fcm.googleapis.com/test/device',repeat('B',87),repeat('A',22));
do $$ begin
  begin perform public.save_push_subscription('https://127.0.0.1/secret',repeat('B',87),repeat('A',22));raise exception 'FAIL: SSRF';exception when check_violation then null;end;
  begin perform public.generate_user_alerts('a7157311-ace0-4a59-9600-000000000002');raise exception 'FAIL: generación ajena';exception when insufficient_privilege then null;end;
end; $$;
set local role service_role;
do $$ begin
  if public.notification_season_marker(-34,'2026-12-31')<>public.notification_season_marker(-34,'2027-01-01')
    or public.notification_season_marker(40,'2026-12-31')<>public.notification_season_marker(40,'2027-02-28') then
    raise exception 'FAIL: Año Nuevo no cambia la estación'; end if;
  if public.notification_season_marker(-34,'2027-02-28')=public.notification_season_marker(-34,'2027-03-01') then
    raise exception 'FAIL: cambio estacional omitido'; end if;
end; $$;
insert into public.weather_snapshots(user_id,latitude,longitude,temperature_c,humidity_percent,rain_mm,provider,observed_at,expires_at)
values('a7157311-ace0-4a59-9600-000000000001',-34.60,-58.38,38,30,0,'openweathermap',now(),now()+interval '1 hour');
set local role authenticated;
select public.refresh_my_alerts();select public.refresh_my_alerts();
do $$ begin
  if (select count(*) from public.alerts)<>3 then raise exception 'FAIL: generación o deduplicación';end if;
  if (select count(*) from public.notification_deliveries)<>3 then raise exception 'FAIL: duplicados en cola';end if;
end; $$;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9600-000000000002',true);
do $$ begin
  if exists(select 1 from public.alerts) or exists(select 1 from public.notification_deliveries) or exists(select 1 from public.push_subscriptions) then raise exception 'FAIL: aislamiento';end if;
  begin perform public.claim_notification_deliveries(true,true,10);raise exception 'FAIL: cola pública';exception when insufficient_privilege then null;end;
  begin perform public.save_push_subscription('https://fcm.googleapis.com/test/device',repeat('B',87),repeat('A',22));raise exception 'FAIL: apropiación de dispositivo';exception when insufficient_privilege then null;end;
end; $$;
set local role service_role;
do $$ declare job public.notification_deliveries; begin
  if (select count(*) from public.claim_notification_users(5))<>1 then raise exception 'FAIL: barrido';end if;
  if (select count(*) from public.claim_notification_users(5))<>0 then raise exception 'FAIL: barrido duplicado';end if;
  select * into job from public.claim_notification_deliveries(true,false,1);
  if job.attempts<>1 or job.lock_token is null then raise exception 'FAIL: lease';end if;
  if public.get_notification_payload(job.id,gen_random_uuid()) is not null then raise exception 'FAIL: token incorrecto';end if;
  if public.get_notification_payload(job.id,job.lock_token) is null then raise exception 'FAIL: payload';end if;
  perform public.finish_notification_delivery(job.id,gen_random_uuid(),'sent',null);
  if (select status from public.notification_deliveries where id=job.id)<>'processing' then raise exception 'FAIL: finalización sin token';end if;
  perform public.finish_notification_delivery(job.id,job.lock_token,'retry','timeout');
  if not exists(select 1 from public.notification_deliveries where id=job.id and status='pending' and next_attempt_at>now()) then raise exception 'FAIL: reintento';end if;
end; $$;
-- Registrar un riego invalida incluso una entrega previamente encolada.
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9600-000000000001',true);
select public.save_journal_entry('c7157311-ace0-4a59-9600-000000000001','b7157311-ace0-4a59-9600-000000000001',null,(now() at time zone 'America/Argentina/Buenos_Aires')::date,'watering','Riego',null,null,null,null,false);
set local role service_role;
select * from public.claim_notification_deliveries(true,false,10);
do $$ begin
  if not exists(select 1 from public.notification_deliveries d join public.alerts a on a.id=d.alert_id where a.kind='care_due' and d.status='cancelled') then raise exception 'FAIL: riego obsoleto';end if;
end; $$;
update public.users set push_reminders=false where id='a7157311-ace0-4a59-9600-000000000001';
select * from public.claim_notification_deliveries(true,false,10);
do $$ begin
  if exists(select 1 from public.notification_deliveries where status in ('pending','processing')) then raise exception 'FAIL: preferencias ignoradas';end if;
end; $$;
-- Un primer ingreso establece la estación sin inventar un cambio.
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9600-000000000002',true);
update public.users set latitude=40,longitude=-3 where id=auth.uid();select public.refresh_my_alerts();
do $$ begin if exists(select 1 from public.alerts) then raise exception 'FAIL: falso cambio inicial';end if;end; $$;
rollback;
