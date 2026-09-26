begin;
alter table public.users add column care_alerts boolean not null default true;
alter table public.users add column seasonal_alerts boolean not null default true;
alter table public.users add column weather_alerts boolean not null default false;
alter table public.users add column season_marker text;
grant update(care_alerts,seasonal_alerts,weather_alerts) on public.users to authenticated;
alter table public.alerts add column context jsonb not null default '{}';
alter table public.alerts add column expires_at timestamptz not null default (now()+interval '1 day');
alter table public.notification_deliveries add column lock_token uuid;
create table public.notification_scan_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  next_scan_at timestamptz not null default now(), last_scanned_at timestamptz
);
alter table public.notification_scan_state enable row level security;
revoke all on public.notification_scan_state from public,anon,authenticated;
grant all on public.notification_scan_state to service_role;

create function public.save_push_subscription(p_endpoint text,p_key text,p_auth text) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); target uuid;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.users where id=owner_id for update;
  if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/'
    or p_key is null or p_key !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'Invalid push subscription' using errcode='23514'; end if;
  select id into target from public.push_subscriptions where endpoint=p_endpoint and user_id=owner_id;
  if target is null and (select count(*) from public.push_subscriptions where user_id=owner_id)>=5 then raise exception 'Device limit' using errcode='54000'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret) values(owner_id,p_endpoint,p_key,p_auth)
  on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret where public.push_subscriptions.user_id=owner_id
  returning id into target;
  if target is null then raise exception 'Subscription unavailable' using errcode='42501'; end if;
  update public.users set push_reminders=true where id=owner_id;
  return target;
end; $$;
revoke insert,update on public.push_subscriptions from authenticated;
revoke all on function public.save_push_subscription(text,text,text) from public,anon;
grant execute on function public.save_push_subscription(text,text,text) to authenticated;

create function public.alert_is_current(a public.alerts) returns boolean language sql stable set search_path='' as $$
select a.read_at is null and a.expires_at>now() and exists(
  select 1 from public.users u where u.id=a.user_id and
  case a.kind
    when 'care_due' then u.care_alerts and exists(select 1 from public.watering_agenda g where g.user_id=a.user_id
      and g.id::text=a.context->>'schedule' and g.enabled and g.due_on<=g.today
      and g.last_watered_on::text is not distinct from a.context->>'watered')
    when 'season_change' then u.seasonal_alerts and u.season_marker=a.context->>'marker'
    when 'weather_extreme' then u.weather_alerts and exists(select 1 from public.weather_snapshots w
      where w.user_id=u.id and w.id::text=a.context->>'weather' and w.latitude=u.latitude and w.longitude=u.longitude
      and w.expires_at>now() and w.observed_at>now()-interval '3 hours'
      and not exists(select 1 from public.weather_snapshots newer where newer.user_id=u.id and newer.latitude=u.latitude and newer.longitude=u.longitude and newer.fetched_at>w.fetched_at))
    else false end
); $$;
revoke all on function public.alert_is_current(public.alerts) from public,anon,authenticated;
grant execute on function public.alert_is_current(public.alerts) to service_role;

create function public.notification_season_marker(p_lat numeric,p_day date) returns text language sql immutable set search_path='' as $$
  select (case when p_lat is null then 'none' when abs(p_lat)<10 then 'equator' when p_lat<0 then 'south' else 'north' end)
    ||':'||extract(year from (p_day-interval '2 months'))::text||':'||
    (public.watering_recommendation(7,'adaptive','outdoor',p_lat,p_day,null,null,null)->>'season');
$$;
revoke all on function public.notification_season_marker(numeric,date) from public,anon,authenticated;
grant execute on function public.notification_season_marker(numeric,date) to service_role;

create function public.generate_user_alerts(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare u public.users; day date; local_time time; g record; w public.weather_snapshots; season text; hemisphere text; marker text; event text; message text;
begin
  select * into u from public.users where id=p_user for update;
  if not found then return; end if;
  day:=(now() at time zone u.timezone)::date; local_time:=(now() at time zone u.timezone)::time;
  if u.care_alerts and local_time>=u.reminder_time then
    for g in select * from public.watering_agenda where user_id=p_user and enabled and due_on<=today loop
      insert into public.alerts(user_id,user_plant_id,kind,title,body,deduplication_key,scheduled_for,expires_at,context)
      values(p_user,g.user_plant_id,'care_due','Revisá la humedad de '||left(g.nickname,100),
        'La agenda sugiere revisar el sustrato. Regá solo si tu planta lo necesita y anotá el riego en el diario.',
        'care:'||g.id::text||':'||day::text,now(),((day+1)+time '00:00') at time zone u.timezone,
        jsonb_build_object('schedule',g.id,'watered',g.last_watered_on)) on conflict(user_id,deduplication_key) do nothing;
    end loop;
  end if;
  hemisphere:=case when u.latitude is null then 'none' when abs(u.latitude)<10 then 'equator' when u.latitude<0 then 'south' else 'north' end;
  season:=public.watering_recommendation(7,'adaptive','outdoor',u.latitude,day,null,null,null)->>'season';
  marker:=public.notification_season_marker(u.latitude,day);
  if u.seasonal_alerts and u.season_marker is not null and split_part(u.season_marker,':',1)=hemisphere
    and u.season_marker<>marker and hemisphere in ('south','north') then
    message:=case season when 'Invierno' then 'Revisá corrientes frías y el contacto con ventanas heladas. La menor luz puede reducir la necesidad de agua.'
      when 'Verano' then 'Observá si hay sol intenso o calor cerca de las ventanas. Revisá la humedad antes de aumentar el riego.'
      when 'Primavera' then 'Observá nuevos brotes y cambios de luz. Ajustá los cuidados según el crecimiento real de cada planta.'
      else 'Revisá los cambios de luz y temperatura. Adaptá el riego a la humedad del sustrato.' end;
    insert into public.alerts(user_id,kind,title,body,deduplication_key,scheduled_for,expires_at,context)
    values(p_user,'season_change','Cuidados de '||lower(season),message,'season:'||marker,now(),now()+interval '3 days',jsonb_build_object('marker',marker)) on conflict(user_id,deduplication_key) do nothing;
  end if;
  update public.users set season_marker=marker where id=p_user;
  if u.weather_alerts then
    select * into w from public.weather_snapshots where user_id=p_user and latitude=u.latitude and longitude=u.longitude
      and expires_at>now() and observed_at>now()-interval '3 hours' and observed_at<=now()+interval '5 minutes' order by fetched_at desc,id limit 1;
    if found then
      for event,message in select * from (values
        ('cold','Se observaron 5 °C o menos en el exterior. Revisá plantas sensibles y corrientes frías; no asumas que la temperatura interior es la misma.'),
        ('heat','Se observaron 35 °C o más en el exterior. Revisá sol directo y humedad del sustrato antes de regar.'),
        ('rain','Se observaron al menos 10 mm de lluvia en una hora. Revisá drenaje y platos de las macetas expuestas.')) as t(event,message)
        where (t.event='cold' and w.temperature_c<=5) or (t.event='heat' and w.temperature_c>=35) or (t.event='rain' and w.rain_mm>=10)
      loop
        insert into public.alerts(user_id,kind,title,body,deduplication_key,scheduled_for,expires_at,context)
        values(p_user,'weather_extreme','Revisión por clima exterior',message,
          'weather:'||event||':'||day::text||':'||u.latitude::text||':'||u.longitude::text,now(),w.expires_at,jsonb_build_object('weather',w.id))
        on conflict(user_id,deduplication_key) do nothing;
      end loop;
    end if;
  end if;
  insert into public.notification_deliveries(user_id,alert_id,subscription_id,channel)
    select p_user,a.id,s.id,'push' from public.alerts a join public.push_subscriptions s on s.user_id=a.user_id
    where a.user_id=p_user and u.push_reminders and public.alert_is_current(a) on conflict do nothing;
  insert into public.notification_deliveries(user_id,alert_id,channel)
    select p_user,a.id,'email' from public.alerts a where a.user_id=p_user and u.email_reminders and public.alert_is_current(a) on conflict do nothing;
  delete from public.alerts where user_id=p_user and created_at<now()-interval '30 days';
end; $$;
revoke all on function public.generate_user_alerts(uuid) from public,anon,authenticated;
grant execute on function public.generate_user_alerts(uuid) to service_role;
create function public.refresh_my_alerts() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform public.generate_user_alerts(auth.uid());
end; $$;
revoke all on function public.refresh_my_alerts() from public,anon;
grant execute on function public.refresh_my_alerts() to authenticated;

create function public.claim_notification_users(p_limit integer) returns setof uuid language plpgsql set search_path='' as $$
begin
  insert into public.notification_scan_state(user_id) select id from public.users where push_reminders or email_reminders or weather_alerts on conflict do nothing;
  return query with candidates as (
    select s.user_id from public.notification_scan_state s join public.users u on u.id=s.user_id
    where s.next_scan_at<=now() and (u.push_reminders or u.email_reminders or u.weather_alerts)
    order by s.next_scan_at,s.user_id for update of s skip locked limit greatest(1,least(p_limit,10))
  ) update public.notification_scan_state s set next_scan_at=now()+interval '15 minutes',last_scanned_at=now()
    from candidates c where s.user_id=c.user_id returning s.user_id;
end; $$;

create function public.claim_notification_deliveries(p_push boolean,p_email boolean,p_limit integer) returns setof public.notification_deliveries language plpgsql set search_path='' as $$
begin
  update public.notification_deliveries d set status='cancelled',lock_token=null,locked_until=null,error_code='obsolete'
  from public.alerts a,public.users u where a.id=d.alert_id and u.id=d.user_id and d.status in ('pending','processing')
    and (not public.alert_is_current(a) or (d.channel='push' and not u.push_reminders) or (d.channel='email' and not u.email_reminders));
  update public.notification_deliveries set status='failed',error_code='attempts_exhausted',lock_token=null,locked_until=null
    where status='processing' and locked_until<=now() and attempts>=5;
  return query with candidates as (
    select id from public.notification_deliveries where attempts<5 and next_attempt_at<=now()
    and (status='pending' or (status='processing' and locked_until<=now()))
    and ((channel='push' and p_push) or (channel='email' and p_email))
    order by next_attempt_at,id for update skip locked limit greatest(1,least(p_limit,20))
  ) update public.notification_deliveries d set status='processing',attempts=d.attempts+1,lock_token=gen_random_uuid(),locked_until=now()+interval '5 minutes'
    from candidates c where d.id=c.id returning d.*;
end; $$;

create function public.get_notification_payload(p_id uuid,p_token uuid) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('id',d.id,'userId',d.user_id,'alertId',a.id,'channel',d.channel,'endpoint',s.endpoint,'key',s.p256dh,'auth',s.auth_secret,'subscriptionId',s.id)
from public.notification_deliveries d join public.alerts a on a.id=d.alert_id join public.users u on u.id=d.user_id
left join public.push_subscriptions s on s.id=d.subscription_id and s.user_id=d.user_id
where d.id=p_id and d.lock_token=p_token and d.status='processing' and d.locked_until>now()
and public.alert_is_current(a) and ((d.channel='push' and u.push_reminders and s.id is not null) or (d.channel='email' and u.email_reminders));
$$;
create function public.finish_notification_delivery(p_id uuid,p_token uuid,p_status text,p_error text) returns void language plpgsql set search_path='' as $$
begin
  if p_status not in ('sent','retry','failed','cancelled') then raise exception 'Invalid status' using errcode='23514'; end if;
  update public.notification_deliveries set status=case when p_status='retry' and attempts<5 then 'pending' when p_status='retry' then 'failed' else p_status end,
    next_attempt_at=now()+make_interval(mins=>least(60,5*attempts*attempts)),locked_until=null,lock_token=null,error_code=p_error,
    sent_at=case when p_status='sent' then now() else null end where id=p_id and lock_token=p_token and status='processing';
end; $$;
revoke all on function public.claim_notification_users(integer) from public,anon,authenticated;
revoke all on function public.claim_notification_deliveries(boolean,boolean,integer) from public,anon,authenticated;
revoke all on function public.get_notification_payload(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_notification_delivery(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_notification_users(integer),public.claim_notification_deliveries(boolean,boolean,integer),public.get_notification_payload(uuid,uuid),public.finish_notification_delivery(uuid,uuid,text,text) to service_role;
commit;
