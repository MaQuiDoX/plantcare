-- Ejecutar como postgres en Supabase de desarrollo, después de la migración.
-- No necesita extensiones de pruebas. Todos los datos se revierten.
begin;
insert into auth.users(id) values
('a7157311-ace0-4a59-9200-000000000001'),
('a7157311-ace0-4a59-9200-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7157311-ace0-4a59-9200-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a7157311-ace0-4a59-9200-000000000001","role":"authenticated"}', true);
insert into public.user_plants(id, user_id, nickname) values
('b7157311-ace0-4a59-9200-000000000001', 'a7157311-ace0-4a59-9200-000000000001', 'Monstera del living');
do $$
begin
  if (select count(*) from public.user_plants) <> 1 then
    raise exception 'FAIL: el propietario no puede leer su ejemplar';
  end if;
  if (select count(*) from public.users) <> 1 then
    raise exception 'FAIL: el perfil no se creó o no está aislado';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a7157311-ace0-4a59-9200-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a7157311-ace0-4a59-9200-000000000002","role":"authenticated"}', true);
do $$
declare affected integer;
begin
  if exists (select 1 from public.user_plants) then
    raise exception 'FAIL: lectura cruzada entre usuarios';
  end if;
  update public.user_plants set nickname = 'Intrusión'
  where id = 'b7157311-ace0-4a59-9200-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: modificación cruzada'; end if;
  begin
    insert into public.user_plants(user_id, nickname)
    values ('a7157311-ace0-4a59-9200-000000000001', 'Intrusión');
    raise exception 'FAIL: suplantación de propietario';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.journal_entries(user_id, user_plant_id, kind)
    values ('a7157311-ace0-4a59-9200-000000000002', 'b7157311-ace0-4a59-9200-000000000001', 'note');
    raise exception 'FAIL: diario vinculado a una planta ajena';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  begin
    update public.users set timezone = 'Invalid/Timezone'
    where id = 'a7157311-ace0-4a59-9200-000000000002';
    raise exception 'FAIL: zona horaria inválida aceptada';
  exception when check_violation then null;
  end;
  begin
    insert into public.plants(scientific_name, source_url)
    values ('Test species', 'https://example.org');
    raise exception 'FAIL: edición de catálogo global permitida';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any(array[
      'users','plants','user_plants','care_schedules','journal_entries','media_assets',
      'ai_analyses','weather_snapshots','alerts','push_subscriptions','notification_deliveries'])
    and not c.relrowsecurity
  ) then raise exception 'FAIL: tabla sin RLS'; end if;
  if not exists (select 1 from storage.buckets where id = 'plant-images' and not public) then
    raise exception 'FAIL: bucket privado ausente';
  end if;
end;
$$;
rollback;
select 'PASS: aislamiento, integridad, permisos y bucket privado' as result;
