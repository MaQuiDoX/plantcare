-- Ejecutar como postgres. La transacción revierte todos los datos de prueba.
begin;
insert into auth.users(id,raw_user_meta_data) values
('a7157311-ace0-4a59-9400-000000000001','{"display_name":"IA A"}'),
('a7157311-ace0-4a59-9400-000000000002','{"display_name":"IA B"}');
insert into public.user_plants(id,user_id,nickname) values
('b7157311-ace0-4a59-9400-000000000001','a7157311-ace0-4a59-9400-000000000001','Planta IA');
set local role service_role;
do $$
declare owner_id uuid := 'a7157311-ace0-4a59-9400-000000000001';
  plant uuid := 'b7157311-ace0-4a59-9400-000000000001';
  analysis uuid := 'c7157311-ace0-4a59-9400-000000000001'; r jsonb;
begin
  begin
    perform public.begin_ai_analysis('a7157311-ace0-4a59-9400-000000000002',gen_random_uuid(),plant,'diagnosis','test','');
    raise exception 'FAIL: planta ajena';
  exception when insufficient_privilege then null; end;
  r := public.begin_ai_analysis(owner_id,analysis,plant,'identification','test','');
  if not (r->>'started')::boolean then raise exception 'FAIL: no iniciado'; end if;
  r := public.begin_ai_analysis(owner_id,analysis,plant,'identification','test','');
  if (r->>'started')::boolean then raise exception 'FAIL: duplicado'; end if;
  if (select count(*) from public.ai_usage where user_id=owner_id)<>1 then raise exception 'FAIL: doble consumo'; end if;
  begin
    perform public.begin_ai_analysis(owner_id,gen_random_uuid(),plant,'diagnosis','test','');
    raise exception 'FAIL: dos análisis activos';
  exception when lock_not_available then null; end;
  perform public.finish_ai_analysis(owner_id,analysis,'{"kind":"identification","candidates":[{"name":"Monstera deliciosa","commonNames":[],"family":"Araceae","score":0.9,"care":null}],"plantnetVersion":"test","careWarning":null}',null,100);
  if not exists(select 1 from public.ai_analyses where id=analysis and status='succeeded' and media_asset_id is not null) then raise exception 'FAIL: resultado sin foto'; end if;
  if exists(select 1 from public.storage_cleanup where object_path=(select input_path from public.ai_analyses where id=analysis)) then raise exception 'FAIL: reserva no consumida'; end if;
  perform public.finish_ai_analysis(owner_id,analysis,null,'timeout',100);
  if (select status from public.ai_analyses where id=analysis)<>'succeeded' then raise exception 'FAIL: finalización duplicada'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9400-000000000002',true);
do $$
begin
  if exists(select 1 from public.ai_analyses) then raise exception 'FAIL: historial ajeno'; end if;
  begin
    perform public.apply_ai_identification('c7157311-ace0-4a59-9400-000000000001',0,1,'');
    raise exception 'FAIL: aceptar resultado ajeno';
  exception when insufficient_privilege then null; end;
  begin
    perform public.begin_ai_analysis(auth.uid(),gen_random_uuid(),null,'identification','test','');
    raise exception 'FAIL: RPC administrativa pública';
  exception when insufficient_privilege then null; end;
  begin
    perform public.finish_ai_analysis(auth.uid(),gen_random_uuid(),'{}',null,100);
    raise exception 'FAIL: resultado falsificado';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9400-000000000001',true);
do $$
declare plant uuid := 'b7157311-ace0-4a59-9400-000000000001'; analysis uuid := 'c7157311-ace0-4a59-9400-000000000001';
begin
  begin
    update public.ai_analyses set result='{}' where id=analysis;
    raise exception 'FAIL: edición directa de resultado';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_ai_identification(analysis,2,1,'');
    raise exception 'FAIL: candidato inexistente';
  exception when check_violation then null; end;
  update public.user_plants set location_label='Living' where id=plant;
  begin
    perform public.apply_ai_identification(analysis,0,1,'');
    raise exception 'FAIL: versión obsoleta';
  exception when serialization_failure then null; end;
  perform public.apply_ai_identification(analysis,0,2,'');
  if not exists(select 1 from public.user_plants where id=plant and species_label='Monstera deliciosa' and location_label='Living' and version=3 and ai_profile is not null) then raise exception 'FAIL: no aplicado'; end if;
  perform public.apply_ai_identification(analysis,0,2,'');
  if (select version from public.user_plants where id=plant)<>3 then raise exception 'FAIL: doble aplicación'; end if;
  update public.user_plants set species_label='Otra especie' where id=plant;
  if (select ai_profile from public.user_plants where id=plant) is not null then raise exception 'FAIL: cuidados obsoletos'; end if;
end;
$$;
set local role service_role;
do $$
declare owner_id uuid := 'a7157311-ace0-4a59-9400-000000000001'; a uuid;
begin
  for i in 1..4 loop
    a:=gen_random_uuid();
    perform public.begin_ai_analysis(owner_id,a,null,'identification','test','');
    perform public.finish_ai_analysis(owner_id,a,null,'timeout',100);
    if not exists(select 1 from public.storage_cleanup where object_path=(select input_path from public.ai_analyses where id=a) and status='deleted') then raise exception 'FAIL: foto fallida sin limpieza'; end if;
  end loop;
  delete from public.user_plants where id='b7157311-ace0-4a59-9400-000000000001';
  if (select count(*) from public.ai_usage where user_id=owner_id)<>5 then raise exception 'FAIL: cupo perdido'; end if;
  begin
    perform public.begin_ai_analysis(owner_id,gen_random_uuid(),null,'identification','test','');
    raise exception 'FAIL: cupo evadido';
  exception when program_limit_exceeded then null; end;
end;
$$;
-- Un análisis sin planta crea exactamente un ejemplar al confirmar.
select public.begin_ai_analysis('a7157311-ace0-4a59-9400-000000000002','c7157311-ace0-4a59-9400-000000000002',null,'identification','test','');
select public.finish_ai_analysis('a7157311-ace0-4a59-9400-000000000002','c7157311-ace0-4a59-9400-000000000002','{"kind":"identification","candidates":[{"name":"Monstera deliciosa","commonNames":[],"family":"Araceae","score":0.9,"care":null}]}',null,100);
set local role authenticated;
select set_config('request.jwt.claim.sub','a7157311-ace0-4a59-9400-000000000002',true);
select public.apply_ai_identification('c7157311-ace0-4a59-9400-000000000002',0,null,'Monstera nueva');
select public.apply_ai_identification('c7157311-ace0-4a59-9400-000000000002',0,null,'Monstera nueva');
do $$ begin
  if (select count(*) from public.user_plants where nickname='Monstera nueva')<>1 then raise exception 'FAIL: alta duplicada'; end if;
  if not exists(select 1 from public.media_assets where user_plant_id=(select id from public.user_plants where nickname='Monstera nueva')) then raise exception 'FAIL: foto sin vincular'; end if;
end; $$;
rollback;
