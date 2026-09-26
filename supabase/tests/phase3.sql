-- Supabase SQL Editor, rol postgres. Todos los datos de prueba se revierten.
begin;
insert into auth.users(id,raw_user_meta_data) values
('a7157311-ace0-4a59-9300-000000000001','{"display_name":"Prueba A"}'),
('a7157311-ace0-4a59-9300-000000000002','{"display_name":"Prueba B"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9300-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a7157311-ace0-4a59-9300-000000000001","role":"authenticated"}',true);
insert into public.user_plants(id,user_id,nickname,species_label) values
('b7157311-ace0-4a59-9300-000000000001','a7157311-ace0-4a59-9300-000000000001','Helecho de prueba','Especie sin confirmar');
update public.user_plants set location_label='Cocina' where id='b7157311-ace0-4a59-9300-000000000001';
do $$
declare photo text; entry_id uuid := 'c7157311-ace0-4a59-9300-000000000001'; test_plant_id uuid := 'b7157311-ace0-4a59-9300-000000000001';
begin
  if (select version from public.user_plants where id=test_plant_id) <> 2 then raise exception 'FAIL: versión de planta'; end if;
  photo := public.reserve_journal_photo(test_plant_id);
  if split_part(photo,'/',1) <> auth.uid()::text then raise exception 'FAIL: ruta de foto'; end if;
  perform public.save_journal_entry(entry_id,test_plant_id,null,'2026-01-15','watering','Primer riego',200,15,photo,100,false);
  if (select count(*) from public.media_assets where journal_entry_id=entry_id) <> 1 then raise exception 'FAIL: foto sin registrar'; end if;
  if exists(select 1 from public.storage_cleanup where object_path=photo) then raise exception 'FAIL: reserva sin consumir'; end if;
  perform public.save_journal_entry(entry_id,test_plant_id,null,'2026-01-15','watering','Primer riego',200,15,null,null,false);
  if (select version from public.journal_entries where id=entry_id) <> 1 then raise exception 'FAIL: reintento no idempotente'; end if;
  perform public.save_journal_entry(entry_id,test_plant_id,1,'2026-01-16','note','Hoja nueva',null,16,null,null,false);
  if not exists(select 1 from public.journal_entries where id=entry_id and version=2 and entry_date='2026-01-16') then raise exception 'FAIL: edición'; end if;
  begin
    perform public.save_journal_entry(entry_id,test_plant_id,1,'2026-01-16','note','Edición vieja',null,null,null,null,false);
    raise exception 'FAIL: actualización perdida';
  exception when serialization_failure then null; end;
  begin
    perform public.save_journal_entry(gen_random_uuid(),test_plant_id,null,current_date+2,'note','Futuro',null,null,null,null,false);
    raise exception 'FAIL: fecha futura';
  exception when check_violation then null; end;
  perform public.save_journal_entry(entry_id,test_plant_id,2,'2026-01-16','note','Sin foto',null,16,null,null,true);
  if exists(select 1 from public.media_assets where journal_entry_id=entry_id) then raise exception 'FAIL: foto no retirada'; end if;
  if not exists(select 1 from public.storage_cleanup where object_path=photo and status='deleted') then raise exception 'FAIL: limpieza no encolada'; end if;
  if (select count(*) from public.claim_storage_cleanup()) <> 1 then raise exception 'FAIL: claim de limpieza'; end if;
  if (select count(*) from public.claim_storage_cleanup()) <> 0 then raise exception 'FAIL: claim duplicado'; end if;
  delete from public.storage_cleanup where object_path=photo;
  photo := public.reserve_journal_photo(test_plant_id);
  begin
    perform public.save_journal_entry(entry_id,test_plant_id,3,'2026-01-16','INVALID','Debe revertir',null,16,photo,100,false);
    raise exception 'FAIL: tipo inválido';
  exception when check_violation then null; end;
  if (select version from public.journal_entries where id=entry_id) <> 3 then raise exception 'FAIL: transacción parcial'; end if;
  if not exists(select 1 from public.storage_cleanup where object_path=photo and status='reserved') then raise exception 'FAIL: reserva perdida tras error'; end if;
  perform public.save_journal_entry(entry_id,test_plant_id,3,'2026-01-16','note','Foto nueva',null,16,photo,100,false);
  update public.user_plants set archived_at=now() where id=test_plant_id;
  begin
    perform public.reserve_journal_photo(test_plant_id);
    raise exception 'FAIL: foto en archivada';
  exception when insufficient_privilege then null; end;
  update public.user_plants set archived_at=null where id=test_plant_id;
end;
$$;

select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9300-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a7157311-ace0-4a59-9300-000000000002","role":"authenticated"}',true);
do $$
declare n integer;
begin
  if exists(select 1 from public.user_plants where id='b7157311-ace0-4a59-9300-000000000001') then raise exception 'FAIL: planta ajena visible'; end if;
  if exists(select 1 from public.journal_entries where id='c7157311-ace0-4a59-9300-000000000001') then raise exception 'FAIL: diario ajeno visible'; end if;
  if exists(select 1 from public.media_assets where user_plant_id='b7157311-ace0-4a59-9300-000000000001') then raise exception 'FAIL: fotos ajenas visibles'; end if;
  delete from public.user_plants where id='b7157311-ace0-4a59-9300-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: borrado ajeno'; end if;
  begin
    perform public.save_journal_entry(gen_random_uuid(),'b7157311-ace0-4a59-9300-000000000001',null,'2026-01-15','note','Intrusión',null,null,null,null,false);
    raise exception 'FAIL: RPC sin autorización';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9300-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a7157311-ace0-4a59-9300-000000000001","role":"authenticated"}',true);
delete from public.user_plants where id='b7157311-ace0-4a59-9300-000000000001';
do $$
begin
  if exists(select 1 from public.journal_entries where id='c7157311-ace0-4a59-9300-000000000001') then raise exception 'FAIL: cascada diario'; end if;
  if exists(select 1 from public.media_assets where user_plant_id='b7157311-ace0-4a59-9300-000000000001') then raise exception 'FAIL: cascada fotos'; end if;
  if (select count(*) from public.claim_storage_cleanup()) <> 1 then raise exception 'FAIL: foto eliminada sin limpieza'; end if;
end;
$$;
rollback;
select 'PASS: catálogo, diario atómico, concurrencia, RLS y cola de limpieza' as result;

