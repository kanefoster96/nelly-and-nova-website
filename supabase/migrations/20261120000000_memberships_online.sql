-- ============================================================================
-- Nelly & Nova — memberships for all three services, the Online Training
-- week, fixed 1-1 slots, and Monday to Thursday with 5 dogs a day
-- ============================================================================
-- Builds on 20261103070000_schedule.sql, 20261104050000_dog_profile.sql,
-- 20261104080000_owner_onboarding.sql, 20261104100000_trainer_flow.sql,
-- 20261104110000_owner_flow.sql and 20261104120000_chat_cards.sql (run
-- those first). Additive and safe to run again.
--
-- Training days
--   Full Day Training and 1-1s run Monday to Thursday: nn_training_day().
--   5 dogs a day (nn_day_capacity): green up to 3, orange at 4, full at 5;
--   a Friday shows as full. Existing Friday places and bookings stay
--   readable; nothing new can land on a Friday or a weekend (the guards on
--   placements, bookings and session_requests).
--
-- Memberships = placements, with a service
--   placements.service: 'full_day' (a regular weekday, as before),
--   'one_to_one' (a weekday and a slot, start_time, duration_min) or
--   'online' (no day and no time). placements.goals: the online member's
--   goals, a simple list the trainer edits.
--   Only Full Day places count toward the 5 dogs a day (nn_day_counts) and
--   appear on the calendar as Full Days. A 1-1 membership's sessions are
--   real 1-1 bookings (bookings.placement_id, bookings.membership_on), made
--   for any dates someone looks at (nn_trainer_calendar, nn_dog_sessions,
--   the evening reminders) by nn_membership_fill, so the register, charging
--   (£90, preset), cancelling and moving work as for any 1-1. Online
--   memberships never appear on the calendar.
--   nn_has_membership(account, kind): the member price. A Full Day at £60
--   needs a Full Day membership; a 1-1 at £90 needs any membership. Both
--   need a current membership and a Direct Debit, as before. The one-argument
--   version stays for older apps (Full Day).
--
-- Starting and ending
--   nn_membership_start_one_to_one: "Start 1-1 membership" after a 1-1.
--     Today's session becomes £90 if unpaid; if it was already paid (or on
--     its way) at more, the difference goes on refunds_owed, a to-do for
--     the trainer ("Refund £30 to Sarah in GoCardless") ticked off by hand.
--     No refunds API is called.
--   nn_membership_start_online: put a dog on Online Training, with goals.
--   (A Full Day membership is a regular place, added as before.)
--   nn_membership_end: the last date; a 1-1 membership's later sessions
--   that haven't been charged go.
--   nn_my_memberships: the signed-in owner's memberships, for the Profile
--   tab and which tabs they see.
--
-- 1-1 slots
--   Two a day, Monday to Thursday: 12:00–13:00 and 13:00–14:00. A slot is
--   taken by a 1-1 booking, or a 1-1 membership's session that day.
--   nn_one_to_one_slots(from, to): free slots (date and time, no names), to
--   anyone, signed in or not. nn_one_to_one_book: an owner books a free slot
--   in the app, confirmed straight away (£120, or £90 for members), unpaid
--   until a trainer charges it; the trainers are told.
--
-- Online Training week
--   report_cards.kind 'online_week' (week_of, review): the week's homework,
--   sent by a trainer from the Online board (nn_online_send_week). It shows
--   in the owner's Homework tab like any homework (3 days to complete).
--   online_checkins: the optional Sunday check-in (each drill great / OK /
--   struggled, the week overall, a note, an optional video from the
--   homework-videos bucket): nn_online_checkin_submit posts it to the chat
--   as a "checkin" card and tells the trainers. nn_online_board: the
--   trainer's board. nn_online_checkin_reminders_claim: the Sunday evening
--   push, once per account per week (app/api/cron/evening).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Training days: Monday to Thursday, 5 dogs
-- ---------------------------------------------------------------------------
create or replace function public.nn_training_day(p_date date)
returns text language sql immutable set search_path = public as $$
  select case when extract(isodow from p_date) between 1 and 4
    then (array['monday','tuesday','wednesday','thursday'])[extract(isodow from p_date)::int] end;
$$;

create or replace function public.nn_day_capacity()
returns integer language sql immutable set search_path = public as $$ select 5 $$;

-- The Monday of a date's week.
create or replace function public.nn_monday_of(p_date date)
returns date language sql immutable set search_path = public as $$
  select p_date - (extract(isodow from p_date)::int - 1);
$$;

-- Prices in pence, as config/site.ts sessionPrices (keep them in step).
create or replace function public.nn_session_price(p_kind text, p_member boolean)
returns integer language sql immutable set search_path = public as $$
  select case when p_kind = 'one_to_one' then case when p_member then 9000 else 12000 end
              else case when p_member then 6000 else 8500 end end;
$$;

-- The 1-1 slots, every training day.
create or replace function public.nn_one_to_one_times()
returns time[] language sql immutable set search_path = public as $$ select array['12:00'::time, '13:00'::time] $$;

-- "12:00pm", "1:00pm".
create or replace function public.nn_clock(p_time time)
returns text language sql immutable set search_path = public as $$
  select ltrim(to_char(p_time, 'FMHH12:MI'), '0') || lower(to_char(p_time, 'am'));
$$;

-- "£90", "£30.50".
create or replace function public.nn_pounds(p_pence integer)
returns text language sql immutable set search_path = public as $$
  select '£' || case when p_pence % 100 = 0 then (p_pence / 100)::text else to_char(p_pence / 100.0, 'FM999990.00') end;
$$;

-- ---------------------------------------------------------------------------
-- placements: a service, a 1-1's slot, an online member's goals
-- ---------------------------------------------------------------------------
alter table public.placements add column if not exists service text not null default 'full_day';
alter table public.placements add column if not exists start_time time;
alter table public.placements add column if not exists duration_min integer;
alter table public.placements add column if not exists goals text[] not null default '{}';
alter table public.placements alter column day drop not null;
alter table public.placements drop constraint if exists placements_service_check;
alter table public.placements add constraint placements_service_check check (service in ('full_day','one_to_one','online'));
alter table public.placements drop constraint if exists placements_service_shape_check;
alter table public.placements add constraint placements_service_shape_check check (
  case service
    when 'online' then day is null and start_time is null
    when 'one_to_one' then day is not null and start_time is not null
    else day is not null and start_time is null
  end);
alter table public.placements drop constraint if exists placements_duration_min_check;
alter table public.placements add constraint placements_duration_min_check check (duration_min is null or duration_min between 15 and 480);
alter table public.placements drop constraint if exists placements_goals_check;
alter table public.placements add constraint placements_goals_check check (cardinality(goals) <= 20);
create index if not exists placements_service_idx on public.placements (service, account_id);

-- A 1-1 membership's sessions, as bookings.
alter table public.bookings add column if not exists placement_id uuid references public.placements (id) on delete set null;
alter table public.bookings add column if not exists membership_on date;
create unique index if not exists bookings_membership_date_idx on public.bookings (placement_id, membership_on) where placement_id is not null;

-- Nothing new on a Friday or at the weekend; what's already there stays.
create or replace function public.nn_guard_training_day()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'placements' then
    if new.day is not null and new.day not in ('monday','tuesday','wednesday','thursday')
       and (tg_op = 'INSERT' or new.day is distinct from old.day) then
      raise exception 'We train Monday to Thursday. Please pick another day.';
    end if;
  elsif tg_table_name = 'bookings' then
    if public.nn_training_day(new.on_date) is null and (tg_op = 'INSERT' or new.on_date is distinct from old.on_date) then
      raise exception 'We train Monday to Thursday. Please pick another day.';
    end if;
  elsif tg_table_name = 'session_requests' then
    if tg_op = 'INSERT' and ((new.requested_date is not null and public.nn_training_day(new.requested_date) is null)
                             or (new.requested_day is not null and new.requested_day not in ('monday','tuesday','wednesday','thursday'))) then
      raise exception 'We train Monday to Thursday. Please pick another day.';
    end if;
    if new.offered_dates is distinct from (case when tg_op = 'UPDATE' then old.offered_dates end)
       and exists (select 1 from unnest(coalesce(new.offered_dates, '{}')) d where public.nn_training_day(d) is null) then
      raise exception 'Suggest days from Monday to Thursday.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists nn_guard_training_day on public.placements;
create trigger nn_guard_training_day before insert or update of day on public.placements
  for each row execute function public.nn_guard_training_day();
drop trigger if exists nn_guard_training_day on public.bookings;
create trigger nn_guard_training_day before insert or update of on_date on public.bookings
  for each row execute function public.nn_guard_training_day();
drop trigger if exists nn_guard_training_day on public.session_requests;
create trigger nn_guard_training_day before insert or update of offered_dates on public.session_requests
  for each row execute function public.nn_guard_training_day();

-- ---------------------------------------------------------------------------
-- A 1-1 membership's sessions from p_from to p_to, as 1-1 bookings (at the
-- member price, unpaid). Each date once: a cancelled or moved one isn't
-- made again; skipped dates are left out. Internal.
-- ---------------------------------------------------------------------------
create or replace function public.nn_membership_fill(p_from date, p_to date, p_placement uuid default null, p_dog uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if p_from is null or p_to is null or p_to < p_from then return 0; end if;
  if p_to - p_from > 1300 then p_from := p_to - 1300; end if;
  insert into public.bookings (kind, on_date, start_time, duration_min, account_id, dog_id, enquiry_id, holder_name, notes,
                               created_by, payment_status, amount_pence, placement_id, membership_on)
  select 'one_to_one', g::date, pl.start_time, coalesce(pl.duration_min, 60), pl.account_id, pl.dog_id, pl.enquiry_id, pl.holder_name,
         '1-1 membership', pl.created_by, 'unpaid', public.nn_session_price('one_to_one', true), pl.id, g::date
  from public.placements pl
  cross join lateral generate_series(greatest(p_from, pl.start_on), least(p_to, coalesce(pl.end_on, p_to)), interval '1 day') g
  where pl.service = 'one_to_one'
    and (p_placement is null or pl.id = p_placement)
    and (p_dog is null or pl.dog_id = p_dog)
    and public.nn_training_day(g::date) is not null
    and public.nn_placement_on(pl.id, g::date)
    and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = g::date)
  on conflict (placement_id, membership_on) where placement_id is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
revoke execute on function public.nn_membership_fill(date, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.nn_membership_fill(date, date, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Day counts: only Full Day places and one-off Full Days count.
-- ---------------------------------------------------------------------------
create or replace function public.nn_day_counts(p_from date, p_to date)
returns table (on_date date, dogs integer)
language sql stable security definer set search_path = public as $$
  with days as (
    select d::date as dt, public.nn_weekday_of(d::date) as dname from generate_series(p_from, p_to, interval '1 day') d
  )
  select days.dt,
    ((select count(*) from public.placements pl
      where pl.service = 'full_day' and pl.day = days.dname and days.dt >= pl.start_on and (pl.end_on is null or days.dt <= pl.end_on)
        and (pl.cadence = 'weekly' or ((days.dt - pl.start_on) / 7) % 2 = 0)
        and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = days.dt))
     + (select count(*) from public.bookings b where b.on_date = days.dt and b.kind = 'full_day' and b.cancelled_at is null))::int
  from days where days.dname is not null;
$$;
revoke execute on function public.nn_day_counts(date, date) from public, anon, authenticated;

-- Green up to 3, orange at 4, full at 5. A Friday is shown as full: we don't train then.
create or replace function public.nn_day_availability(p_from date, p_to date)
returns table (on_date date, dogs integer, capacity integer, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Bad range.'; end if;
  return query
  select c.on_date, c.dogs, public.nn_day_capacity(),
    case when public.nn_training_day(c.on_date) is null or c.dogs >= public.nn_day_capacity() then 'full'
         when c.dogs = public.nn_day_capacity() - 1 then 'orange' else 'green' end
  from public.nn_day_counts(p_from, p_to) c order by 1;
end; $$;
revoke execute on function public.nn_day_availability(date, date) from public, anon;
grant execute on function public.nn_day_availability(date, date) to authenticated;

create or replace function public.nn_day_full(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select public.nn_training_day(p_date) is null
      or coalesce((select dogs >= public.nn_day_capacity() from public.nn_day_counts(p_date, p_date)), false);
$$;
revoke execute on function public.nn_day_full(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Member prices
-- ---------------------------------------------------------------------------
-- p_kind 'full_day': a current Full Day membership. 'one_to_one': any
-- current membership (Full Day, 1-1 or Online). And a Direct Debit.
create or replace function public.nn_has_membership(p_account_id uuid, p_kind text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_account_id is distinct from auth.uid() and not public.nn_is_admin() and auth.role() is distinct from 'service_role' then return false; end if;
  return exists (select 1 from public.placements p
                 where p.account_id = p_account_id and (p.end_on is null or p.end_on >= public.nn_today())
                   and (p.service = 'full_day' or coalesce(p_kind, 'full_day') = 'one_to_one'))
     and exists (select 1 from public.payment_mandates m where m.account_id = p_account_id and m.status in ('pending_submission','submitted','active'));
end; $$;
revoke execute on function public.nn_has_membership(uuid, text) from public, anon;
grant execute on function public.nn_has_membership(uuid, text) to authenticated, service_role;

-- Older apps: the Full Day membership, as before.
create or replace function public.nn_has_membership(p_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.nn_has_membership(p_account_id, 'full_day');
$$;
revoke execute on function public.nn_has_membership(uuid) from public, anon;
grant execute on function public.nn_has_membership(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The trainer's calendar: Full Day places as before; a 1-1 membership's
-- sessions come through as its 1-1 bookings (made here for the dates
-- asked for); online memberships aren't on it.
-- ---------------------------------------------------------------------------
create or replace function public.nn_trainer_calendar(p_from date, p_to date)
returns table (
  on_date date,
  kind text,
  start_time time,
  ref_id uuid,
  account_id uuid,
  dog_id uuid,
  dog_name text,
  dog_photo text,
  owner_name text,
  registered boolean,
  holder_name text,
  enquiry_id uuid
)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Bad range.'; end if;
  perform public.nn_membership_fill(p_from, p_to);
  return query
  with days as (
    select d::date as dt, lower(trim(to_char(d, 'FMday'))) as dname
    from generate_series(p_from, p_to, interval '1 day') d
  )
  select days.dt, 'full_day'::text, null::time, pl.id, pl.account_id, pl.dog_id, dg.name, dg.photo_url,
         pr.owner_name, (dg.waiver_signed_at is not null), pl.holder_name, pl.enquiry_id
  from days
  join public.placements pl on pl.service = 'full_day' and pl.day = days.dname
    and days.dt >= pl.start_on and (pl.end_on is null or days.dt <= pl.end_on)
    and (pl.cadence = 'weekly' or ((days.dt - pl.start_on) / 7) % 2 = 0)
    and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = days.dt)
  left join public.dogs dg on dg.id = pl.dog_id
  left join public.profiles pr on pr.id = pl.account_id
  union all
  select b.on_date, case when b.kind = 'full_day' then 'full_day_one_off' else 'one_to_one' end, b.start_time, b.id,
         b.account_id, b.dog_id, dg.name, dg.photo_url, pr.owner_name, (dg.waiver_signed_at is not null), b.holder_name, b.enquiry_id
  from public.bookings b
  left join public.dogs dg on dg.id = b.dog_id
  left join public.profiles pr on pr.id = b.account_id
  where b.cancelled_at is null and b.on_date between p_from and p_to
  union all
  select (e.meet_greet_at at time zone 'Europe/London')::date, 'meet_greet', (e.meet_greet_at at time zone 'Europe/London')::time, e.id,
         e.account_id, e.dog_id, coalesce(dg.name, e.dog_names), dg.photo_url, e.name, false, e.name, e.id
  from public.enquiries e
  left join public.dogs dg on dg.id = e.dog_id
  where e.meet_greet_at is not null and e.status <> 'closed'
    and (e.meet_greet_at at time zone 'Europe/London')::date between p_from and p_to
  order by 1, 2, 3 nulls first, 7;
end; $$;
revoke execute on function public.nn_trainer_calendar(date, date) from public, anon;
grant execute on function public.nn_trainer_calendar(date, date) to authenticated;

-- One dog's sessions: Full Day places, and bookings (a 1-1 membership's included).
create or replace function public.nn_dog_sessions(p_dog_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  kind text,
  start_time time,
  placement_id uuid,
  booking_id uuid,
  cancelled boolean,
  notes text,
  payment_status text
)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not (public.nn_is_admin() or exists (select 1 from public.dogs d where d.id = p_dog_id and d.account_id = auth.uid())) then
    raise exception 'That dog isn''t on your account.';
  end if;
  if p_to < p_from or p_to - p_from > 1200 then raise exception 'Bad range.'; end if;
  perform public.nn_membership_fill(greatest(p_from, public.nn_today() - 120), p_to, null, p_dog_id);
  return query
  select d::date, 'full_day'::text, null::time, pl.id, null::uuid,
         exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = d::date),
         null::text, null::text
  from public.placements pl, generate_series(p_from, p_to, interval '1 day') d
  where pl.dog_id = p_dog_id and pl.service = 'full_day' and public.nn_placement_on(pl.id, d::date)
  union all
  select b.on_date, case when b.kind = 'full_day' then 'full_day_one_off' else 'one_to_one' end, b.start_time, null::uuid, b.id,
         b.cancelled_at is not null, b.notes, b.payment_status
  from public.bookings b
  where b.dog_id = p_dog_id and b.on_date between p_from and p_to
  order by 1, 3 nulls first;
end; $$;
revoke execute on function public.nn_dog_sessions(uuid, date, date) from public, anon;
grant execute on function public.nn_dog_sessions(uuid, date, date) to authenticated;

-- The evening-before reminders: as before, Full Day places only (a 1-1
-- membership's session is a booking, made here first).
create or replace function public.nn_owner_reminders_claim(p_on date)
returns table (
  kind text,
  ref_id uuid,
  account_id uuid,
  dog_id uuid,
  dog_name text,
  start_time time,
  owner_name text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_on is null then return; end if;
  perform public.nn_membership_fill(p_on, p_on);
  return query
  with due as (
    select 'full_day'::text as kind, pl.id as ref_id, d.account_id, d.id as dog_id, d.name as dog_name, null::time as start_time
    from public.placements pl
    join public.dogs d on d.id = pl.dog_id
    where d.account_id is not null and pl.service = 'full_day'
      and public.nn_placement_on(pl.id, p_on)
      and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = p_on)
    union all
    select case when b.kind = 'full_day' then 'full_day' else 'one_to_one' end, b.id, d.account_id, d.id, d.name, b.start_time
    from public.bookings b
    join public.dogs d on d.id = b.dog_id
    where b.on_date = p_on and b.cancelled_at is null and d.account_id is not null
    union all
    select 'meet_greet', e.id, e.account_id, null::uuid, e.dog_names, (e.meet_greet_at at time zone 'Europe/London')::time
    from public.enquiries e
    where e.meet_greet_at is not null and e.status <> 'closed' and e.account_id is not null
      and (e.meet_greet_at at time zone 'Europe/London')::date = p_on
  ),
  claimed as (
    insert into public.owner_reminders_sent as s (on_date, kind, ref_id, account_id, dog_id)
    select distinct on (due.kind, due.ref_id) p_on, due.kind, due.ref_id, due.account_id, due.dog_id from due
    on conflict do nothing
    returning s.kind, s.ref_id
  )
  select distinct on (due.account_id, due.kind, due.ref_id)
         due.kind, due.ref_id, due.account_id, due.dog_id, due.dog_name, due.start_time, nullif(btrim(pr.owner_name), '')
  from due
  join claimed c on c.kind = due.kind and c.ref_id = due.ref_id
  left join public.profiles pr on pr.id = due.account_id
  order by due.account_id, due.kind, due.ref_id;
end;
$$;
revoke execute on function public.nn_owner_reminders_claim(date) from public, anon, authenticated;
grant execute on function public.nn_owner_reminders_claim(date) to service_role;

-- ---------------------------------------------------------------------------
-- 1-1 slots
-- ---------------------------------------------------------------------------
-- Is the slot taken (a 1-1 booking, or a 1-1 membership's session not yet
-- made into one)? p_ignore: a booking to leave out (the one being converted).
create or replace function public.nn_slot_taken(p_date date, p_time time, p_ignore uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings b
                 where b.kind = 'one_to_one' and b.cancelled_at is null and b.on_date = p_date and b.start_time = p_time
                   and b.id is distinct from p_ignore)
      or exists (select 1 from public.placements pl
                 where pl.service = 'one_to_one' and pl.start_time = p_time and public.nn_placement_on(pl.id, p_date)
                   and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = p_date)
                   and not exists (select 1 from public.bookings b where b.placement_id = pl.id and b.membership_on = p_date));
$$;
revoke execute on function public.nn_slot_taken(date, time, uuid) from public, anon, authenticated;

-- Free 1-1 slots: date and time only, to anyone. Days after today, Monday
-- to Thursday, up to 9 weeks at a time (default: the next 6 weeks).
create or replace function public.nn_one_to_one_slots(p_from date default null, p_to date default null)
returns table (on_date date, start_time time)
language plpgsql stable security definer set search_path = public as $$
declare v_from date := greatest(coalesce(p_from, public.nn_today() + 1), public.nn_today() + 1);
        v_to date := coalesce(p_to, public.nn_today() + 42);
begin
  if v_to < v_from then return; end if;
  if v_to - v_from > 63 then v_to := v_from + 63; end if;
  return query
  select g::date, t
  from generate_series(v_from, v_to, interval '1 day') g
  cross join unnest(public.nn_one_to_one_times()) t
  where public.nn_training_day(g::date) is not null and not public.nn_slot_taken(g::date, t)
  order by 1, 2;
end; $$;
revoke execute on function public.nn_one_to_one_slots(date, date) from public;
grant execute on function public.nn_one_to_one_slots(date, date) to anon, authenticated;

-- An owner (or a trainer for them) books a free slot: confirmed at once,
-- £120 or £90 for members, unpaid until a trainer charges it.
create or replace function public.nn_one_to_one_book(p_dog_id uuid, p_date date, p_time time, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_member boolean;
  v_price integer;
  v_id uuid;
  v_owner text;
  v_notices uuid[];
  v_when text;
begin
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or (v_dog.account_id is distinct from auth.uid() and not public.nn_is_admin()) then
    raise exception 'That dog isn''t on your account.';
  end if;
  if p_date is null or p_date <= public.nn_today() or public.nn_training_day(p_date) is null then
    raise exception '1-1s run Monday to Thursday. Pick a day after today.';
  end if;
  if p_time is null or not (p_time = any (public.nn_one_to_one_times())) then raise exception 'Pick 12 to 1pm or 1 to 2pm.'; end if;
  if v_note is not null and length(v_note) > 1000 then raise exception 'Keep the note under 1,000 characters.'; end if;
  -- One booking per slot at a time.
  perform pg_advisory_xact_lock(hashtext('nn-1-1-' || p_date::text || '-' || p_time::text));
  if public.nn_slot_taken(p_date, p_time) then raise exception 'Sorry, that slot has just gone. Please pick another.'; end if;

  v_member := public.nn_has_membership(v_dog.account_id, 'one_to_one');
  v_price := public.nn_session_price('one_to_one', v_member);
  insert into public.bookings (kind, on_date, start_time, duration_min, account_id, dog_id, notes, created_by, payment_status, amount_pence)
  values ('one_to_one', p_date, p_time, 60, v_dog.account_id, v_dog.id, coalesce(v_note, 'Booked in the app'), auth.uid(), 'unpaid', v_price)
  returning id into v_id;

  v_when := public.nn_long_date(p_date) || ' at ' || public.nn_clock(p_time);
  select coalesce(nullif(btrim(owner_name), ''), 'An owner') into v_owner from public.profiles where id = v_dog.account_id;
  v_notices := public.nn_notice_trainers(
    left('📅 New 1-1: ' || v_dog.name, 120),
    v_owner || ' booked a 1-1 for ' || v_dog.name || ' on ' || v_when || ' (' || public.nn_pounds(v_price)
      || case when v_member then ', member price' else '' end || ').' || coalesce(' "' || v_note || '"', ''),
    '/day/' || p_date::text);
  perform public.nn_request_chat(v_dog.account_id,
    'Booked a 1-1 for ' || v_dog.name || ' on ' || v_when || '. ' || public.nn_pounds(v_price)
      || case when v_member then ' (member price)' else '' end || ', taken by Direct Debit.' || coalesce(' Note: ' || v_note, ''));
  return jsonb_build_object('id', v_id, 'amountPence', v_price, 'member', v_member, 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_one_to_one_book(uuid, date, time, text) from public, anon;
grant execute on function public.nn_one_to_one_book(uuid, date, time, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Refunds the trainer owes (to do by hand in GoCardless)
-- ---------------------------------------------------------------------------
create table if not exists public.refunds_owed (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0 and amount_pence <= 100000),
  reason text check (reason is null or length(reason) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null
);
create index if not exists refunds_owed_open_idx on public.refunds_owed (created_at) where done_at is null;
create unique index if not exists refunds_owed_booking_idx on public.refunds_owed (booking_id) where booking_id is not null;
alter table public.refunds_owed enable row level security;
revoke all on public.refunds_owed from anon;
drop policy if exists "refunds_owed: trainers" on public.refunds_owed;
create policy "refunds_owed: trainers" on public.refunds_owed
  for all to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- Chat cards: a membership starting, and a weekly check-in.
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind is null or kind in ('request', 'cancellation', 'homework_day', 'report_card', 'membership', 'checkin'));

-- ---------------------------------------------------------------------------
-- Trainer: "Start 1-1 membership". p_booking_id: the 1-1 it grew from.
-- ---------------------------------------------------------------------------
create or replace function public.nn_membership_start_one_to_one(
  p_dog_id uuid,
  p_day text,
  p_cadence text,
  p_time time,
  p_start_on date,
  p_booking_id uuid default null,
  p_duration_min integer default 60
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  b public.bookings;
  v_first date;
  v_place uuid;
  v_d date;
  v_i int := 0;
  v_paid integer;
  v_refund integer := 0;
  v_owner text;
  v_body text;
  v_schedule text;
  v_notice uuid;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or v_dog.account_id is null then raise exception 'That dog isn''t on an owner''s account.'; end if;
  if p_day is null or p_day not in ('monday','tuesday','wednesday','thursday') then raise exception 'Pick a day from Monday to Thursday.'; end if;
  if coalesce(p_cadence, '') not in ('weekly','alternating') then raise exception 'Every week, or every other week?'; end if;
  if p_time is null or not (p_time = any (public.nn_one_to_one_times())) then raise exception 'Pick 12 to 1pm or 1 to 2pm.'; end if;
  if p_start_on is null or p_start_on < public.nn_today() then raise exception 'Pick a start date from today on.'; end if;
  if exists (select 1 from public.placements where dog_id = v_dog.id and service = 'one_to_one' and (end_on is null or end_on >= public.nn_today())) then
    raise exception '% already has a 1-1 membership.', v_dog.name;
  end if;
  if p_booking_id is not null then
    select * into b from public.bookings where id = p_booking_id for update;
    if b.id is null or b.kind <> 'one_to_one' or b.dog_id is distinct from v_dog.id then raise exception 'That 1-1 isn''t %''s.', v_dog.name; end if;
  end if;

  -- The first session: the start date if it's the day, else the next one.
  v_first := case when public.nn_weekday_of(p_start_on) = p_day then p_start_on else public.nn_next_weekday(p_start_on, p_day) end;
  -- The slot has to be free for the next couple of months.
  v_d := v_first;
  while v_i < 9 loop
    if public.nn_slot_taken(v_d, p_time, p_booking_id) then
      raise exception 'The % slot is taken on %. Pick the other time or another day.', public.nn_clock(p_time), public.nn_short_date(v_d);
    end if;
    v_d := v_d + case when p_cadence = 'alternating' then 14 else 7 end;
    v_i := v_i + 1;
  end loop;

  insert into public.placements (service, day, cadence, start_on, start_time, duration_min, account_id, dog_id, created_by)
  values ('one_to_one', p_day, p_cadence, v_first, p_time, greatest(15, least(480, coalesce(p_duration_min, 60))), v_dog.account_id, v_dog.id, auth.uid())
  returning id into v_place;

  -- Today's session: £90 if it's still to pay; the difference owed back if it's paid.
  if b.id is not null then
    if public.nn_placement_on(v_place, b.on_date) then
      update public.bookings set placement_id = v_place, membership_on = b.on_date where id = b.id;
    end if;
    if b.payment_status is null or b.payment_status in ('unpaid','failed') then
      update public.bookings set amount_pence = public.nn_session_price('one_to_one', true),
                                 payment_status = coalesce(payment_status, 'unpaid') where id = b.id;
    elsif b.payment_status in ('paid','pending') then
      v_paid := coalesce(b.amount_pence, public.nn_session_price('one_to_one', false));
      v_refund := v_paid - public.nn_session_price('one_to_one', true);
      if v_refund > 0 then
        insert into public.refunds_owed (account_id, booking_id, amount_pence, reason)
        values (v_dog.account_id, b.id, v_refund, '1-1 membership from ' || public.nn_short_date(b.on_date) || ': paid ' || public.nn_pounds(v_paid) || ', now ' || public.nn_pounds(public.nn_session_price('one_to_one', true)))
        on conflict (booking_id) where booking_id is not null do nothing;
      else
        v_refund := 0;
      end if;
    end if;
  end if;

  perform public.nn_membership_fill(v_first, v_first + 56, v_place);

  v_schedule := initcap(p_day) || 's at ' || public.nn_clock(p_time) || case when p_cadence = 'alternating' then ', every other week' else ', every week' end
    || ', from ' || public.nn_short_date(v_first);
  v_body := 'Your sessions are now ' || public.nn_pounds(public.nn_session_price('one_to_one', true))
    || case when v_refund > 0 then ', and we''ll refund the ' || public.nn_pounds(v_refund) || ' difference from today.'
            when b.id is not null and b.payment_status is distinct from 'waived' then ', starting with today''s.'
            else '.' end;
  v_notice := public.nn_notice(v_dog.account_id, '🎉 Welcome to 1-1 membership!', v_body, '/dog');
  perform public.nn_chat_post(v_dog.account_id,
    'Welcome to 1-1 membership! ' || v_body || ' ' || v_dog.name || ': ' || v_schedule || '.',
    'membership',
    jsonb_build_object('placement_id', v_place, 'service', 'one_to_one', 'dog', v_dog.name, 'dog_id', v_dog.id,
                       'day', p_day, 'cadence', p_cadence, 'time', to_char(p_time, 'HH24:MI'), 'start_on', v_first,
                       'schedule', v_schedule, 'price_pence', public.nn_session_price('one_to_one', true), 'refund_pence', v_refund));

  select coalesce(nullif(btrim(owner_name), ''), 'the owner') into v_owner from public.profiles where id = v_dog.account_id;
  return jsonb_build_object('placementId', v_place, 'firstOn', v_first, 'refundPence', v_refund, 'ownerName', v_owner,
                            'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_membership_start_one_to_one(uuid, text, text, time, date, uuid, integer) from public, anon;
grant execute on function public.nn_membership_start_one_to_one(uuid, text, text, time, date, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: put a dog on Online Training (£25 a week), with their goals.
-- ---------------------------------------------------------------------------
create or replace function public.nn_membership_start_online(p_dog_id uuid, p_start_on date default null, p_goals text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  v_place uuid;
  v_goals text[];
  v_start date := coalesce(p_start_on, public.nn_today());
  v_body text;
  v_notice uuid;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or v_dog.account_id is null then raise exception 'That dog isn''t on an owner''s account.'; end if;
  if exists (select 1 from public.placements where dog_id = v_dog.id and service = 'online' and (end_on is null or end_on >= public.nn_today())) then
    raise exception '% is already on Online Training.', v_dog.name;
  end if;
  select coalesce(array_agg(left(g, 200) order by o), '{}') into v_goals
  from unnest(coalesce(p_goals, '{}')) with ordinality as x(raw, o), lateral (select btrim(raw) as g) y
  where g <> '';
  if cardinality(v_goals) > 20 then raise exception 'Keep it to 20 goals.'; end if;

  insert into public.placements (service, day, cadence, start_on, account_id, dog_id, goals, created_by)
  values ('online', null, 'weekly', v_start, v_dog.account_id, v_dog.id, v_goals, auth.uid())
  returning id into v_place;

  v_body := 'Each week your homework for ' || v_dog.name || ' will be in the Homework tab, and on Sunday evenings we''ll ask how the week went. '
    || 'Message us any time — we reply within 12 hours.';
  v_notice := public.nn_notice(v_dog.account_id, '🎉 Welcome to Online Training!', v_body, '/homework');
  perform public.nn_chat_post(v_dog.account_id, 'Welcome to Online Training! ' || v_body, 'membership',
    jsonb_build_object('placement_id', v_place, 'service', 'online', 'dog', v_dog.name, 'dog_id', v_dog.id,
                       'start_on', v_start, 'schedule', 'Homework every week, from ' || public.nn_short_date(v_start),
                       'price_pence', 2500, 'goals', to_jsonb(v_goals)));
  return jsonb_build_object('placementId', v_place, 'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_membership_start_online(uuid, date, text[]) from public, anon;
grant execute on function public.nn_membership_start_online(uuid, date, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: end a membership after p_last (its last day). A 1-1
-- membership's sessions after that go, unless they've been charged.
-- ---------------------------------------------------------------------------
create or replace function public.nn_membership_end(p_placement_id uuid, p_last date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pl public.placements; v_removed int := 0;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into pl from public.placements where id = p_placement_id for update;
  if pl.id is null then raise exception 'That membership isn''t there any more.'; end if;
  if p_last is null then raise exception 'Pick the last day.'; end if;
  if p_last < pl.start_on then
    update public.bookings set placement_id = null where placement_id = pl.id and (payment_status not in ('unpaid') or gc_payment_id is not null);
    delete from public.bookings where placement_id = pl.id and on_date >= pl.start_on and payment_status = 'unpaid' and gc_payment_id is null
      and not exists (select 1 from public.attendance a where a.booking_id = bookings.id);
    get diagnostics v_removed = row_count;
    delete from public.placements where id = pl.id;
    return jsonb_build_object('deleted', true, 'removed', v_removed);
  end if;
  update public.placements set end_on = p_last where id = pl.id;
  delete from public.bookings where placement_id = pl.id and on_date > p_last and payment_status = 'unpaid' and gc_payment_id is null
    and not exists (select 1 from public.attendance a where a.booking_id = bookings.id);
  get diagnostics v_removed = row_count;
  update public.bookings set cancelled_at = coalesce(cancelled_at, now()) where placement_id = pl.id and on_date > p_last;
  return jsonb_build_object('deleted', false, 'removed', v_removed);
end; $$;
revoke execute on function public.nn_membership_end(uuid, date) from public, anon;
grant execute on function public.nn_membership_end(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- The signed-in owner's memberships (current or starting), and whether they
-- have any sessions booked: the app hides Schedule for online-only members.
-- ---------------------------------------------------------------------------
create or replace function public.nn_my_memberships()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'service', p.service, 'day', p.day, 'cadence', p.cadence, 'startOn', p.start_on, 'endOn', p.end_on,
        'startTime', to_char(p.start_time, 'HH24:MI'), 'durationMin', p.duration_min, 'goals', to_jsonb(p.goals),
        'dogId', p.dog_id, 'dogName', d.name) order by p.start_on)
      from public.placements p left join public.dogs d on d.id = p.dog_id
      where p.account_id = auth.uid() and (p.end_on is null or p.end_on >= public.nn_today())), '[]'::jsonb),
    'upcomingBookings', (select count(*) from public.bookings b
                         where b.account_id = auth.uid() and b.cancelled_at is null and b.on_date >= public.nn_today()),
    'member', public.nn_has_membership(auth.uid(), 'one_to_one'),
    'fullDayMember', public.nn_has_membership(auth.uid(), 'full_day'))
  where auth.uid() is not null;
$$;
revoke execute on function public.nn_my_memberships() from public, anon;
grant execute on function public.nn_my_memberships() to authenticated;

-- ---------------------------------------------------------------------------
-- The Online Training week
-- ---------------------------------------------------------------------------
alter table public.report_cards add column if not exists kind text not null default 'session';
alter table public.report_cards add column if not exists week_of date;
alter table public.report_cards add column if not exists review text;
alter table public.report_cards drop constraint if exists report_cards_kind_check;
alter table public.report_cards add constraint report_cards_kind_check check (kind in ('session', 'online_week'));
alter table public.report_cards drop constraint if exists report_cards_review_check;
alter table public.report_cards add constraint report_cards_review_check check (review is null or length(review) <= 2000);
create unique index if not exists report_cards_online_week_idx on public.report_cards (dog_id, week_of) where kind = 'online_week';

-- The week a check-in is about (Sunday to Tuesday: the week just gone), and
-- the week homework sent now is for (from Sunday: the coming week).
create or replace function public.nn_checkin_week(p_today date default null)
returns date language sql stable set search_path = public as $$
  select public.nn_monday_of(coalesce(p_today, public.nn_today()) - 2);
$$;
create or replace function public.nn_homework_week(p_today date default null)
returns date language sql stable set search_path = public as $$
  select public.nn_monday_of(coalesce(p_today, public.nn_today()) + 1);
$$;
grant execute on function public.nn_checkin_week(date), public.nn_homework_week(date) to authenticated;

create table if not exists public.online_checkins (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  account_id uuid references public.profiles (id) on delete cascade,
  report_card_id uuid references public.report_cards (id) on delete set null,
  week_of date not null,
  -- [{ "item_id": uuid, "name": text, "rating": "great" | "ok" | "struggled" }]
  drills jsonb not null default '[]'::jsonb,
  overall text check (overall is null or overall in ('great', 'ok', 'tough')),
  note text check (note is null or length(note) <= 2000),
  video_path text check (video_path is null or length(video_path) <= 300),
  message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dog_id, week_of)
);
create index if not exists online_checkins_week_idx on public.online_checkins (week_of);
alter table public.online_checkins enable row level security;
-- Read only: check-ins go through nn_online_checkin_submit.
revoke all on public.online_checkins from anon, authenticated;
grant select on public.online_checkins to authenticated;
drop policy if exists "online_checkins: trainers, owners read own" on public.online_checkins;
create policy "online_checkins: trainers, owners read own" on public.online_checkins
  for select to authenticated using (public.nn_is_admin() or account_id = auth.uid());

-- Sunday evening's push, once per account per week. Service role only.
create table if not exists public.online_checkin_reminders (
  account_id uuid not null references public.profiles (id) on delete cascade,
  week_of date not null,
  sent_at timestamptz not null default now(),
  primary key (account_id, week_of)
);
alter table public.online_checkin_reminders enable row level security;
revoke all on public.online_checkin_reminders from anon, authenticated;

-- The owner: this week's check-in for a dog. Every field is optional; one a week.
create or replace function public.nn_online_checkin_submit(
  p_dog_id uuid,
  p_drills jsonb default '[]'::jsonb,
  p_overall text default null,
  p_note text default null,
  p_video_path text default null,
  p_video_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dog public.dogs;
  v_week date := public.nn_checkin_week();
  v_card public.report_cards;
  v_drills jsonb;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_video text := nullif(btrim(coalesce(p_video_path, '')), '');
  v_overall text := nullif(p_overall, '');
  v_id uuid;
  v_conv uuid;
  v_msg uuid;
  v_at timestamptz := now();
  v_owner text;
  v_lines text;
  v_great int;
  v_ok int;
  v_struggled int;
  v_notices uuid[];
  v_overall_words text;
begin
  if v_uid is null then raise exception 'Please sign in again.'; end if;
  select * into v_dog from public.dogs where id = p_dog_id and account_id = v_uid;
  if v_dog.id is null then raise exception 'That dog isn''t on your account.'; end if;
  if v_overall is not null and v_overall not in ('great', 'ok', 'tough') then raise exception 'Pick how the week went.'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  if v_video is not null and (v_video not like v_uid::text || '/%' or position('..' in v_video) > 0 or length(v_video) > 300
     or not exists (select 1 from storage.objects o where o.bucket_id = 'homework-videos' and o.name = v_video)) then
    raise exception 'Couldn''t attach that video. Please try again.';
  end if;
  if exists (select 1 from public.online_checkins where dog_id = v_dog.id and week_of = v_week) then
    raise exception 'You''ve already checked in this week. Message us if there''s anything else.';
  end if;

  -- The homework being rated: this week's, else the latest online week's.
  select * into v_card from public.report_cards
  where dog_id = v_dog.id and kind = 'online_week' and status = 'published' and week_of <= v_week + 6
  order by week_of desc, created_at desc limit 1;

  -- Only that homework's drills, each great / ok / struggled.
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.drill_name, 'rating', x.rating) order by i.sort_order), '[]'::jsonb)
  into v_drills
  from jsonb_to_recordset(case when jsonb_typeof(p_drills) = 'array' then p_drills else '[]'::jsonb end) as x(item_id uuid, rating text)
  join public.report_card_items i on i.id = x.item_id and i.report_card_id = v_card.id
  where x.rating in ('great', 'ok', 'struggled');

  if v_overall is null and v_note is null and v_video is null and jsonb_array_length(v_drills) = 0 then
    raise exception 'Tap how it went, or add a note.';
  end if;

  insert into public.online_checkins (dog_id, account_id, report_card_id, week_of, drills, overall, note, video_path)
  values (v_dog.id, v_uid, v_card.id, v_week, v_drills, v_overall, v_note, v_video)
  returning id into v_id;

  v_overall_words := case v_overall when 'great' then 'A great week' when 'ok' then 'An OK week' when 'tough' then 'A tough week' end;
  select string_agg((d ->> 'name') || ': ' || case d ->> 'rating' when 'great' then 'great' when 'ok' then 'OK' else 'struggled' end, E'\n'),
         count(*) filter (where d ->> 'rating' = 'great'), count(*) filter (where d ->> 'rating' = 'ok'),
         count(*) filter (where d ->> 'rating' = 'struggled')
  into v_lines, v_great, v_ok, v_struggled
  from jsonb_array_elements(v_drills) d;

  -- In the owner's chat, as their own message (with the video), as homework days are.
  insert into public.conversations (account_id, last_message_at) values (v_uid, v_at) on conflict (account_id) do nothing;
  select id into v_conv from public.conversations where account_id = v_uid;
  insert into public.messages (conversation_id, sender_id, sender_is_staff, sender_name, body, attachment_path, attachment_type, attachment_name, kind, meta)
  values (v_conv, v_uid, false, null,
          left('Weekly check-in: ' || v_dog.name || coalesce(E'\n' || v_overall_words, '') || coalesce(E'\n' || v_lines, '')
               || coalesce(E'\n\n' || v_note, ''), 5000),
          case when v_video is null then null else 'homework-videos/' || v_video end,
          case when v_video is null then null else 'video' end,
          case when v_video is null then null else left(coalesce(nullif(p_video_name, ''), 'Check-in video.mp4'), 200) end,
          'checkin',
          jsonb_build_object('checkin_id', v_id, 'dog', v_dog.name, 'dog_id', v_dog.id, 'week_of', v_week, 'overall', v_overall,
                             'drills', v_drills, 'note', v_note, 'video', v_video is not null))
  returning id into v_msg;
  update public.conversations
  set last_message_at = v_at, completed_at = null, completed_by = null, member_last_read_at = v_at, member_last_active_at = v_at
  where id = v_conv;
  update public.online_checkins set message_id = v_msg where id = v_id;

  select nullif(btrim(owner_name), '') into v_owner from public.profiles where id = v_uid;
  v_notices := public.nn_notice_trainers(
    left('📝 Weekly check-in: ' || v_dog.name, 120),
    left(coalesce(v_owner, v_dog.name || '''s owner') || ': ' || coalesce(lower(v_overall_words) || '.', 'checked in.')
      || case when jsonb_array_length(v_drills) > 0
              then ' ' || concat_ws(', ', nullif(v_great, 0)::text || ' great', nullif(v_ok, 0)::text || ' OK', nullif(v_struggled, 0)::text || ' struggled') || '.'
              else '' end
      || case when v_video is not null then ' They sent a video.' else '' end
      || case when v_note is not null then ' "' || left(v_note, 140) || case when length(v_note) > 140 then '…' else '' end || '"' else '' end, 2000),
    '/conversation/' || v_conv::text);
  return jsonb_build_object('id', v_id, 'weekOf', v_week, 'messageId', v_msg, 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_online_checkin_submit(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function public.nn_online_checkin_submit(uuid, jsonb, text, text, text, text) to authenticated;

-- Trainer: send this week's homework (drills from the library or typed,
-- notes, and the review of last week). It's published straight away, as
-- an 'online_week' report card. p_items: [{ category, name, ref, pillar, note }].
create or replace function public.nn_online_send_week(
  p_dog_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_review text default null,
  p_week_of date default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  v_week date := public.nn_monday_of(coalesce(p_week_of, public.nn_homework_week()));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_review text := nullif(btrim(coalesce(p_review, '')), '');
  v_card uuid;
  v_items int;
  v_title text;
  v_notice uuid;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or v_dog.account_id is null then raise exception 'That dog isn''t on an owner''s account.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one drill.'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Keep it to 30 drills.'; end if;
  if v_notes is not null and length(v_notes) > 4000 then raise exception 'Keep the notes under 4,000 characters.'; end if;
  if v_review is not null and length(v_review) > 2000 then raise exception 'Keep the review under 2,000 characters.'; end if;
  if exists (select 1 from public.report_cards where dog_id = v_dog.id and kind = 'online_week' and week_of = v_week) then
    raise exception '%''s homework for the week of % has already gone. Edit it from their page.', v_dog.name, public.nn_short_date(v_week);
  end if;

  v_title := 'Week of ' || to_char(v_week, 'FMDD FMMonth');
  insert into public.report_cards (dog_id, author_id, status, session_date, title, summary, kind, week_of, review, published_at)
  values (v_dog.id, auth.uid(), 'published', v_week, v_title,
          nullif(concat_ws(E'\n\n', v_notes, case when v_review is not null then 'How last week went: ' || v_review end), ''),
          'online_week', v_week, v_review, now())
  returning id into v_card;

  insert into public.report_card_items (report_card_id, category, drill_name, drill_ref, pillar, note, sort_order)
  select v_card,
         left(coalesce(nullif(btrim(x.category), ''), 'This week'), 120),
         left(coalesce(nullif(btrim(x.name), ''), 'Drill ' || o), 300),
         nullif(btrim(coalesce(x.ref, '')), ''),
         nullif(btrim(coalesce(x.pillar, '')), ''),
         left(nullif(btrim(coalesce(x.note, '')), ''), 2000),
         (o - 1)::int
  from jsonb_array_elements(p_items) with ordinality as e(item, o),
       lateral jsonb_to_record(e.item) as x(category text, name text, ref text, pillar text, note text);
  get diagnostics v_items = row_count;

  v_notice := public.nn_notice(v_dog.account_id, '📚 Your homework for this week is ready',
    v_dog.name || '''s homework for the week of ' || to_char(v_week, 'FMDD FMMonth') || ' is in the Homework tab'
      || case when v_review is not null then ', with how last week went.' else '.' end,
    '/homework-detail/' || v_card::text);
  perform public.nn_chat_report_card(v_card);
  return jsonb_build_object('cardId', v_card, 'weekOf', v_week, 'items', v_items, 'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_online_send_week(uuid, jsonb, text, text, date) from public, anon;
grant execute on function public.nn_online_send_week(uuid, jsonb, text, text, date) to authenticated;

-- Trainer: the Online board — each online member's dog, goals, last
-- check-in and whether this week's homework has gone.
create or replace function public.nn_online_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_checkin_week date := public.nn_checkin_week(); v_homework_week date := public.nn_homework_week(); v_rows jsonb;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select coalesce(jsonb_agg(m.r order by m.r ->> 'dogName'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'placementId', p.id, 'dogId', p.dog_id, 'dogName', coalesce(d.name, p.holder_name, 'Dog'), 'dogPhoto', d.photo_url,
      'accountId', p.account_id, 'ownerName', pr.owner_name, 'goals', to_jsonb(p.goals), 'startOn', p.start_on, 'endOn', p.end_on,
      'lastCheckin', (select jsonb_build_object('id', c.id, 'weekOf', c.week_of, 'overall', c.overall, 'note', c.note, 'drills', c.drills,
                                                'video', c.video_path is not null, 'createdAt', c.created_at)
                      from public.online_checkins c where c.dog_id = p.dog_id order by c.week_of desc, c.created_at desc limit 1),
      'checkedInThisWeek', exists (select 1 from public.online_checkins c where c.dog_id = p.dog_id and c.week_of = v_checkin_week),
      'thisWeekCardId', (select rc.id from public.report_cards rc where rc.dog_id = p.dog_id and rc.kind = 'online_week' and rc.week_of = v_homework_week limit 1),
      'lastCardId', (select rc.id from public.report_cards rc where rc.dog_id = p.dog_id and rc.kind = 'online_week' order by rc.week_of desc limit 1)
    ) as r
    from public.placements p
    left join public.dogs d on d.id = p.dog_id
    left join public.profiles pr on pr.id = p.account_id
    where p.service = 'online' and (p.end_on is null or p.end_on >= public.nn_today())
  ) m;
  return jsonb_build_object('checkinWeek', v_checkin_week, 'homeworkWeek', v_homework_week, 'members', v_rows);
end; $$;
revoke execute on function public.nn_online_board() from public, anon;
grant execute on function public.nn_online_board() to authenticated;

-- Sunday evening (app/api/cron/evening): online members who haven't checked
-- in this week, claimed so each account gets it once a week. Service role only.
create or replace function public.nn_online_checkin_reminders_claim(p_week date default null)
returns table (account_id uuid, dog_names text[])
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare v_week date := coalesce(p_week, public.nn_checkin_week());
begin
  return query
  with due as (
    select p.account_id, array_agg(distinct d.name) as dog_names
    from public.placements p
    join public.dogs d on d.id = p.dog_id
    where p.service = 'online' and p.account_id is not null and p.start_on <= v_week + 6
      and (p.end_on is null or p.end_on >= v_week)
      and not exists (select 1 from public.online_checkins c where c.dog_id = p.dog_id and c.week_of = v_week)
    group by p.account_id
  ),
  claimed as (
    insert into public.online_checkin_reminders as r (account_id, week_of)
    select due.account_id, v_week from due
    on conflict do nothing
    returning r.account_id
  )
  select due.account_id, due.dog_names from due join claimed c on c.account_id = due.account_id;
end; $$;
revoke execute on function public.nn_online_checkin_reminders_claim(date) from public, anon, authenticated;
grant execute on function public.nn_online_checkin_reminders_claim(date) to service_role;
