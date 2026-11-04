-- ============================================================================
-- Nelly & Nova — the trainer's day: booking from a day, the register, reports
-- ============================================================================
-- bookings.duration_min
--   How long a 1-1 runs (minutes). Older rows have none.
-- enquiries.meet_greet_address / enquiries.dog_id
--   Meet & greets stay on enquiries (meet_greet_at, meet_greet_notes), as
--   the Onboarding board and the owner's app already read them. A day's
--   "Add a meet & greet" also keeps where it is and, for an existing
--   customer, which of their dogs it's for.
-- attendance
--   The register, filled in from Today: a Full Day dog is present (tapping
--   "Picked up") or absent, a 1-1 is done or a no show. One mark per dog per
--   date (Full Day) or per booking (1-1). Trainers write through
--   nn_mark_attendance; owners can read their own (nothing tells them).
-- nn_trainer_book_meet_greet
--   Books (or moves) a meet & greet from a day: on an open request, or for
--   an existing customer (their open request, else a new one on their
--   account), with the time, address and a note.
-- nn_trainer_calendar
--   As before; a meet & greet now carries its dog when it has one.
-- nn_my_meet_greet
--   As before, plus meetGreetAddress, and an upcoming booked meet & greet
--   comes first.
-- Additive and safe to run again.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists duration_min integer;
alter table public.bookings drop constraint if exists bookings_duration_min_check;
alter table public.bookings add constraint bookings_duration_min_check
  check (duration_min is null or duration_min between 15 and 480);

alter table public.enquiries add column if not exists meet_greet_address text;
alter table public.enquiries add column if not exists dog_id uuid references public.dogs (id) on delete set null;
alter table public.enquiries drop constraint if exists enquiries_meet_greet_address_check;
alter table public.enquiries add constraint enquiries_meet_greet_address_check
  check (meet_greet_address is null or length(meet_greet_address) <= 500);

-- ---------------------------------------------------------------------------
-- attendance — the register
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  session text not null check (session in ('full_day', 'one_to_one')),
  dog_id uuid references public.dogs (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  account_id uuid references public.profiles (id) on delete set null,
  status text not null check (status in ('present', 'absent', 'done', 'no_show')),
  marked_by uuid references public.profiles (id) on delete set null default auth.uid(),
  marked_at timestamptz not null default now(),
  constraint attendance_shape_check check (
    (session = 'full_day' and dog_id is not null and status in ('present', 'absent'))
    or (session = 'one_to_one' and booking_id is not null and status in ('done', 'no_show'))
  )
);
create unique index if not exists attendance_full_day_idx on public.attendance (on_date, dog_id) where session = 'full_day';
create unique index if not exists attendance_one_to_one_idx on public.attendance (booking_id) where session = 'one_to_one';
create index if not exists attendance_date_idx on public.attendance (on_date);
create index if not exists attendance_account_idx on public.attendance (account_id);

alter table public.attendance enable row level security;
-- Read only: marks go through nn_mark_attendance.
revoke all on public.attendance from anon, authenticated;
grant select on public.attendance to authenticated;
drop policy if exists "attendance: trainers, owners read own" on public.attendance;
create policy "attendance: trainers, owners read own" on public.attendance
  for select to authenticated using (public.nn_is_admin() or account_id = auth.uid());

-- Mark (or clear, with a null status) a dog on the register.
--   Full Day: p_date + p_dog_id, 'present' or 'absent'.
--   1-1: p_booking_id, 'done' or 'no_show' (its date and dog come from the booking).
create or replace function public.nn_mark_attendance(p_date date, p_dog_id uuid, p_status text, p_booking_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_account uuid;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;

  if p_booking_id is not null then
    select * into b from public.bookings where id = p_booking_id;
    if b.id is null or b.kind <> 'one_to_one' then raise exception 'That 1-1 isn''t on the calendar.'; end if;
    if p_status is null then
      delete from public.attendance where session = 'one_to_one' and booking_id = b.id;
      return jsonb_build_object('status', null);
    end if;
    if p_status not in ('done', 'no_show') then raise exception 'A 1-1 is done or a no show.'; end if;
    insert into public.attendance (on_date, session, dog_id, booking_id, account_id, status, marked_by, marked_at)
    values (b.on_date, 'one_to_one', coalesce(b.dog_id, p_dog_id), b.id, b.account_id, p_status, auth.uid(), now())
    on conflict (booking_id) where session = 'one_to_one'
    do update set status = excluded.status, dog_id = excluded.dog_id, account_id = excluded.account_id, marked_by = auth.uid(), marked_at = now();
    return jsonb_build_object('status', p_status);
  end if;

  if p_dog_id is null or p_date is null then raise exception 'Which dog, and which day?'; end if;
  select account_id into v_account from public.dogs where id = p_dog_id;
  if not found then raise exception 'That dog isn''t on file.'; end if;
  if p_status is null then
    delete from public.attendance where session = 'full_day' and on_date = p_date and dog_id = p_dog_id;
    return jsonb_build_object('status', null);
  end if;
  if p_status not in ('present', 'absent') then raise exception 'A Full Day dog is present or absent.'; end if;
  insert into public.attendance (on_date, session, dog_id, account_id, status, marked_by, marked_at)
  values (p_date, 'full_day', p_dog_id, v_account, p_status, auth.uid(), now())
  on conflict (on_date, dog_id) where session = 'full_day'
  do update set status = excluded.status, account_id = excluded.account_id, marked_by = auth.uid(), marked_at = now();
  return jsonb_build_object('status', p_status);
end; $$;
revoke execute on function public.nn_mark_attendance(date, uuid, text, uuid) from public, anon;
grant execute on function public.nn_mark_attendance(date, uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Book (or move) a meet & greet from a day. Returns the enquiry's id.
--   p_enquiry_id: that request.
--   p_account_id: an existing customer: their open request (new or already
--     booked), else a new request on their account, named after them and
--     the dog (p_dog_id, else all their dogs).
-- ---------------------------------------------------------------------------
create or replace function public.nn_trainer_book_meet_greet(
  p_at timestamptz,
  p_enquiry_id uuid default null,
  p_account_id uuid default null,
  p_dog_id uuid default null,
  p_address text default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := p_enquiry_id;
  v_profile public.profiles;
  v_dog_names text;
  v_place public.placements;
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  if p_at is null then raise exception 'Choose a day and a time.'; end if;
  if v_address is not null and length(v_address) > 500 then raise exception 'That address is too long.'; end if;
  if p_dog_id is not null and p_account_id is not null
     and not exists (select 1 from public.dogs where id = p_dog_id and account_id = p_account_id) then
    raise exception 'That dog isn''t on their account.';
  end if;

  if v_id is null then
    if p_account_id is null then raise exception 'Choose who the meet & greet is with.'; end if;
    select * into v_profile from public.profiles where id = p_account_id;
    if v_profile.id is null then raise exception 'That account isn''t on file.'; end if;
    -- Their open request, if they have one.
    select id into v_id from public.enquiries
    where account_id = p_account_id and kind = 'booking' and status in ('new', 'meet_greet_booked')
    order by created_at desc limit 1;
    if v_id is null then
      select coalesce((select name from public.dogs where id = p_dog_id),
                      (select string_agg(name, ', ' order by sort_order, created_at) from public.dogs where account_id = p_account_id))
      into v_dog_names;
      -- An existing customer's regular day carries over, so their set-up checklist doesn't ask for it again.
      select * into v_place from public.placements
      where account_id = p_account_id and (end_on is null or end_on >= public.nn_today())
      order by start_on limit 1;
      insert into public.enquiries (kind, status, name, email, phone, service, dog_names, account_id, dog_id, details,
                                    training_day, training_cadence, first_session_on)
      values ('booking', 'new', coalesce(nullif(btrim(v_profile.owner_name), ''), v_profile.email, 'Customer'),
              coalesce(v_profile.email, ''), v_profile.phone, 'Full Day Training', v_dog_names, p_account_id, p_dog_id,
              jsonb_build_object('source', 'trainer_app'),
              v_place.day, v_place.cadence, v_place.start_on)
      returning id into v_id;
    end if;
  end if;

  update public.enquiries
  set meet_greet_at = p_at,
      meet_greet_notes = v_notes,
      meet_greet_address = coalesce(v_address, meet_greet_address),
      dog_id = coalesce(p_dog_id, dog_id),
      status = case when status in ('new', 'meet_greet_booked') then 'meet_greet_booked' else status end,
      updated_at = now()
  where id = v_id and status <> 'closed';
  if not found then raise exception 'That request is closed.'; end if;
  return v_id;
end; $$;
revoke execute on function public.nn_trainer_book_meet_greet(timestamptz, uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.nn_trainer_book_meet_greet(timestamptz, uuid, uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The trainer's calendar, as before (cancelled dates left out); a meet &
-- greet now carries its dog when it has one.
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
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Bad range.'; end if;
  return query
  with days as (
    select d::date as dt, lower(trim(to_char(d, 'FMday'))) as dname
    from generate_series(p_from, p_to, interval '1 day') d
  )
  select days.dt, 'full_day'::text, null::time, pl.id, pl.account_id, pl.dog_id, dg.name, dg.photo_url,
         pr.owner_name, (dg.waiver_signed_at is not null), pl.holder_name, pl.enquiry_id
  from days
  join public.placements pl on pl.day = days.dname
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

-- ---------------------------------------------------------------------------
-- The owner's meet & greet card: as before, plus where it is; an upcoming
-- booked one comes before an older request.
-- ---------------------------------------------------------------------------
create or replace function public.nn_my_meet_greet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'status', e.status, 'service', e.service, 'dogNames', e.dog_names,
    'meetGreetAt', e.meet_greet_at, 'meetGreetNotes', e.meet_greet_notes,
    'meetGreetAddress', e.meet_greet_address,
    'joinToken', case when e.status = 'onboarding' then e.onboarding_token end,
    'trainingDay', e.training_day, 'trainingCadence', e.training_cadence, 'firstSessionOn', e.first_session_on,
    'createdAt', e.created_at)
  from public.enquiries e
  where e.account_id = auth.uid() and e.kind = 'booking' and e.status <> 'closed'
  order by coalesce(e.status = 'meet_greet_booked' and e.meet_greet_at >= now(), false) desc, e.created_at desc
  limit 1;
$$;
revoke execute on function public.nn_my_meet_greet() from public, anon;
grant execute on function public.nn_my_meet_greet() to authenticated;
