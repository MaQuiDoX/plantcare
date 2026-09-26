begin;

alter table public.care_schedules add column version integer not null default 1 check (version>0);
alter table public.care_schedules add column anchor_on date;
alter table public.care_schedules add column last_watered_on date;
update public.care_schedules c set anchor_on=(c.created_at at time zone u.timezone)::date
from public.users u where u.id=c.user_id;
alter table public.care_schedules alter column anchor_on set not null;
alter table public.care_schedules alter column anchor_on set default current_date;
create trigger bump_care_version before update on public.care_schedules
for each row execute function public.bump_plant_version();

-- Heurística versionada. Devuelve una fecha de revisión, nunca una orden de riego.
create function public.watering_recommendation(p_base integer,p_mode text,p_placement text,p_lat numeric,p_day date,p_temp numeric,p_humidity integer,p_rain numeric)
returns jsonb language plpgsql immutable set search_path='' as $$
declare season text := 'Sin estación'; month integer := extract(month from p_day);
  seasonal numeric := 1; climate numeric := 1; exposure numeric := 1; factor numeric; days integer;
begin
  if p_base is null or p_base not between 1 and 730 or p_mode is null or p_mode not in ('manual','adaptive')
    or p_placement is null or p_placement not in ('indoor','outdoor','sheltered') or p_day is null then
    raise exception 'Invalid calculation' using errcode='23514'; end if;
  if p_lat is not null and abs(p_lat)>=10 then
    if p_lat<0 then month := ((month+5)%12)+1; end if;
    if month in (12,1,2) then season:='Invierno'; seasonal:=1.25;
    elsif month in (3,4,5) then season:='Primavera';
    elsif month in (6,7,8) then season:='Verano'; seasonal:=0.85;
    else season:='Otoño'; seasonal:=1.1; end if;
  elsif p_lat is not null then season:='Zona ecuatorial'; end if;
  if p_placement='indoor' then exposure:=0.3;
  elsif p_placement='sheltered' then exposure:=0.6; end if;
  seasonal := 1+(seasonal-1)*exposure;
  if p_placement<>'indoor' and p_temp is not null then
    if p_temp>=30 then climate:=0.8;
    elsif p_temp>=25 then climate:=0.9;
    elsif p_temp<=12 then climate:=1.2; end if;
    if p_humidity>=80 then climate:=climate*1.1;
    elsif p_humidity<=35 then climate:=climate*0.9; end if;
    -- Solo la lluvia observada en la última hora y en exterior sin cubierta.
    if p_placement='outdoor' and coalesce(p_rain,0)>=2 then climate:=climate*1.1; end if;
    climate := 1+(climate-1)*exposure;
  end if;
  factor := case when p_mode='manual' then 1 else greatest(0.5,least(1.8,seasonal*climate)) end;
  days := greatest(1,least(730,round(p_base*factor)::integer));
  return jsonb_build_object('days',days,'season',season,'seasonFactor',case when p_mode='manual' then 1 else seasonal end,
    'weatherFactor',case when p_mode='manual' then 1 else climate end,'weatherUsed',p_mode='adaptive' and p_placement<>'indoor' and p_temp is not null,'version','watering-v1');
end;
$$;
revoke all on function public.watering_recommendation(integer,text,text,numeric,date,numeric,integer,numeric) from public,anon;
grant execute on function public.watering_recommendation(integer,text,text,numeric,date,numeric,integer,numeric) to authenticated,service_role;

create function public.sync_watering_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; owner_id uuid; last_day date; zone text;
begin
  if tg_op='INSERT' and new.kind<>'watering' then return null; end if;
  if tg_op='DELETE' and old.kind<>'watering' then return null; end if;
  if tg_op='UPDATE' and old.kind<>'watering' and new.kind<>'watering' then return null; end if;
  if tg_op='DELETE' then target:=old.user_plant_id; owner_id:=old.user_id;
  else target:=new.user_plant_id; owner_id:=new.user_id; end if;
  perform 1 from public.user_plants where id=target and user_id=owner_id for update;
  select max(entry_date) into last_day from public.journal_entries where user_plant_id=target and user_id=owner_id and kind='watering';
  select timezone into zone from public.users where id=owner_id;
  update public.care_schedules set last_watered_on=last_day,
    last_completed_at=case when last_day is null then null else (last_day+time '12:00') at time zone zone end,
    next_due_at=((coalesce(last_day,anchor_on)+effective_interval_days)+time '12:00') at time zone zone
    where user_plant_id=target and user_id=owner_id and kind='watering';
  return null;
end;
$$;
revoke all on function public.sync_watering_journal() from public,anon,authenticated;
create trigger sync_watering_journal after insert or update or delete on public.journal_entries
for each row execute function public.sync_watering_journal();
update public.care_schedules c set last_watered_on=(select max(j.entry_date) from public.journal_entries j where j.user_plant_id=c.user_plant_id and j.user_id=c.user_id and j.kind='watering') where c.kind='watering';

-- Vista canónica: recalcula al leer y excluye plantas archivadas. La RLS se aplica
-- como el usuario que consulta, nunca como el propietario de la vista.
create view public.watering_agenda with (security_invoker=true) as
select c.*,p.nickname,p.placement,p.archived_at,
  (now() at time zone u.timezone)::date as today,
  r.value as recommendation,
  coalesce(c.last_watered_on,c.anchor_on)+(r.value->>'days')::integer as due_on,
  w.observed_at as weather_observed_at
from public.care_schedules c
join public.user_plants p on p.id=c.user_plant_id and p.user_id=c.user_id
join public.users u on u.id=c.user_id
left join lateral (
  select ws.* from public.weather_snapshots ws where ws.user_id=c.user_id
  and ws.latitude=u.latitude and ws.longitude=u.longitude and ws.expires_at>now()
  and ws.observed_at>now()-interval '3 hours' and ws.observed_at<=now()+interval '5 minutes'
  order by ws.fetched_at desc,ws.id limit 1
) w on true
cross join lateral (select public.watering_recommendation(c.base_interval_days,c.mode,p.placement,u.latitude,
  (now() at time zone u.timezone)::date,w.temperature_c,w.humidity_percent,w.rain_mm) as value) r
where c.kind='watering' and p.archived_at is null;
revoke all on public.watering_agenda from public,anon;
grant select on public.watering_agenda to authenticated,service_role;

create function public.save_watering_schedule(p_plant uuid,p_version integer,p_base integer,p_mode text,p_anchor date,p_enabled boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); existing public.care_schedules; owner_profile public.users;
  plant public.user_plants; last_day date; target uuid; rec jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into plant from public.user_plants where id=p_plant and user_id=owner_id and archived_at is null for update;
  if not found then raise exception 'Plant unavailable' using errcode='42501'; end if;
  select * into strict owner_profile from public.users where id=owner_id;
  if p_base is null or p_base not between 1 and 365 or p_mode is null or p_mode not in ('manual','adaptive') or p_enabled is null or p_anchor is null
    or p_anchor>(now() at time zone owner_profile.timezone)::date then raise exception 'Invalid schedule' using errcode='23514'; end if;
  select * into existing from public.care_schedules where user_plant_id=p_plant and user_id=owner_id and kind='watering' for update;
  if found and (p_version is null or existing.version<>p_version) then raise exception 'Version conflict' using errcode='40001'; end if;
  if existing.id is null and p_version is not null then raise exception 'Schedule unavailable' using errcode='40001'; end if;
  select max(entry_date) into last_day from public.journal_entries where user_plant_id=p_plant and user_id=owner_id and kind='watering';
  target:=coalesce(existing.id,gen_random_uuid());
  insert into public.care_schedules(id,user_id,user_plant_id,kind,mode,base_interval_days,effective_interval_days,anchor_on,last_watered_on,last_completed_at,next_due_at,enabled,algorithm_version)
  values(target,owner_id,p_plant,'watering',p_mode,p_base,p_base,p_anchor,last_day,(last_day+time '12:00') at time zone owner_profile.timezone,
    ((coalesce(last_day,p_anchor)+p_base)+time '12:00') at time zone owner_profile.timezone,p_enabled,'watering-v1')
  on conflict(id) do update set mode=excluded.mode,base_interval_days=excluded.base_interval_days,anchor_on=excluded.anchor_on,
    last_watered_on=excluded.last_watered_on,last_completed_at=excluded.last_completed_at,enabled=excluded.enabled;
  select recommendation into rec from public.watering_agenda where id=target and user_id=owner_id;
  update public.care_schedules set effective_interval_days=(rec->>'days')::integer,calculation_context=rec,calculated_at=now(),
    next_due_at=((coalesce(last_day,p_anchor)+(rec->>'days')::integer)+time '12:00') at time zone owner_profile.timezone where id=target;
  return target;
end;
$$;
revoke insert,update,delete on public.care_schedules from authenticated;
revoke all on function public.save_watering_schedule(uuid,integer,integer,text,date,boolean) from public,anon;
grant execute on function public.save_watering_schedule(uuid,integer,integer,text,date,boolean) to authenticated;

-- Exclusión y enfriamiento compartidos entre procesos para las llamadas del clima.
create table public.weather_fetch_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  token uuid not null, next_attempt_at timestamptz not null
);
alter table public.weather_fetch_state enable row level security;
revoke all on public.weather_fetch_state from public,anon,authenticated;
grant all on public.weather_fetch_state to service_role;
create function public.claim_weather_fetch(p_user uuid) returns uuid language plpgsql set search_path='' as $$
declare claim uuid:=gen_random_uuid(); saved uuid;
begin
  insert into public.weather_fetch_state(user_id,token,next_attempt_at) values(p_user,claim,now()+interval '10 minutes')
  on conflict(user_id) do update set token=excluded.token,next_attempt_at=excluded.next_attempt_at
    where public.weather_fetch_state.next_attempt_at<=now() returning token into saved;
  return saved;
end;
$$;
create function public.finish_weather_fetch(p_user uuid,p_token uuid,p_lat numeric,p_lon numeric,p_temp numeric,p_humidity integer,p_rain numeric,p_observed timestamptz)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.weather_fetch_state where user_id=p_user and token=p_token for update;
  if not found then raise exception 'Invalid lease' using errcode='42501'; end if;
  perform 1 from public.users where id=p_user and latitude=p_lat and longitude=p_lon for update;
  if not found then raise exception 'Location changed' using errcode='40001'; end if;
  if p_temp is null or p_temp not between -90 and 65 or p_humidity is null or p_humidity not between 0 and 100
    or p_rain is null or p_rain not between 0 and 1000 or p_observed is null
    or p_observed<now()-interval '3 hours' or p_observed>now()+interval '5 minutes' then
    raise exception 'Invalid weather' using errcode='23514'; end if;
  insert into public.weather_snapshots(user_id,latitude,longitude,temperature_c,humidity_percent,rain_mm,provider,observed_at,expires_at)
  values(p_user,p_lat,p_lon,p_temp,p_humidity,p_rain,'openweathermap',p_observed,now()+interval '1 hour');
  update public.weather_fetch_state set next_attempt_at=now()+interval '1 hour' where user_id=p_user and token=p_token;
  delete from public.weather_snapshots where user_id=p_user and fetched_at<now()-interval '7 days';
end;
$$;
revoke all on function public.claim_weather_fetch(uuid) from public,anon,authenticated;
revoke all on function public.finish_weather_fetch(uuid,uuid,numeric,numeric,numeric,integer,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_weather_fetch(uuid) to service_role;
grant execute on function public.finish_weather_fetch(uuid,uuid,numeric,numeric,numeric,integer,numeric,timestamptz) to service_role;
commit;
