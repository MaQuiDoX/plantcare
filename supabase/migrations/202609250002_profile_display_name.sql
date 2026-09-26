begin;

-- Sólo se copia un dato de presentación. Los metadatos no conceden permisos.
create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id, display_name)
  values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 100));
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;

update public.users p
set display_name = left(trim(coalesce(a.raw_user_meta_data ->> 'display_name', '')), 100)
from auth.users a where p.id = a.id and p.display_name = '';

commit;
