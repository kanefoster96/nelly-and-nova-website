-- Training day agreed after onboarding, and register-before-first-session
-- reminders (applied 3 Nov 2026).
alter table public.enquiries add column if not exists training_day text check (training_day in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'));
alter table public.enquiries add column if not exists training_cadence text check (training_cadence in ('weekly','alternating'));
alter table public.enquiries add column if not exists first_session_on date;
-- Which reminders (days before: 7, 3, 1) have gone, so each goes once.
alter table public.enquiries add column if not exists register_reminders_sent jsonb not null default '[]'::jsonb;

drop function if exists public.nn_my_meet_greet();
create or replace function public.nn_my_meet_greet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'status', e.status, 'service', e.service, 'dogNames', e.dog_names,
    'meetGreetAt', e.meet_greet_at, 'meetGreetNotes', e.meet_greet_notes,
    'joinToken', case when e.status = 'onboarding' then e.onboarding_token end,
    'trainingDay', e.training_day, 'trainingCadence', e.training_cadence, 'firstSessionOn', e.first_session_on,
    'createdAt', e.created_at)
  from public.enquiries e
  where e.account_id = auth.uid() and e.kind = 'booking' and e.status <> 'closed'
  order by e.created_at desc limit 1;
$$;
revoke execute on function public.nn_my_meet_greet() from public, anon;
grant execute on function public.nn_my_meet_greet() to authenticated;
