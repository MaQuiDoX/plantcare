-- PlantCare: ejecutar una vez en un proyecto Supabase nuevo.
begin;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  latitude numeric(8,5) check (latitude between -90 and 90),
  longitude numeric(8,5) check (longitude between -180 and 180),
  email_reminders boolean not null default false,
  push_reminders boolean not null default false,
  reminder_time time not null default '09:00',
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create function public.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid IANA timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_user_timezone before insert or update on public.users
for each row execute function public.validate_timezone();

create function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id) values (new.id);
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;
create trigger create_user_profile after insert on auth.users
for each row execute function public.create_user_profile();
insert into public.users(id) select id from auth.users on conflict (id) do nothing;

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  scientific_name text not null unique check (length(trim(scientific_name)) between 1 and 200),
  common_names text[] not null default '{}',
  family text,
  light text check (light in ('low','indirect','direct')),
  min_temperature_c numeric(4,1),
  max_temperature_c numeric(4,1),
  base_watering_days smallint check (base_watering_days between 1 and 365),
  care_notes text,
  substrate_recipe jsonb check (jsonb_typeof(substrate_recipe) = 'object'),
  source_url text not null check (source_url ~ '^https://'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (min_temperature_c <= max_temperature_c)
);

create table public.user_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete restrict,
  nickname text not null check (length(trim(nickname)) between 1 and 100),
  acquired_on date,
  placement text not null default 'indoor' check (placement in ('indoor','outdoor','sheltered')),
  location_label text check (length(location_label) <= 200),
  light text check (light in ('low','indirect','direct')),
  pot_diameter_cm numeric(6,2) check (pot_diameter_cm > 0),
  pot_height_cm numeric(6,2) check (pot_height_cm > 0),
  pot_material text check (pot_material in ('plastic','terracotta','ceramic','other')),
  has_drainage boolean,
  substrate_notes text,
  care_overrides jsonb not null default '{}' check (jsonb_typeof(care_overrides) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index user_plants_owner on public.user_plants(user_id, archived_at);
create index user_plants_species on public.user_plants(plant_id);

create table public.care_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_plant_id uuid not null,
  kind text not null check (kind in ('watering','fertilizing','repotting','inspection')),
  mode text not null default 'manual' check (mode in ('manual','adaptive')),
  base_interval_days smallint not null check (base_interval_days between 1 and 730),
  effective_interval_days smallint not null check (effective_interval_days between 1 and 730),
  next_due_at timestamptz not null,
  last_completed_at timestamptz,
  enabled boolean not null default true,
  algorithm_version text,
  calculation_context jsonb not null default '{}' check (jsonb_typeof(calculation_context) = 'object'),
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_plant_id, kind),
  foreign key (user_plant_id, user_id) references public.user_plants(id, user_id) on delete cascade
);
create index care_schedules_due on public.care_schedules(next_due_at) where enabled;
create index care_schedules_owner on public.care_schedules(user_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_plant_id uuid not null,
  kind text not null check (kind in ('note','watering','fertilizing','repotting','inspection','pruning')),
  occurred_at timestamptz not null default now(),
  notes text not null default '' check (length(notes) <= 10000),
  water_ml integer check (water_ml > 0),
  height_cm numeric(7,2) check (height_cm > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id, user_plant_id),
  foreign key (user_plant_id, user_id) references public.user_plants(id, user_id) on delete cascade,
  check (water_ml is null or kind = 'watering')
);
create index journal_timeline on public.journal_entries(user_plant_id, occurred_at desc);
create index journal_owner on public.journal_entries(user_id);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_plant_id uuid,
  journal_entry_id uuid,
  bucket_id text not null default 'plant-images' check (bucket_id = 'plant-images'),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (user_plant_id, user_id) references public.user_plants(id, user_id) on delete cascade,
  foreign key (journal_entry_id, user_id, user_plant_id)
    references public.journal_entries(id, user_id, user_plant_id) on delete cascade,
  check (journal_entry_id is null or user_plant_id is not null),
  check (split_part(object_path, '/', 1) = user_id::text)
);
create index media_owner on public.media_assets(user_id);
create index media_plant on public.media_assets(user_plant_id);
create index media_journal on public.media_assets(journal_entry_id);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  media_asset_id uuid not null,
  kind text not null check (kind in ('identification','diagnosis')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  provider text not null,
  model text not null,
  schema_version text not null,
  result jsonb check (jsonb_typeof(result) = 'object'),
  confidence numeric(5,4) check (confidence between 0 and 1),
  error_code text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, idempotency_key),
  foreign key (media_asset_id, user_id) references public.media_assets(id, user_id) on delete cascade,
  check (status <> 'succeeded' or (result is not null and finished_at is not null)),
  check (status <> 'failed' or (error_code is not null and finished_at is not null))
);
create index ai_media on public.ai_analyses(media_asset_id);

create table public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  latitude numeric(8,5) not null check (latitude between -90 and 90),
  longitude numeric(8,5) not null check (longitude between -180 and 180),
  temperature_c numeric(5,2) not null,
  humidity_percent smallint not null check (humidity_percent between 0 and 100),
  rain_mm numeric(8,2) not null default 0 check (rain_mm >= 0),
  provider text not null,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > fetched_at)
);
create index weather_owner_time on public.weather_snapshots(user_id, observed_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_plant_id uuid,
  kind text not null check (kind in ('care_due','season_change','weather_extreme')),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 4000),
  deduplication_key text not null,
  scheduled_for timestamptz not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, deduplication_key),
  unique (id, user_id),
  foreign key (user_plant_id, user_id) references public.user_plants(id, user_id) on delete cascade
);
create index alerts_plant on public.alerts(user_plant_id);
create index alerts_inbox on public.alerts(user_id, scheduled_for desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null check (length(p256dh) > 0),
  auth_secret text not null check (length(auth_secret) > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index push_owner on public.push_subscriptions(user_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  alert_id uuid not null,
  subscription_id uuid,
  channel text not null check (channel in ('push','email')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  foreign key (alert_id, user_id) references public.alerts(id, user_id) on delete cascade,
  foreign key (subscription_id, user_id) references public.push_subscriptions(id, user_id) on delete cascade,
  check ((channel = 'push') = (subscription_id is not null)),
  check (status <> 'sent' or sent_at is not null)
);
create unique index delivery_email_once on public.notification_deliveries(alert_id) where channel = 'email';
create unique index delivery_push_once on public.notification_deliveries(alert_id, subscription_id) where channel = 'push';
create index delivery_queue on public.notification_deliveries(next_attempt_at) where status in ('pending','processing');
create index delivery_owner on public.notification_deliveries(user_id);
create index delivery_subscription on public.notification_deliveries(subscription_id);

-- Denegar por defecto; conceder únicamente las operaciones previstas.
do $$
declare t text;
begin
  foreach t in array array['users','plants','user_plants','care_schedules','journal_entries',
    'media_assets','ai_analyses','weather_snapshots','alerts','push_subscriptions','notification_deliveries']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array['user_plants','care_schedules','journal_entries','media_assets','push_subscriptions']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
  foreach t in array array['ai_analyses','weather_snapshots','alerts','notification_deliveries']
  loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
grant select on public.plants to authenticated;
create policy species_read on public.plants for select to authenticated using (true);
grant select on public.users to authenticated;
grant update (display_name, timezone, latitude, longitude, email_reminders, push_reminders, reminder_time)
on public.users to authenticated;
create policy profile_read on public.users for select to authenticated using ((select auth.uid()) = id);
create policy profile_update on public.users for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant update (read_at) on public.alerts to authenticated;
create policy alert_read_receipt on public.alerts for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Storage privado: los archivos viven bajo <user_id>/<uuid>.<extension>.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('plant-images', 'plant-images', false, 10485760, array['image/jpeg','image/png','image/webp']);
create policy plant_images_read on storage.objects for select to authenticated
using (bucket_id = 'plant-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy plant_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'plant-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy plant_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'plant-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
