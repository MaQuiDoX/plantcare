begin;

alter table public.user_plants add column species_label text check (length(species_label) <= 200);
alter table public.user_plants add column version integer not null default 1 check (version > 0);
alter table public.journal_entries add column version integer not null default 1 check (version > 0);
alter table public.journal_entries add column entry_date date;
update public.journal_entries j set entry_date = (j.occurred_at at time zone u.timezone)::date
from public.users u where j.user_id = u.id;
alter table public.journal_entries alter column entry_date set not null;

create function public.bump_plant_version() returns trigger
language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
create trigger bump_plant_version before update on public.user_plants
for each row execute function public.bump_plant_version();

-- Outbox durable para compensar la falta de transacciones entre SQL y Storage.
-- Sin FK: una eliminación administrativa de cuenta no pierde las tareas pendientes.
create table public.storage_cleanup (
  object_path text primary key,
  user_id uuid not null,
  status text not null default 'reserved' check (status in ('reserved','deleted','purging')),
  available_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (split_part(object_path, '/', 1) = user_id::text)
);
create index storage_cleanup_owner_due on public.storage_cleanup(user_id, available_at);
alter table public.storage_cleanup enable row level security;
revoke all on public.storage_cleanup from public, anon, authenticated;
grant select, delete on public.storage_cleanup to authenticated;
grant all on public.storage_cleanup to service_role;
create policy cleanup_read on public.storage_cleanup for select to authenticated using (user_id = (select auth.uid()));
create policy cleanup_delete on public.storage_cleanup for delete to authenticated using (user_id = (select auth.uid()) and status = 'purging');

create function public.queue_deleted_media() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_cleanup(object_path, user_id, available_at, status)
  values(old.object_path, old.user_id, now(), 'deleted') on conflict (object_path) do update set available_at = now(), status = 'deleted';
  return old;
end;
$$;
revoke all on function public.queue_deleted_media() from public, anon, authenticated;
create trigger queue_deleted_media after delete on public.media_assets
for each row execute function public.queue_deleted_media();

create function public.reserve_journal_photo(p_plant_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); photo_path text;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.user_plants where id = p_plant_id and user_id = owner_id and archived_at is null for update;
  if not found then raise exception 'Plant unavailable' using errcode = '42501'; end if;
  if (select count(*) from public.storage_cleanup where user_id = owner_id and available_at > now()) >= 20 then
    raise exception 'Too many pending uploads' using errcode = '23514';
  end if;
  photo_path := owner_id::text || '/' || gen_random_uuid()::text || '.webp';
  insert into public.storage_cleanup(object_path, user_id, available_at) values(photo_path, owner_id, now() + interval '24 hours');
  return photo_path;
end;
$$;

create function public.save_journal_entry(
  p_id uuid, p_plant_id uuid, p_version integer, p_date date, p_kind text,
  p_notes text, p_water_ml integer, p_height_cm numeric,
  p_photo_path text, p_photo_size integer, p_remove_photo boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); current_version integer; owner_timezone text; event_at timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.user_plants where id = p_plant_id and user_id = owner_id and archived_at is null for update;
  if not found then raise exception 'Plant unavailable' using errcode = '42501'; end if;
  select timezone into strict owner_timezone from public.users where id = owner_id;
  if p_date is null or p_date > (now() at time zone owner_timezone)::date then
    raise exception 'Invalid event date' using errcode = '23514';
  end if;
  event_at := (p_date + time '12:00') at time zone owner_timezone;
  select version into current_version from public.journal_entries
    where id = p_id and user_id = owner_id and user_plant_id = p_plant_id for update;
  if found then
    if p_version is null then return p_id; end if;
    if current_version <> p_version then raise exception 'Version conflict' using errcode = '40001'; end if;
  elsif p_version is not null then raise exception 'Entry unavailable' using errcode = '42501';
  end if;
  if p_photo_path is not null then
    perform 1 from public.storage_cleanup
      where object_path = p_photo_path and user_id = owner_id and status = 'reserved' and available_at > clock_timestamp() for update;
    if not found or p_photo_size is null or p_photo_size not between 1 and 3145728 then
      raise exception 'Invalid upload reservation' using errcode = '23514';
    end if;
  end if;
  if current_version is null then
    insert into public.journal_entries(id,user_id,user_plant_id,entry_date,occurred_at,kind,notes,water_ml,height_cm)
      values(p_id,owner_id,p_plant_id,p_date,event_at,p_kind,p_notes,p_water_ml,p_height_cm);
  else
    update public.journal_entries set entry_date=p_date,occurred_at=event_at,kind=p_kind,notes=p_notes,
      water_ml=p_water_ml,height_cm=p_height_cm,version=version+1 where id=p_id;
  end if;
  if p_remove_photo or p_photo_path is not null then
    delete from public.media_assets where journal_entry_id=p_id and user_id=owner_id;
  end if;
  if p_photo_path is not null then
    insert into public.media_assets(user_id,user_plant_id,journal_entry_id,object_path,mime_type,size_bytes,captured_at)
      values(owner_id,p_plant_id,p_id,p_photo_path,'image/webp',p_photo_size,event_at);
    delete from public.storage_cleanup where object_path=p_photo_path and user_id=owner_id;
  end if;
  return p_id;
end;
$$;
revoke all on function public.reserve_journal_photo(uuid) from public, anon;
grant execute on function public.reserve_journal_photo(uuid) to authenticated;
revoke all on function public.save_journal_entry(uuid,uuid,integer,date,text,text,integer,numeric,text,integer,boolean) from public, anon;
grant execute on function public.save_journal_entry(uuid,uuid,integer,date,text,text,integer,numeric,text,integer,boolean) to authenticated;

create function public.claim_storage_cleanup() returns table(object_path text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query
  with candidates as (
    select q.object_path from public.storage_cleanup q
    where q.user_id = auth.uid() and q.available_at <= clock_timestamp()
    order by q.available_at for update skip locked limit 50
  )
  update public.storage_cleanup q set status = 'purging', available_at = clock_timestamp() + interval '5 minutes'
  from candidates c where q.object_path = c.object_path returning q.object_path;
end;
$$;
revoke all on function public.claim_storage_cleanup() from public, anon;
grant execute on function public.claim_storage_cleanup() to authenticated;
-- Sólo la RPC atómica crea/edita entradas y metadatos; DELETE sigue protegido por RLS.
revoke insert, update on public.journal_entries from authenticated;
revoke insert, update on public.media_assets from authenticated;

commit;
