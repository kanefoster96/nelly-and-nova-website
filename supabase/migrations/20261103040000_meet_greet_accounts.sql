-- ============================================================================
-- Meet & greet requests for people with an account (applied 3 Nov 2026)
-- ============================================================================
-- Someone who asks for a meet & greet can create an account straight away
-- (like Kanvas's trial bookings) to chat with us and follow their request in
-- the app. A new account picks up open requests sent with the same email,
-- and nn_my_meet_greet() shows them where it's up to.
-- ============================================================================

create or replace function public.nn_my_meet_greet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'status', e.status, 'service', e.service, 'dogNames', e.dog_names,
    'meetGreetAt', e.meet_greet_at, 'meetGreetNotes', e.meet_greet_notes,
    'joinToken', case when e.status = 'onboarding' then e.onboarding_token end,
    'createdAt', e.created_at)
  from public.enquiries e
  where e.account_id = auth.uid() and e.kind = 'booking' and e.status <> 'closed'
  order by e.created_at desc limit 1;
$$;
revoke execute on function public.nn_my_meet_greet() from public, anon;
grant execute on function public.nn_my_meet_greet() to authenticated;

create or replace function public.nn_link_enquiries_to_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email <> '' then
    update public.enquiries set account_id = new.id, updated_at = now()
    where account_id is null and lower(email) = lower(new.email) and status <> 'closed';
  end if;
  return new;
end; $$;
drop trigger if exists nn_link_enquiries on public.profiles;
create trigger nn_link_enquiries after insert on public.profiles
  for each row execute function public.nn_link_enquiries_to_account();
