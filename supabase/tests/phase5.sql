-- SQL Editor con rol postgres. Todos los datos se revierten.
begin;
insert into auth.users(id) values('a7157311-ace0-4a59-9500-000000000001'),('a7157311-ace0-4a59-9500-000000000002');
update public.users set latitude=-34.60,longitude=-58.38,timezone='America/Argentina/Buenos_Aires' where id='a7157311-ace0-4a59-9500-000000000001';
insert into public.user_plants(id,user_id,nickname,placement) values('b7157311-ace0-4a59-9500-000000000001','a7157311-ace0-4a59-9500-000000000001','Riego prueba','outdoor');
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9500-000000000001',true);
do $$
declare south jsonb; north jsonb; manual jsonb; summer jsonb; winter jsonb;
begin
  south:=public.watering_recommendation(10,'adaptive','outdoor',-34,'2026-01-01',null,null,null);
  north:=public.watering_recommendation(10,'adaptive','outdoor',40,'2026-01-01',null,null,null);
  if south->>'season'<>'Verano' or north->>'season'<>'Invierno' then raise exception 'FAIL: hemisferios'; end if;
  if (south->>'days')::integer >= (north->>'days')::integer then raise exception 'FAIL: invierno acorta intervalo'; end if;
  summer:=public.watering_recommendation(10,'adaptive','outdoor',-34,'2026-01-01',32,30,0);
  winter:=public.watering_recommendation(10,'adaptive','outdoor',-34,'2026-07-01',8,90,5);
  if (summer->>'days')::integer >= (winter->>'days')::integer then raise exception 'FAIL: calor y frío'; end if;
  manual:=public.watering_recommendation(10,'manual','outdoor',-34,'2026-01-01',40,10,0);
  if (manual->>'days')::integer<>10 or (manual->>'weatherUsed')::boolean then raise exception 'FAIL: modo manual'; end if;
  if public.watering_recommendation(10,'adaptive','indoor',-34,'2026-01-01',40,10,0)
    <>public.watering_recommendation(10,'adaptive','indoor',-34,'2026-01-01',-5,99,100) then raise exception 'FAIL: clima exterior aplicado en interior'; end if;
  if (public.watering_recommendation(10,'adaptive','outdoor',0,'2026-01-01',null,null,null)->>'days')::integer<>10 then raise exception 'FAIL: estación ecuatorial'; end if;
  if (public.watering_recommendation(10,'adaptive','outdoor',null,'2026-01-01',null,null,null)->>'days')::integer<>10 then raise exception 'FAIL: ubicación ausente'; end if;
  if (public.watering_recommendation(1,'adaptive','outdoor',-34,'2026-01-01',50,10,0)->>'days')::integer<1 then raise exception 'FAIL: mínimo'; end if;
  if (public.watering_recommendation(730,'adaptive','outdoor',-34,'2026-07-01',0,99,100)->>'days')::integer>730 then raise exception 'FAIL: máximo'; end if;
end; $$;
select public.save_watering_schedule('b7157311-ace0-4a59-9500-000000000001',null,7,'manual','2026-01-01',true);
do $$ declare a public.watering_agenda; begin
  select * into a from public.watering_agenda;
  if a.due_on<>'2026-01-08' or a.last_watered_on is not null then raise exception 'FAIL: fecha sin riegos'; end if;
  begin
    perform public.save_watering_schedule(a.user_plant_id,null,5,'manual','2026-01-01',true);
    raise exception 'FAIL: alta duplicada sin conflicto';
  exception when serialization_failure then null; end;
  begin
    perform public.save_watering_schedule(a.user_plant_id,a.version,5,'manual',current_date+2,true);
    raise exception 'FAIL: fecha futura';
  exception when check_violation then null; end;
end; $$;
select public.save_journal_entry('c7157311-ace0-4a59-9500-000000000001','b7157311-ace0-4a59-9500-000000000001',null,'2026-01-15','watering','Riego',null,null,null,null,false);
do $$ begin
  if (select due_on from public.watering_agenda)<>'2026-01-22' then raise exception 'FAIL: no sincroniza riego'; end if;
end; $$;
select public.save_journal_entry('c7157311-ace0-4a59-9500-000000000001','b7157311-ace0-4a59-9500-000000000001',null,'2026-01-15','watering','Reintento',null,null,null,null,false);
select public.save_journal_entry('c7157311-ace0-4a59-9500-000000000001','b7157311-ace0-4a59-9500-000000000001',1,'2026-01-17','watering','Cambio fecha',null,null,null,null,false);
do $$ begin
  if (select due_on from public.watering_agenda)<>'2026-01-24' then raise exception 'FAIL: no sincroniza edición'; end if;
end; $$;
select public.save_journal_entry('c7157311-ace0-4a59-9500-000000000001','b7157311-ace0-4a59-9500-000000000001',2,'2026-01-17','note','Ya no es riego',null,null,null,null,false);
do $$ begin
  if (select due_on from public.watering_agenda)<>'2026-01-08' then raise exception 'FAIL: cambio tipo'; end if;
end; $$;
select public.save_journal_entry('c7157311-ace0-4a59-9500-000000000001','b7157311-ace0-4a59-9500-000000000001',3,'2026-01-17','watering','Es riego',null,null,null,null,false);
delete from public.journal_entries where id='c7157311-ace0-4a59-9500-000000000001';
do $$ declare a public.watering_agenda; begin
  select * into a from public.watering_agenda;
  if a.due_on<>'2026-01-08' then raise exception 'FAIL: borrar último riego'; end if;
  perform public.save_watering_schedule(a.user_plant_id,a.version,10,'adaptive','2026-01-01',true);
  begin
    update public.care_schedules set last_watered_on=current_date;
    raise exception 'FAIL: permite falsificar última fecha fuera del diario';
  exception when insufficient_privilege then null; end;
end; $$;
set local role service_role;
do $$ declare token uuid; owner_id uuid:='a7157311-ace0-4a59-9500-000000000001'; begin
  token:=public.claim_weather_fetch(owner_id);
  if token is null or public.claim_weather_fetch(owner_id) is not null then raise exception 'FAIL: consultas duplicadas'; end if;
  begin
    perform public.finish_weather_fetch(owner_id,token,-34.60,-58.38,30,40,0,now()-interval '4 hours');
    raise exception 'FAIL: clima viejo';
  exception when check_violation then null; end;
  begin
    perform public.finish_weather_fetch(owner_id,token,10,20,30,40,0,now());
    raise exception 'FAIL: ubicación modificada';
  exception when serialization_failure then null; end;
  perform public.finish_weather_fetch(owner_id,token,-34.60,-58.38,35,30,0,now());
end; $$;
set local role authenticated;
do $$ begin
  if not (select (recommendation->>'weatherUsed')::boolean from public.watering_agenda) then raise exception 'FAIL: clima fresco ignorado'; end if;
end; $$;
set local role service_role;
update public.weather_snapshots set expires_at=now()-interval '1 minute',fetched_at=now()-interval '2 hours';
set local role authenticated;
do $$ begin
  if (select (recommendation->>'weatherUsed')::boolean from public.watering_agenda) then raise exception 'FAIL: clima vencido aplicado'; end if;
end; $$;
update public.user_plants set archived_at=now() where id='b7157311-ace0-4a59-9500-000000000001';
do $$ begin
  if exists(select 1 from public.watering_agenda) then raise exception 'FAIL: agenda de archivada visible'; end if;
  begin
    perform public.save_watering_schedule('b7157311-ace0-4a59-9500-000000000001',1,7,'manual','2026-01-01',true);
    raise exception 'FAIL: agenda de archivada editable';
  exception when insufficient_privilege then null; end;
end; $$;
update public.user_plants set archived_at=null where id='b7157311-ace0-4a59-9500-000000000001';
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9500-000000000002',true);
do $$ begin
  if exists(select 1 from public.watering_agenda) or exists(select 1 from public.weather_snapshots) then raise exception 'FAIL: aislamiento'; end if;
  begin
    perform public.save_watering_schedule('b7157311-ace0-4a59-9500-000000000001',1,7,'manual','2026-01-01',true);
    raise exception 'FAIL: agenda ajena editable';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_weather_fetch(auth.uid());
    raise exception 'FAIL: RPC clima pública';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
