begin;

alter table public.ai_analyses alter column media_asset_id drop not null;
alter table public.ai_analyses drop constraint ai_analyses_media_asset_id_user_id_fkey;
alter table public.ai_analyses add foreign key(media_asset_id,user_id)
  references public.media_assets(id,user_id) on delete set null (media_asset_id);
alter table public.ai_analyses add column user_plant_id uuid;
alter table public.ai_analyses add foreign key(user_plant_id,user_id)
  references public.user_plants(id,user_id) on delete cascade;
alter table public.ai_analyses add column input_path text
  check (split_part(input_path,'/',1) = user_id::text);
alter table public.ai_analyses add column observations text check (length(observations) <= 2000);
alter table public.ai_analyses add column applied_at timestamptz;
create index ai_owner_time on public.ai_analyses(user_id,created_at desc);
alter table public.user_plants add column ai_profile jsonb check (jsonb_typeof(ai_profile) = 'object');

-- El cupo sobrevive a la eliminación de la planta y de su historial.
create table public.ai_usage (
  id uuid primary key, user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_usage_owner_time on public.ai_usage(user_id,created_at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public,anon,authenticated;
grant all on public.ai_usage to service_role;

create function public.clear_outdated_ai_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.species_label is distinct from old.species_label or new.plant_id is distinct from old.plant_id)
    and new.ai_profile is not distinct from old.ai_profile then new.ai_profile := null; end if;
  return new;
end;
$$;
create trigger clear_outdated_ai_profile before update on public.user_plants
for each row execute function public.clear_outdated_ai_profile();

-- Únicamente el servidor verificado puede reservar gasto o guardar resultados.
create function public.begin_ai_analysis(p_user uuid,p_id uuid,p_plant uuid,p_kind text,p_model text,p_observations text)
returns jsonb language plpgsql set search_path = '' as $$
declare a public.ai_analyses; photo_path text;
begin
  perform 1 from public.users where id=p_user for update;
  if not found then raise exception 'User unavailable' using errcode='42501'; end if;
  select * into a from public.ai_analyses where user_id=p_user and idempotency_key=p_id;
  if found then return jsonb_build_object('id',a.id,'started',false,'path',a.input_path); end if;
  if p_kind is null or p_kind not in ('identification','diagnosis') or (p_kind='diagnosis' and p_plant is null)
    or p_model is null or length(p_model)>100 or length(p_observations)>2000 then
    raise exception 'Invalid request' using errcode='23514';
  end if;
  if p_plant is not null then
    perform 1 from public.user_plants where id=p_plant and user_id=p_user and archived_at is null for update;
    if not found then raise exception 'Plant unavailable' using errcode='42501'; end if;
  end if;
  update public.ai_analyses set status='failed',error_code='interrupted',finished_at=now()
    where user_id=p_user and status in ('running','queued') and created_at < now()-interval '5 minutes';
  if exists(select 1 from public.ai_analyses where user_id=p_user and status in ('running','queued')) then
    raise exception 'Analysis already running' using errcode='55P03';
  end if;
  if (select count(*) from public.ai_usage where user_id=p_user and created_at>now()-interval '24 hours')>=5 then
    raise exception 'Daily quota reached' using errcode='54000';
  end if;
  photo_path := p_user::text || '/' || gen_random_uuid()::text || '.webp';
  insert into public.ai_usage(id,user_id) values(p_id,p_user);
  insert into public.storage_cleanup(object_path,user_id,available_at) values(photo_path,p_user,now()+interval '24 hours');
  insert into public.ai_analyses(id,user_id,user_plant_id,kind,status,provider,model,schema_version,idempotency_key,input_path,observations)
    values(p_id,p_user,p_plant,p_kind,'running',case when p_kind='identification' then 'plantnet+gemini' else 'gemini' end,p_model,'1',p_id,photo_path,p_observations);
  return jsonb_build_object('id',p_id,'started',true,'path',photo_path);
end;
$$;

create function public.finish_ai_analysis(p_user uuid,p_id uuid,p_result jsonb,p_error text,p_size integer)
returns void language plpgsql set search_path = '' as $$
declare a public.ai_analyses; media_id uuid;
begin
  select * into a from public.ai_analyses where id=p_id and user_id=p_user for update;
  if not found then raise exception 'Analysis unavailable' using errcode='42501'; end if;
  if a.status <> 'running' then return; end if;
  if p_error is not null then
    update public.ai_analyses set status='failed',error_code=p_error,finished_at=now() where id=a.id;
    update public.storage_cleanup set available_at=now(),status='deleted' where object_path=a.input_path and user_id=p_user;
    return;
  end if;
  if p_result is null or p_result->>'kind' is distinct from a.kind or p_size is null or p_size not between 1 and 3145728 then
    raise exception 'Invalid result' using errcode='23514';
  end if;
  perform 1 from public.storage_cleanup where object_path=a.input_path and user_id=p_user
    and status='reserved' and available_at>clock_timestamp() for update;
  if not found then raise exception 'Upload expired' using errcode='23514'; end if;
  insert into public.media_assets(user_id,user_plant_id,object_path,mime_type,size_bytes)
    values(p_user,a.user_plant_id,a.input_path,'image/webp',p_size) returning id into media_id;
  update public.ai_analyses set media_asset_id=media_id,result=p_result,status='succeeded',finished_at=now() where id=a.id;
  delete from public.storage_cleanup where object_path=a.input_path and user_id=p_user;
end;
$$;
revoke all on function public.begin_ai_analysis(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_ai_analysis(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.begin_ai_analysis(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.finish_ai_analysis(uuid,uuid,jsonb,text,integer) to service_role;

create function public.apply_ai_identification(p_id uuid,p_choice integer,p_version integer,p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.ai_analyses; chosen jsonb; target uuid; current_version integer; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.ai_analyses where id=p_id and user_id=owner_id for update;
  if not found or a.status <> 'succeeded' or a.kind <> 'identification' then
    raise exception 'Analysis unavailable' using errcode='42501'; end if;
  if a.applied_at is not null then return a.user_plant_id; end if;
  if p_choice is null or p_choice<0 or p_choice>2 then raise exception 'Invalid choice' using errcode='23514'; end if;
  chosen := a.result->'candidates'->p_choice;
  if chosen is null or length(chosen->>'name') not between 1 and 200 then raise exception 'Invalid choice' using errcode='23514'; end if;
  target := a.user_plant_id;
  if target is null then
    if p_nickname is null or length(trim(p_nickname)) not between 1 and 100 then raise exception 'Invalid name' using errcode='23514'; end if;
    insert into public.user_plants(user_id,nickname,species_label,ai_profile)
      values(owner_id,trim(p_nickname),chosen->>'name',jsonb_build_object('analysisId',a.id,'candidate',chosen)) returning id into target;
    update public.media_assets set user_plant_id=target where id=a.media_asset_id and user_id=owner_id;
  else
    select version into current_version from public.user_plants where id=target and user_id=owner_id and archived_at is null for update;
    if not found then raise exception 'Plant unavailable' using errcode='42501'; end if;
    if p_version is null or current_version<>p_version then raise exception 'Version conflict' using errcode='40001'; end if;
    update public.user_plants set plant_id=null,species_label=chosen->>'name',ai_profile=jsonb_build_object('analysisId',a.id,'candidate',chosen) where id=target and user_id=owner_id;
  end if;
  update public.ai_analyses set user_plant_id=target,applied_at=now() where id=a.id and user_id=owner_id;
  return target;
end;
$$;
revoke all on function public.apply_ai_identification(uuid,integer,integer,text) from public,anon;
grant execute on function public.apply_ai_identification(uuid,integer,integer,text) to authenticated;
commit;
