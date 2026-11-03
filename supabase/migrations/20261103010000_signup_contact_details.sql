-- Sign-up saves the phone and address from the meet & greet form onto the
-- profile (applied to the project 3 Nov 2026). Safe to re-run.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := 'member';
  v_dog  jsonb;
  v_i    int := 0;
begin
  if lower(new.email) = any (array['charlotte@nellyandnova.co.uk']) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, owner_name, role, phone, pickup_address)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'owner_name', new.raw_user_meta_data ->> 'name', '')), ''),
    v_role,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'address', '')), '')
  )
  on conflict (id) do nothing;

  if jsonb_typeof(new.raw_user_meta_data -> 'dogs') = 'array' then
    for v_dog in select * from jsonb_array_elements(new.raw_user_meta_data -> 'dogs')
    loop
      if coalesce(btrim(v_dog ->> 'name'), '') <> '' then
        insert into public.dogs (account_id, name, breed, sort_order)
        values (new.id, btrim(v_dog ->> 'name'), nullif(btrim(coalesce(v_dog ->> 'breed', '')), ''), v_i);
        v_i := v_i + 1;
      end if;
    end loop;
  end if;

  return new;
end;
$function$;
