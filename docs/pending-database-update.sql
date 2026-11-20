-- Nelly & Nova database update (4 Nov changes). Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- All or nothing: if anything fails, nothing changes. Safe to run again.
begin;

-- ===== 20261104070000_trainer_today.sql
-- ============================================================================
-- Nelly & Nova — the trainer's Today tab: pick-up and drop-off runs
-- ============================================================================
-- route_stops
--   The order a trainer collects (run 'pickup') and drops off (run 'dropoff')
--   the day's Full Day Training dogs, one row per date, run and dog, and how
--   far along each stop is: waiting → on_route (the owner was told we're on
--   the way) → done (picked up / dropped off). notified_at is when the "on
--   our way" notification went, so it isn't sent twice by accident (the
--   website's app/api/route/notify claims it with one update).
--   Dogs without a row go to the end of the run in the app; the drop-off
--   run copies the pick-up order until it's rearranged.
-- Trainers only (nn_is_admin()): owners can neither read nor write it.
-- Additive and safe to run again.
-- ============================================================================

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  run text not null check (run in ('pickup', 'dropoff')),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  position integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'on_route', 'done')),
  notified_at timestamptz,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (on_date, run, dog_id)
);

create index if not exists route_stops_date_run on public.route_stops (on_date, run, position);

alter table public.route_stops enable row level security;

drop policy if exists "route_stops: trainers only" on public.route_stops;
create policy "route_stops: trainers only" on public.route_stops
  for all to authenticated
  using (public.nn_is_admin())
  with check (public.nn_is_admin());

revoke all on public.route_stops from anon;
grant select, insert, update, delete on public.route_stops to authenticated;

drop trigger if exists route_stops_set_updated_at on public.route_stops;
create trigger route_stops_set_updated_at before update on public.route_stops
  for each row execute function public.set_updated_at();

-- ===== 20261104080000_owner_onboarding.sql (homework part)
-- ============================================================================
-- Homework: done on 3 different days, once a day, and it never expires
-- ============================================================================
-- A report card's homework is complete once it has been done on 3
-- different days (UK dates), at most once a day. It stays to do until then:
-- the old "within 14 days of the card" window is gone (the website and the
-- app no longer show it; the policy that mentioned it was OR'd with
-- another, so it never actually applied).
--
-- homework_days
--   One row per card per day it was done (unique: the database refuses a
--   second time on the same day), with the owner's optional note and video,
--   so the homework's history shows them. Written by
--   nn_homework_complete_day, and by the guard below for clients that still
--   write homework_completions directly (older app builds, the website
--   before this change). Backfilled from homework_completions.
-- homework_completions (unchanged shape: a row per drill per day, which the
--   website's progress reads) gets a guard: never a 4th day on a card, and
--   never a day that hasn't happened yet.
-- homework-videos (storage)
--   Private bucket, videos only, up to 50 MB (the app keeps them to 30
--   seconds). Owners upload into their own folder (<account id>/…) and read
--   it; trainers read everything. Nobody signed in deletes: once a card
--   reaches 3 of 3 the website (app/api/homework/cleanup, plus a daily
--   sweep in the register-reminders cron) deletes its videos with the
--   service role and clears video_path, keeping the notes and dates.
-- nn_homework_complete_day(card, title, note, video…)
--   "Complete today" in the app. Refuses a second time on the same day and
--   a card already done 3 days. With a note or a video it also posts
--   "Homework: Sit, day 2 of 3" (the note, the video) in the owner's chat
--   and tells the trainers, returning the notice ids to push. The chat
--   message's attachment is "homework-videos/<path>": chat shows it from
--   that bucket, and "Video removed — homework completed" once it's gone.
-- nn_homework_videos_to_clean(card)
--   The videos of a finished card, for the cleanup route to delete: only to
--   the dog's owner or a trainer, and only once the card is at 3 of 3.
-- ============================================================================

create table if not exists public.homework_days (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  practised_on date not null,
  completed_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or length(note) <= 2000),
  video_path text check (video_path is null or (length(video_path) <= 300 and position('..' in video_path) = 0)),
  video_type text,
  video_removed_at timestamptz,
  message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (report_card_id, practised_on)
);
alter table public.homework_days add column if not exists video_removed_at timestamptz;
create index if not exists homework_days_dog_idx on public.homework_days (dog_id, practised_on desc);
create index if not exists homework_days_video_idx on public.homework_days (report_card_id) where video_path is not null;

alter table public.homework_days enable row level security;
revoke all on public.homework_days from anon;
revoke insert, update, delete, truncate, references, trigger on public.homework_days from authenticated;
grant select on public.homework_days to authenticated;
drop policy if exists "homework_days: own dog or trainer" on public.homework_days;
create policy "homework_days: own dog or trainer" on public.homework_days
  for select to authenticated using (public.owns_dog(dog_id) or public.nn_is_admin());

-- Days already done, from before this table.
insert into public.homework_days (report_card_id, dog_id, practised_on, completed_by, created_at)
select distinct on (i.report_card_id, hc.practised_on) i.report_card_id, hc.dog_id, hc.practised_on, hc.completed_by, coalesce(hc.completed_at, now())
from public.homework_completions hc
join public.report_card_items i on i.id = hc.report_card_item_id
where hc.practised_on is not null and hc.dog_id is not null
order by i.report_card_id, hc.practised_on, hc.completed_at
on conflict (report_card_id, practised_on) do nothing;

-- The homework videos bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework-videos', 'homework-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm', 'video/3gpp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "homework-videos: owners upload to their own folder" on storage.objects;
create policy "homework-videos: owners upload to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'homework-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "homework-videos: owners read their own, trainers read all" on storage.objects;
create policy "homework-videos: owners read their own, trainers read all" on storage.objects
  for select to authenticated
  using (bucket_id = 'homework-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.nn_is_admin()));

-- Today in the UK, the day "Complete today" counts for.
create or replace function public.nn_uk_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/London')::date;
$$;

create or replace function public.nn_homework_completion_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_card uuid; v_days int;
begin
  if new.report_card_item_id is null or new.practised_on is null then return new; end if;
  select report_card_id into v_card from public.report_card_items where id = new.report_card_item_id;
  if v_card is null then return new; end if;
  if new.practised_on > public.nn_uk_today() + 1 then
    raise exception 'That day hasn''t happened yet.';
  end if;
  if not exists (select 1 from public.homework_days where report_card_id = v_card and practised_on = new.practised_on) then
    select count(*) into v_days from public.homework_days where report_card_id = v_card;
    if v_days >= 3 then raise exception 'This homework is already complete.'; end if;
    insert into public.homework_days (report_card_id, dog_id, practised_on, completed_by)
    values (v_card, new.dog_id, new.practised_on, new.completed_by)
    on conflict (report_card_id, practised_on) do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.nn_homework_completion_guard() from public, anon, authenticated;
drop trigger if exists nn_homework_completion_guard on public.homework_completions;
create trigger nn_homework_completion_guard before insert on public.homework_completions
  for each row execute function public.nn_homework_completion_guard();

drop function if exists public.nn_homework_complete_day(uuid, text, text, text, text, text);
create or replace function public.nn_homework_complete_day(
  p_card_id uuid,
  p_title text default null,
  p_note text default null,
  p_video_path text default null,
  p_video_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.report_cards;
  v_dog public.dogs;
  v_today date := public.nn_uk_today();
  v_days int;
  v_day_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_video text := nullif(btrim(coalesce(p_video_path, '')), '');
  v_title text := left(coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'your homework'), 120);
  v_conv uuid;
  v_msg_id uuid;
  v_at timestamptz := now();
  v_owner text;
  v_notices uuid[] := '{}';
  v_body text;
begin
  if v_uid is null then raise exception 'Please sign in again.'; end if;
  select * into c from public.report_cards where id = p_card_id and status = 'published';
  if c.id is null then raise exception 'That homework isn''t available.'; end if;
  select * into v_dog from public.dogs where id = c.dog_id and account_id = v_uid;
  if v_dog.id is null then raise exception 'That homework isn''t available.'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  -- Their own upload in the homework videos bucket.
  if v_video is not null and (v_video not like v_uid::text || '/%' or position('..' in v_video) > 0 or length(v_video) > 300
     or not exists (select 1 from storage.objects o where o.bucket_id = 'homework-videos' and o.name = v_video)) then
    raise exception 'Couldn''t attach that video. Please try again.';
  end if;

  -- One card at a time, so two quick taps can't both count.
  perform 1 from public.report_cards where id = c.id for update;
  if exists (select 1 from public.homework_days where report_card_id = c.id and practised_on = v_today) then
    raise exception 'Already done today — come back tomorrow.';
  end if;
  select count(*) into v_days from public.homework_days where report_card_id = c.id;
  if v_days >= 3 then raise exception 'This homework is already complete.'; end if;

  insert into public.homework_days (report_card_id, dog_id, practised_on, completed_by, note, video_path, video_type)
  values (c.id, v_dog.id, v_today, v_uid, v_note, v_video, case when v_video is null then null else 'video' end)
  returning id into v_day_id;
  -- And a row per drill, as the website's progress counts it (the guard sees today's row and lets them in).
  insert into public.homework_completions (dog_id, report_card_item_id, completed_by, practised_on)
  select v_dog.id, i.id, v_uid, v_today from public.report_card_items i where i.report_card_id = c.id
  on conflict (report_card_item_id, practised_on) do nothing;
  v_days := v_days + 1;

  -- A note or a video goes to the trainers in the owner's chat, so they can reply there.
  if v_note is not null or v_video is not null then
    insert into public.conversations (account_id, last_message_at) values (v_uid, v_at) on conflict (account_id) do nothing;
    select id into v_conv from public.conversations where account_id = v_uid;
    v_body := 'Homework: ' || v_title || ', day ' || v_days || ' of 3' || case when v_note is null then '' else E'\n\n' || v_note end;
    -- As nn_chat_send sends an owner's message, with the video from its own bucket.
    insert into public.messages (conversation_id, sender_id, sender_is_staff, sender_name, body, attachment_path, attachment_type, attachment_name)
    values (v_conv, v_uid, false, null, left(v_body, 5000),
            case when v_video is null then null else 'homework-videos/' || v_video end,
            case when v_video is null then null else 'video' end,
            case when v_video is null then null else left(coalesce(nullif(p_video_name, ''), 'Homework video.mp4'), 200) end)
    returning id into v_msg_id;
    update public.conversations
    set last_message_at = v_at, completed_at = null, completed_by = null, member_last_read_at = v_at, member_last_active_at = v_at
    where id = v_conv;
    update public.homework_days set message_id = v_msg_id where id = v_day_id;

    select nullif(btrim(owner_name), '') into v_owner from public.profiles where id = v_uid;
    v_notices := public.nn_notice_trainers(
      left('🐾 Homework from ' || coalesce(v_owner, v_dog.name || '''s owner'), 120),
      left(v_dog.name || ': ' || v_title || ', day ' || v_days || ' of 3.'
           || case when v_video is not null then ' They sent a video.' else '' end
           || case when v_note is not null then ' "' || left(v_note, 140) || case when length(v_note) > 140 then '…' else '' end || '"' else '' end, 2000),
      '/conversation/' || v_conv::text
    );
  end if;

  return jsonb_build_object('dayId', v_day_id, 'day', v_days, 'complete', v_days >= 3, 'date', v_today,
                            'messageId', v_msg_id, 'notices', to_jsonb(v_notices));
end;
$$;
revoke execute on function public.nn_homework_complete_day(uuid, text, text, text, text) from public, anon;
grant execute on function public.nn_homework_complete_day(uuid, text, text, text, text) to authenticated;

-- The videos of a finished card, for app/api/homework/cleanup to delete.
create or replace function public.nn_homework_videos_to_clean(p_card_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare c public.report_cards; v_days int; v_paths text[];
begin
  if auth.uid() is null then return '{}'; end if;
  select * into c from public.report_cards where id = p_card_id;
  if c.id is null or not (public.owns_dog(c.dog_id) or public.nn_is_admin()) then return '{}'; end if;
  select count(*) into v_days from public.homework_days where report_card_id = c.id;
  if v_days < 3 then return '{}'; end if;
  select coalesce(array_agg(video_path), '{}') into v_paths from public.homework_days where report_card_id = c.id and video_path is not null;
  return v_paths;
end;
$$;
revoke execute on function public.nn_homework_videos_to_clean(uuid) from public, anon;
grant execute on function public.nn_homework_videos_to_clean(uuid) to authenticated;

-- ===== 20261104090000_dogs_private.sql
-- ============================================================================
-- Nelly & Nova — dog records are private (applied 4 Nov 2026)
-- ============================================================================
-- "dogs: read all (community)" let any signed-in owner read every dog's row,
-- health and vet details included. Nothing needs it: owners read their own
-- dogs ("nn: read own dogs"), trainers read all (nn_is_admin()), and the
-- community shows dog names and photos through nn_community_authors, which
-- runs with its own rights. Safe to run again.
-- ============================================================================

drop policy if exists "dogs: read all (community)" on public.dogs;

-- ===== 20261104100000_trainer_flow.sql
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

-- ===== 20261104110000_owner_flow.sql
-- ============================================================================
-- Nelly & Nova — the owner's day: reminders, pick-up and drop-off, photos
-- ============================================================================
-- route_stops.done_notified_at
--   When the owner was told "Picked up" / "Dropped off" (the stop reaching
--   done on the trainer's Today tab). The website's app/api/route/notify
--   claims it with one update, so a stop sends it once, even after an
--   Undo and a second tap.
--
-- owner_reminders_sent
--   The evening-before reminders that have gone ("🐾 Bella's training
--   tomorrow"): one row per date, kind and session (a regular place, a
--   booking or a meet & greet request), so the daily cron never sends one
--   twice. Service role only.
--
-- nn_owner_reminders_claim(date)
--   For the evening cron (app/api/cron/evening): everything on that date
--   with an owner to tell, claimed in the same statement, so only rows not
--   yet sent come back. Full Day Training from regular places (minus skips)
--   and one-off bookings, 1-1s with their time, and meet & greets with
--   theirs. Service role only.
--
-- day_photos / day-photos (storage)
--   Photos from a dog's day. Trainers add them from the dog's page in the
--   app (several at once, compressed); files live in the private bucket
--   "day-photos" at <dog id>/<YYYY-MM-DD>/<name>.jpg, with a row each here.
--   Trainers upload, read and delete; an owner reads only their own dogs'
--   photos (nn_day_photo_visible). Kept 90 days: the daily cron deletes
--   older files with the service role, then their rows (SQL can't delete
--   from storage.objects).
--
-- day_photo_notices
--   "📸 New photos of Bella" goes at most once per dog per day: the first
--   batch of the day claims the row (app/api/day-photos/notify). Trainers only.
--
-- Additive and safe to run again.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Picked up / dropped off
-- ---------------------------------------------------------------------------
alter table public.route_stops add column if not exists done_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- The evening-before reminders
-- ---------------------------------------------------------------------------
create table if not exists public.owner_reminders_sent (
  on_date date not null,
  kind text not null check (kind in ('full_day', 'one_to_one', 'meet_greet')),
  ref_id uuid not null,
  account_id uuid references public.profiles (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (on_date, kind, ref_id)
);
create index if not exists owner_reminders_sent_sent_at_idx on public.owner_reminders_sent (sent_at);

alter table public.owner_reminders_sent enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes it.
revoke all on public.owner_reminders_sent from anon, authenticated;

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
  return query
  with due as (
    -- Full Day Training: regular places running that day, minus skips.
    select 'full_day'::text as kind, pl.id as ref_id, d.account_id, d.id as dog_id, d.name as dog_name, null::time as start_time
    from public.placements pl
    join public.dogs d on d.id = pl.dog_id
    where d.account_id is not null
      and public.nn_placement_on(pl.id, p_on)
      and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = p_on)
    union all
    -- One-off Full Days and 1-1s that aren't cancelled.
    select case when b.kind = 'full_day' then 'full_day' else 'one_to_one' end, b.id, d.account_id, d.id, d.name, b.start_time
    from public.bookings b
    join public.dogs d on d.id = b.dog_id
    where b.on_date = p_on and b.cancelled_at is null and d.account_id is not null
    union all
    -- Meet & greets, for owners who already have an account.
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
-- Photos from the day
-- ---------------------------------------------------------------------------
-- A trainer, or the owner of the dog whose folder it is (a dog id as text).
create or replace function public.nn_day_photo_visible(p_dog text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nn_is_admin()
      or exists (select 1 from public.dogs d where d.id::text = p_dog and d.account_id = auth.uid());
$$;
revoke execute on function public.nn_day_photo_visible(text) from public, anon;
grant execute on function public.nn_day_photo_visible(text) to authenticated;

create table if not exists public.day_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  taken_on date not null default ((now() at time zone 'Europe/London')::date),
  path text not null unique,
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
-- The file sits in the dog's own folder: <dog id>/<YYYY-MM-DD>/<name>.<ext>.
alter table public.day_photos drop constraint if exists day_photos_path_check;
alter table public.day_photos add constraint day_photos_path_check check (
  length(path) <= 200
  and path ~ ('^' || dog_id::text || '/[0-9]{4}-[0-9]{2}-[0-9]{2}/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|heic|webp)$')
);
create index if not exists day_photos_dog_idx on public.day_photos (dog_id, taken_on desc, created_at desc);
create index if not exists day_photos_created_idx on public.day_photos (created_at);

alter table public.day_photos enable row level security;
revoke all on public.day_photos from anon;
grant select, insert, delete on public.day_photos to authenticated;

drop policy if exists "day_photos: trainers and the dog's owner read" on public.day_photos;
create policy "day_photos: trainers and the dog's owner read" on public.day_photos
  for select to authenticated
  using (public.nn_day_photo_visible(dog_id::text));
drop policy if exists "day_photos: trainers add" on public.day_photos;
create policy "day_photos: trainers add" on public.day_photos
  for insert to authenticated
  with check (public.nn_is_admin());
drop policy if exists "day_photos: trainers delete" on public.day_photos;
create policy "day_photos: trainers delete" on public.day_photos
  for delete to authenticated
  using (public.nn_is_admin());

-- The bucket: private, photos only, up to 15 MB each (the app compresses them).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('day-photos', 'day-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "day-photos: trainers upload" on storage.objects;
create policy "day-photos: trainers upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'day-photos' and public.nn_is_admin());
drop policy if exists "day-photos: trainers and the dog's owner read" on storage.objects;
create policy "day-photos: trainers and the dog's owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'day-photos' and public.nn_day_photo_visible((storage.foldername(name))[1]));
drop policy if exists "day-photos: trainers delete" on storage.objects;
create policy "day-photos: trainers delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'day-photos' and public.nn_is_admin());

-- "📸 New photos of Bella": once per dog per day.
create table if not exists public.day_photo_notices (
  dog_id uuid not null references public.dogs (id) on delete cascade,
  on_date date not null,
  notified_at timestamptz not null default now(),
  primary key (dog_id, on_date)
);
alter table public.day_photo_notices enable row level security;
revoke all on public.day_photo_notices from anon;
grant select, insert, delete on public.day_photo_notices to authenticated;
drop policy if exists "day_photo_notices: trainers only" on public.day_photo_notices;
create policy "day_photo_notices: trainers only" on public.day_photo_notices
  for all to authenticated
  using (public.nn_is_admin())
  with check (public.nn_is_admin());

-- ===== 20261104120000_chat_cards.sql
-- ============================================================================
-- Nelly & Nova — rich cards and quick replies in chat
-- ============================================================================
-- Safe to re-run; additive only. Builds on 20261103000000_chat.sql,
-- 20261104050000_dog_profile.sql and 20261104080000_owner_onboarding.sql.
--
--   * messages.kind / messages.meta: a line the system writes (a session
--     request, a cancellation, a day of homework, a report card) carries
--     what it is about, so the website and the app can show it as a card
--     with buttons. `body` keeps the same plain text as before, for older
--     apps, the inbox preview and anything else that reads it. A message
--     without a kind is shown exactly as before.
--   * The writers set them: nn_request_create / _decide / _pick_offer /
--     _withdraw, nn_session_cancel and nn_homework_complete_day (re-created
--     here from their latest definitions, chat line aside unchanged), and
--     nn_chat_report_card, which app/api/reports/publish calls.
--   * chat_quick_replies: each trainer's own row of reply chips.
--   * nn_chat_unread_counts / nn_chat_next_session: unread numbers for the
--     trainer inbox, and the day of an owner's next session ("see you
--     Thursday!").
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists kind text;
alter table public.messages add column if not exists meta jsonb;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind is null or kind in ('request', 'cancellation', 'homework_day', 'report_card'));
-- "Has this report card been posted to the chat yet?"
create index if not exists messages_kind_card_idx on public.messages ((meta ->> 'card_id')) where kind is not null;

-- ---------------------------------------------------------------------------
-- A card in the owner's chat, from whoever is acting (the owner, or a trainer
-- as staff). nn_request_chat with a kind and meta; internal.
-- p_reopen = false leaves a conversation that's marked done as it is.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_post(p_account uuid, p_body text, p_kind text, p_meta jsonb, p_reopen boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_staff boolean := public.nn_is_admin(); v_name text; v_at timestamptz := now(); v_id uuid;
begin
  if p_account is null then return null; end if;
  insert into public.conversations (account_id, last_message_at) values (p_account, v_at) on conflict (account_id) do nothing;
  select id into v_conv from public.conversations where account_id = p_account;
  if v_staff then select nullif(btrim(owner_name), '') into v_name from public.profiles where id = auth.uid(); end if;
  insert into public.messages (conversation_id, sender_id, sender_is_staff, sender_name, body, kind, meta)
  values (v_conv, auth.uid(), v_staff, v_name, left(p_body, 5000), p_kind, p_meta)
  returning id into v_id;
  if v_staff then
    update public.conversations
    set last_message_at = v_at, staff_last_read_at = v_at,
        completed_at = case when p_reopen then null else completed_at end,
        completed_by = case when p_reopen then null else completed_by end
    where id = v_conv;
  else
    update public.conversations set last_message_at = v_at, completed_at = null, completed_by = null, member_last_read_at = v_at, member_last_active_at = v_at where id = v_conv;
  end if;
  return v_id;
exception when others then
  -- The chat is a nicety: never let it stop the change itself.
  raise warning 'nn_chat_post: %', sqlerrm;
  return null;
end; $$;
revoke execute on function public.nn_chat_post(uuid, text, text, jsonb, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A session request as a card: what it is, the dog, the dates in words and
-- its status now, plus the raw fields. p_event says what just happened
-- (created, accepted, suggested, declined, picked, withdrawn). The apps
-- also look up the request's live status, so an old card doesn't offer
-- Accept on a request that's been decided since.
-- ---------------------------------------------------------------------------
create or replace function public.nn_request_card(p_id uuid, p_event text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.session_requests;
  v_dog text;
  v_title text;
  v_dates text;
  v_regular boolean;
begin
  select * into r from public.session_requests where id = p_id;
  if r.id is null then return null; end if;
  select name into v_dog from public.dogs where id = r.dog_id;
  v_regular := r.kind in ('add_regular', 'switch_permanent');
  v_title := case r.kind
    when 'replacement' then 'Replacement day'
    when 'one_off' then case when r.service = 'one_to_one' then '1-1 session' else 'Extra Full Day' end
    when 'add_regular' then 'New regular day'
    when 'switch_week' then 'Move a session'
    else 'Change of regular day' end;
  if r.status = 'confirmed' and r.confirmed_date is not null then
    v_dates := case when v_regular
      then initcap(coalesce(r.confirmed_day, public.nn_weekday_of(r.confirmed_date))) || 's from ' || public.nn_short_date(r.confirmed_date)
      else public.nn_short_date(r.confirmed_date) end;
  elsif r.status = 'offered' and r.offered_dates is not null then
    v_dates := 'Offered ' || (select string_agg(case when v_regular
                                                  then initcap(public.nn_weekday_of(d)) || 's from ' || public.nn_short_date(d)
                                                  else public.nn_short_date(d) end, ', ' order by d)
                              from unnest(r.offered_dates) d);
  else
    v_dates := case r.kind
      when 'replacement' then public.nn_short_date(r.requested_date) || ' (for ' || public.nn_short_date(r.from_date) || ')'
      when 'one_off' then public.nn_short_date(r.requested_date)
        || case when r.service = 'one_to_one' then ', ' || coalesce(r.part_of_day, 'any time') else '' end
      when 'add_regular' then initcap(r.requested_day) || 's' || case when r.cadence = 'alternating' then ', every other week' else '' end
      when 'switch_week' then public.nn_short_date(r.from_date) || ' to ' || public.nn_short_date(r.requested_date)
      else initcap(r.requested_day) || 's' end;
  end if;
  return jsonb_build_object(
    'request_id', r.id, 'type', r.kind, 'event', p_event, 'status', r.status,
    'dog', v_dog, 'dog_id', r.dog_id, 'title', v_title, 'dates', v_dates,
    'note', case when p_event in ('accepted', 'suggested', 'declined') then r.decision_note else r.note end,
    'service', r.service, 'part_of_day', r.part_of_day, 'cadence', r.cadence,
    'from_date', r.from_date, 'requested_date', r.requested_date, 'requested_day', r.requested_day,
    'offered_dates', to_jsonb(r.offered_dates), 'confirmed_date', r.confirmed_date, 'confirmed_day', r.confirmed_day);
end; $$;
revoke execute on function public.nn_request_card(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The writers, as they are in 20261104050000_dog_profile.sql and
-- 20261104080000_owner_onboarding.sql, each with its chat line now a card.
-- Only the chat line changes; the body text stays the same.
-- ---------------------------------------------------------------------------

-- Owner (or a trainer for them) cancels: a "cancellation" card.
create or replace function public.nn_session_cancel(p_dog_id uuid, p_from date, p_to date default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  v_to date := coalesce(p_to, p_from);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_dates date[] := '{}';
  v_n int;
  v_owner text;
  v_when text;
  v_notices uuid[];
begin
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or (v_dog.account_id is distinct from auth.uid() and not public.nn_is_admin()) then
    raise exception 'That dog isn''t on your account.';
  end if;
  if p_from is null or v_to < p_from then raise exception 'Pick the dates.'; end if;
  if p_from <= public.nn_today() and not public.nn_is_admin() then
    raise exception 'Sessions can be cancelled up to the day before. For today, message us.';
  end if;
  if v_to - p_from > 120 then raise exception 'Pick up to four months at a time.'; end if;

  -- Regular places: a skip on each date in the range.
  with ins as (
    insert into public.placement_skips (placement_id, on_date, reason)
    select pl.id, d::date, v_reason
    from public.placements pl, generate_series(p_from, v_to, interval '1 day') d
    where pl.dog_id = p_dog_id and public.nn_placement_on(pl.id, d::date)
    on conflict (placement_id, on_date) do nothing
    returning on_date
  ) select coalesce(array_agg(on_date), '{}') into v_dates from ins;

  -- One-off days and 1-1s.
  with upd as (
    update public.bookings set cancelled_at = now()
    where dog_id = p_dog_id and on_date between p_from and v_to and cancelled_at is null
    returning on_date
  ) select v_dates || coalesce(array_agg(on_date), '{}') into v_dates from upd;

  v_n := coalesce(array_length(v_dates, 1), 0);
  if v_n = 0 then raise exception 'There are no sessions to cancel on those dates.'; end if;
  select array_agg(x order by x) into v_dates from (select distinct unnest(v_dates) x) s;
  v_n := array_length(v_dates, 1);

  select coalesce(nullif(btrim(owner_name), ''), 'The owner') into v_owner from public.profiles where id = v_dog.account_id;
  v_when := case when v_n = 1 then public.nn_long_date(v_dates[1])
                 else v_n || ' sessions, ' || public.nn_short_date(v_dates[1]) || ' to ' || public.nn_short_date(v_dates[v_n]) end;
  v_notices := public.nn_notice_trainers(
    '🚫 ' || v_dog.name || ' is off ' || case when v_n = 1 then 'on ' || public.nn_short_date(v_dates[1]) else 'for ' || v_n || ' sessions' end,
    v_owner || ' cancelled ' || v_dog.name || '''s ' || v_when || '.' || coalesce(' "' || v_reason || '"', ''),
    '/registers');
  perform public.nn_chat_post(v_dog.account_id, 'Cancelled ' || v_dog.name || '''s ' || v_when || '. Sessions aren''t refunded.'
    || coalesce(' Note: ' || v_reason, ''),
    'cancellation',
    jsonb_build_object('dog', v_dog.name, 'dog_id', v_dog.id, 'dates', to_jsonb(v_dates), 'from', v_dates[1], 'to', v_dates[v_n],
                       'count', v_n, 'when', v_when, 'reason', v_reason));

  return jsonb_build_object('cancelled', v_n, 'dates', to_jsonb(v_dates), 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_session_cancel(uuid, date, date, text) from public, anon;
grant execute on function public.nn_session_cancel(uuid, date, date, text) to authenticated;

-- A new request: a "request" card (pending).
create or replace function public.nn_request_create(
  p_dog_id uuid,
  p_kind text,
  p_date date default null,
  p_day text default null,
  p_service text default 'full_day',
  p_part_of_day text default null,
  p_placement_id uuid default null,
  p_from_date date default null,
  p_cadence text default 'weekly',
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dog public.dogs;
  v_place public.placements;
  v_today date := public.nn_today();
  r public.session_requests;
  v_owner text;
  v_notices uuid[];
  v_booking uuid;
begin
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null or (v_dog.account_id is distinct from auth.uid() and not public.nn_is_admin()) then
    raise exception 'That dog isn''t on your account.';
  end if;
  if p_kind not in ('replacement','one_off','add_regular','switch_week','switch_permanent') then raise exception 'Unknown request.'; end if;

  -- A date, for everything but a regular day: a weekday after today, not full.
  if p_kind in ('replacement','one_off','switch_week') then
    if p_date is null or public.nn_weekday_of(p_date) is null or p_date <= v_today then raise exception 'Pick a weekday after today.'; end if;
    if (p_kind <> 'one_off' or coalesce(p_service, 'full_day') = 'full_day') and public.nn_day_full(p_date) then
      raise exception 'That day is full. Please pick another.';
    end if;
  else
    if p_day is null or p_day not in ('monday','tuesday','wednesday','thursday','friday') then raise exception 'Pick a weekday.'; end if;
  end if;

  if p_kind in ('switch_week','switch_permanent') or (p_kind = 'replacement' and p_placement_id is not null) then
    select * into v_place from public.placements where id = p_placement_id;
    if v_place.id is null or v_place.dog_id is distinct from p_dog_id then raise exception 'That regular day isn''t yours to change.'; end if;
  end if;

  if p_kind = 'switch_permanent' then
    if v_place.end_on is not null and v_place.end_on < v_today then raise exception 'That regular day has ended.'; end if;
    if p_day = v_place.day then raise exception 'That''s already their day.'; end if;
  elsif p_kind = 'switch_week' then
    if p_from_date is null or p_from_date <= v_today or not public.nn_placement_on(v_place.id, p_from_date)
       or exists (select 1 from public.placement_skips s where s.placement_id = v_place.id and s.on_date = p_from_date) then
      raise exception 'Pick one of their upcoming sessions to move.';
    end if;
  elsif p_kind = 'replacement' then
    if p_from_date is null then raise exception 'Which session is this replacing?'; end if;
    if p_placement_id is not null then
      if not exists (select 1 from public.placement_skips s where s.placement_id = p_placement_id and s.on_date = p_from_date) then
        raise exception 'Cancel that session first.';
      end if;
    else
      select id into v_booking from public.bookings
        where dog_id = p_dog_id and on_date = p_from_date and cancelled_at is not null order by cancelled_at desc limit 1;
      if v_booking is null then raise exception 'Cancel that session first.'; end if;
    end if;
    if exists (select 1 from public.session_requests x where x.kind = 'replacement' and x.dog_id = p_dog_id
                 and x.from_date = p_from_date and x.status in ('pending','offered','confirmed')) then
      raise exception 'You''ve already asked for a replacement for that session.';
    end if;
  end if;

  insert into public.session_requests (kind, account_id, dog_id, placement_id, booking_id, from_date, service, part_of_day,
                                       cadence, requested_date, requested_day, note)
  values (p_kind, v_dog.account_id, p_dog_id,
          case when p_kind in ('switch_week','switch_permanent','replacement') then p_placement_id end,
          v_booking,
          case when p_kind in ('replacement','switch_week') then p_from_date end,
          case when p_kind = 'one_off' and p_service = 'one_to_one' then 'one_to_one' else 'full_day' end,
          case when p_kind = 'one_off' and p_service = 'one_to_one' then p_part_of_day end,
          case when p_cadence = 'alternating' and p_kind = 'add_regular' then 'alternating' else 'weekly' end,
          case when p_kind in ('replacement','one_off','switch_week') then p_date end,
          case when p_kind in ('add_regular','switch_permanent') then p_day end,
          nullif(btrim(coalesce(p_note, '')), ''))
  returning * into r;

  select coalesce(nullif(btrim(owner_name), ''), 'An owner') into v_owner from public.profiles where id = v_dog.account_id;
  v_notices := public.nn_notice_trainers(
    '📅 ' || v_dog.name || ': new request',
    v_owner || ' asked for ' || public.nn_request_words(r) || '.' || coalesce(' "' || r.note || '"', ''),
    '/requests/' || r.id);
  perform public.nn_chat_post(v_dog.account_id,
    'Request for ' || v_dog.name || ': ' || public.nn_request_words(r) || '.' || coalesce(' Note: ' || r.note, '')
    || ' We''ll confirm or suggest another day. /requests/' || r.id,
    'request', public.nn_request_card(r.id, 'created'));

  return jsonb_build_object('id', r.id, 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_request_create(uuid, text, date, text, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.nn_request_create(uuid, text, date, text, text, text, uuid, date, text, text) to authenticated;

-- Trainer accepts, suggests or declines: a "request" card with the new status.
create or replace function public.nn_request_decide(p_id uuid, p_decision text, p_dates date[] default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.session_requests;
  v_dog text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_dates date[];
  v_title text;
  v_body text;
  v_notice uuid;
  v_d date;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into r from public.session_requests where id = p_id for update;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.status not in ('pending','offered') then raise exception 'That request has already been decided.'; end if;
  select name into v_dog from public.dogs where id = r.dog_id;

  if p_decision = 'accept' then
    perform public.nn_request_apply(p_id, null);
    select * into r from public.session_requests where id = p_id;
    v_title := '✅ ' || v_dog || '''s request is confirmed';
    v_body := 'We''ve confirmed ' || public.nn_request_words(r) || '.' || coalesce(' ' || v_note, '');
  elsif p_decision = 'suggest' then
    select array_agg(distinct d order by d) into v_dates from unnest(coalesce(p_dates, '{}')) d where d is not null;
    if v_dates is null or array_length(v_dates, 1) > 3 then raise exception 'Suggest one to three dates.'; end if;
    foreach v_d in array v_dates loop
      if public.nn_weekday_of(v_d) is null or v_d <= public.nn_today() then raise exception 'Suggest weekdays after today.'; end if;
    end loop;
    update public.session_requests set status = 'offered', offered_dates = v_dates, updated_at = now() where id = p_id;
    v_title := '📅 A different day for ' || v_dog;
    v_body := 'We can''t do ' || public.nn_request_words(r) || ', but we can offer '
      || (select string_agg(case when r.kind in ('add_regular','switch_permanent')
                                 then initcap(public.nn_weekday_of(d)) || 's from ' || public.nn_short_date(d)
                                 else public.nn_long_date(d) end, ', ' order by d) from unnest(v_dates) d)
      || '. Tap one to confirm.' || coalesce(' ' || v_note, '');
  elsif p_decision = 'decline' then
    update public.session_requests set status = 'declined', updated_at = now() where id = p_id;
    v_title := '❌ ' || v_dog || '''s request';
    v_body := 'Sorry, we can''t do ' || public.nn_request_words(r) || '.' || coalesce(' ' || v_note, '');
  else
    raise exception 'Accept, suggest or decline.';
  end if;

  update public.session_requests set decision_note = v_note, decided_by = auth.uid(), decided_at = now() where id = p_id;
  v_notice := public.nn_notice(r.account_id, v_title, v_body, '/schedule');
  perform public.nn_chat_post(r.account_id, v_body || ' /requests/' || r.id,
    'request', public.nn_request_card(r.id, case p_decision when 'accept' then 'accepted' when 'suggest' then 'suggested' else 'declined' end));
  select * into r from public.session_requests where id = p_id;
  return jsonb_build_object('id', r.id, 'status', r.status, 'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_request_decide(uuid, text, date[], text) from public, anon;
grant execute on function public.nn_request_decide(uuid, text, date[], text) to authenticated;

-- Owner takes an offer: a "request" card (confirmed).
create or replace function public.nn_request_pick_offer(p_id uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.session_requests; v_dog text; v_notices uuid[];
begin
  select * into r from public.session_requests where id = p_id for update;
  if r.id is null or r.account_id is distinct from auth.uid() then raise exception 'Request not found.'; end if;
  if r.status <> 'offered' then raise exception 'There''s nothing to pick on that request.'; end if;
  if p_date is null or not (p_date = any (r.offered_dates)) then raise exception 'Pick one of the days offered.'; end if;
  perform public.nn_request_apply(p_id, p_date);
  select * into r from public.session_requests where id = p_id;
  select name into v_dog from public.dogs where id = r.dog_id;
  v_notices := public.nn_notice_trainers('✅ ' || v_dog || ': offer taken',
    (select coalesce(nullif(btrim(owner_name), ''), 'The owner') from public.profiles where id = r.account_id)
      || ' picked ' || public.nn_long_date(p_date) || ' for ' || v_dog || '. It''s booked in.', '/requests/' || r.id);
  perform public.nn_chat_post(r.account_id, 'Picked ' || public.nn_long_date(p_date) || ' for ' || v_dog || '. Booked in. /requests/' || r.id,
    'request', public.nn_request_card(r.id, 'picked'));
  return jsonb_build_object('id', r.id, 'status', r.status, 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_request_pick_offer(uuid, date) from public, anon;
grant execute on function public.nn_request_pick_offer(uuid, date) to authenticated;

create or replace function public.nn_request_withdraw(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.session_requests; v_dog text; v_notices uuid[];
begin
  select * into r from public.session_requests where id = p_id for update;
  if r.id is null or r.account_id is distinct from auth.uid() then raise exception 'Request not found.'; end if;
  if r.status not in ('pending','offered') then raise exception 'That request has already been decided.'; end if;
  update public.session_requests set status = 'withdrawn', updated_at = now() where id = p_id;
  select name into v_dog from public.dogs where id = r.dog_id;
  v_notices := public.nn_notice_trainers('↩️ ' || v_dog || ': request withdrawn',
    'The owner withdrew their request for ' || public.nn_request_words(r) || '.', '/requests');
  perform public.nn_chat_post(r.account_id, 'Withdrew the request for ' || public.nn_request_words(r) || '.',
    'request', public.nn_request_card(r.id, 'withdrawn'));
  return jsonb_build_object('id', r.id, 'status', 'withdrawn', 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_request_withdraw(uuid) from public, anon;
grant execute on function public.nn_request_withdraw(uuid) to authenticated;

-- Homework with a note or a video: a "homework_day" card (the video stays the attachment).
create or replace function public.nn_homework_complete_day(
  p_card_id uuid,
  p_title text default null,
  p_note text default null,
  p_video_path text default null,
  p_video_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.report_cards;
  v_dog public.dogs;
  v_today date := public.nn_uk_today();
  v_days int;
  v_day_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_video text := nullif(btrim(coalesce(p_video_path, '')), '');
  v_title text := left(coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'your homework'), 120);
  v_conv uuid;
  v_msg_id uuid;
  v_at timestamptz := now();
  v_owner text;
  v_notices uuid[] := '{}';
  v_body text;
begin
  if v_uid is null then raise exception 'Please sign in again.'; end if;
  select * into c from public.report_cards where id = p_card_id and status = 'published';
  if c.id is null then raise exception 'That homework isn''t available.'; end if;
  select * into v_dog from public.dogs where id = c.dog_id and account_id = v_uid;
  if v_dog.id is null then raise exception 'That homework isn''t available.'; end if;
  if v_note is not null and length(v_note) > 2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  -- Their own upload in the homework videos bucket.
  if v_video is not null and (v_video not like v_uid::text || '/%' or position('..' in v_video) > 0 or length(v_video) > 300
     or not exists (select 1 from storage.objects o where o.bucket_id = 'homework-videos' and o.name = v_video)) then
    raise exception 'Couldn''t attach that video. Please try again.';
  end if;

  -- One card at a time, so two quick taps can't both count.
  perform 1 from public.report_cards where id = c.id for update;
  if exists (select 1 from public.homework_days where report_card_id = c.id and practised_on = v_today) then
    raise exception 'Already done today — come back tomorrow.';
  end if;
  select count(*) into v_days from public.homework_days where report_card_id = c.id;
  if v_days >= 3 then raise exception 'This homework is already complete.'; end if;

  insert into public.homework_days (report_card_id, dog_id, practised_on, completed_by, note, video_path, video_type)
  values (c.id, v_dog.id, v_today, v_uid, v_note, v_video, case when v_video is null then null else 'video' end)
  returning id into v_day_id;
  -- And a row per drill, as the website's progress counts it (the guard sees today's row and lets them in).
  insert into public.homework_completions (dog_id, report_card_item_id, completed_by, practised_on)
  select v_dog.id, i.id, v_uid, v_today from public.report_card_items i where i.report_card_id = c.id
  on conflict (report_card_item_id, practised_on) do nothing;
  v_days := v_days + 1;

  -- A note or a video goes to the trainers in the owner's chat, so they can reply there.
  if v_note is not null or v_video is not null then
    insert into public.conversations (account_id, last_message_at) values (v_uid, v_at) on conflict (account_id) do nothing;
    select id into v_conv from public.conversations where account_id = v_uid;
    v_body := 'Homework: ' || v_title || ', day ' || v_days || ' of 3' || case when v_note is null then '' else E'\n\n' || v_note end;
    -- As nn_chat_send sends an owner's message, with the video from its own bucket.
    insert into public.messages (conversation_id, sender_id, sender_is_staff, sender_name, body, attachment_path, attachment_type, attachment_name,
                                 kind, meta)
    values (v_conv, v_uid, false, null, left(v_body, 5000),
            case when v_video is null then null else 'homework-videos/' || v_video end,
            case when v_video is null then null else 'video' end,
            case when v_video is null then null else left(coalesce(nullif(p_video_name, ''), 'Homework video.mp4'), 200) end,
            'homework_day',
            jsonb_build_object('card_id', c.id, 'title', v_title, 'day', v_days, 'of', 3, 'note', v_note,
                               'video', v_video is not null, 'dog', v_dog.name, 'dog_id', v_dog.id, 'date', v_today))
    returning id into v_msg_id;
    update public.conversations
    set last_message_at = v_at, completed_at = null, completed_by = null, member_last_read_at = v_at, member_last_active_at = v_at
    where id = v_conv;
    update public.homework_days set message_id = v_msg_id where id = v_day_id;

    select nullif(btrim(owner_name), '') into v_owner from public.profiles where id = v_uid;
    v_notices := public.nn_notice_trainers(
      left('🐾 Homework from ' || coalesce(v_owner, v_dog.name || '''s owner'), 120),
      left(v_dog.name || ': ' || v_title || ', day ' || v_days || ' of 3.'
           || case when v_video is not null then ' They sent a video.' else '' end
           || case when v_note is not null then ' "' || left(v_note, 140) || case when length(v_note) > 140 then '…' else '' end || '"' else '' end, 2000),
      '/conversation/' || v_conv::text
    );
  end if;

  return jsonb_build_object('dayId', v_day_id, 'day', v_days, 'complete', v_days >= 3, 'date', v_today,
                            'messageId', v_msg_id, 'notices', to_jsonb(v_notices));
end;
$$;
revoke execute on function public.nn_homework_complete_day(uuid, text, text, text, text) from public, anon;
grant execute on function public.nn_homework_complete_day(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: a published report card, as a card in the owner's chat. Called by
-- app/api/reports/publish after each card goes out. Once per card; it
-- doesn't reopen a conversation that's marked done.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_report_card(p_card_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.report_cards;
  v_dog public.dogs;
  v_title text;
  v_items int;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into c from public.report_cards where id = p_card_id and status = 'published';
  if c.id is null then return null; end if;
  select * into v_dog from public.dogs where id = c.dog_id;
  if v_dog.account_id is null then return null; end if;
  if exists (select 1 from public.messages m join public.conversations cv on cv.id = m.conversation_id
             where cv.account_id = v_dog.account_id and m.kind = 'report_card' and m.meta ->> 'card_id' = c.id::text) then
    return null;
  end if;
  select count(*) into v_items from public.report_card_items where report_card_id = c.id;
  v_title := left(coalesce(nullif(btrim(coalesce(c.title, '')), ''), 'Training session'), 120);
  return public.nn_chat_post(
    v_dog.account_id,
    'New report card for ' || v_dog.name || ': ' || v_title
      || coalesce(', ' || public.nn_long_date(c.session_date), '') || '.'
      || case when v_items > 0 then ' Your homework is ready to practise.' else '' end,
    'report_card',
    jsonb_build_object('card_id', c.id, 'dog', v_dog.name, 'dog_id', v_dog.id, 'date', c.session_date,
                       'title', v_title, 'homework', v_items),
    false);
end; $$;
revoke execute on function public.nn_chat_report_card(uuid) from public, anon;
grant execute on function public.nn_chat_report_card(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Quick replies: each trainer's own chips above the composer. No row = the
-- app's and website's defaults. "{day}" is filled with the day of the
-- owner's next session ("soon" when there isn't one).
-- ---------------------------------------------------------------------------
create table if not exists public.chat_quick_replies (
  trainer_id uuid primary key references public.profiles (id) on delete cascade,
  replies text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint chat_quick_replies_size check (cardinality(replies) <= 12)
);
alter table public.chat_quick_replies enable row level security;
-- Read only: changes go through nn_chat_set_quick_replies.
revoke all on public.chat_quick_replies from anon, authenticated;
grant select on public.chat_quick_replies to authenticated;
drop policy if exists "chat_quick_replies: own" on public.chat_quick_replies;
create policy "chat_quick_replies: own" on public.chat_quick_replies
  for select to authenticated using (trainer_id = auth.uid());

-- Your list, or null for the defaults.
create or replace function public.nn_chat_quick_replies()
returns text[] language sql stable security definer set search_path = public as $$
  select replies from public.chat_quick_replies where trainer_id = auth.uid() and public.nn_is_admin();
$$;
revoke execute on function public.nn_chat_quick_replies() from public, anon;
grant execute on function public.nn_chat_quick_replies() to authenticated;

-- Save your list (trimmed, blanks and repeats dropped, up to 12 of up to
-- 200 characters). Null goes back to the defaults.
create or replace function public.nn_chat_set_quick_replies(p_replies text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v_clean text[];
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  if p_replies is null then
    delete from public.chat_quick_replies where trainer_id = auth.uid();
    return null;
  end if;
  select coalesce(array_agg(t order by first_at), '{}') into v_clean
  from (
    select t, min(ord) as first_at
    from unnest(p_replies) with ordinality as x(raw, ord), lateral (select btrim(raw) as t) y
    where t is not null and t <> ''
    group by t
  ) s;
  if cardinality(v_clean) > 12 then raise exception 'Keep it to 12 quick replies.'; end if;
  if exists (select 1 from unnest(v_clean) t where length(t) > 200) then
    raise exception 'Keep each quick reply under 200 characters.';
  end if;
  insert into public.chat_quick_replies (trainer_id, replies, updated_at)
  values (auth.uid(), v_clean, now())
  on conflict (trainer_id) do update set replies = excluded.replies, updated_at = excluded.updated_at;
  return v_clean;
end; $$;
revoke execute on function public.nn_chat_set_quick_replies(text[]) from public, anon;
grant execute on function public.nn_chat_set_quick_replies(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer (or the owner themselves): the date of the owner's next session
-- after today, in the next six weeks — a regular day not skipped, or a
-- one-off. Null when there isn't one.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_next_session(p_account uuid)
returns date language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.nn_today(); v_next date;
begin
  if p_account is null or (p_account is distinct from auth.uid() and not public.nn_is_admin()) then return null; end if;
  select min(d) into v_next from (
    select b.on_date as d from public.bookings b
    where b.account_id = p_account and b.cancelled_at is null and b.on_date > v_today and b.on_date <= v_today + 42
    union all
    select g::date from public.placements pl, generate_series(v_today + 1, v_today + 42, interval '1 day') g
    where pl.account_id = p_account and public.nn_placement_on(pl.id, g::date)
      and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = g::date)
  ) x;
  return v_next;
end; $$;
revoke execute on function public.nn_chat_next_session(uuid) from public, anon;
grant execute on function public.nn_chat_next_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer inbox: how many of the owner's messages the team hasn't read, per
-- conversation (only those with any). The Chat tab's badge counts the rows.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_unread_counts()
returns table (conversation_id uuid, unread integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  return query
  select c.id, count(m.id)::int
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where not m.sender_is_staff
    and m.created_at > coalesce(c.staff_last_read_at, 'epoch'::timestamptz)
  group by c.id;
end; $$;
revoke execute on function public.nn_chat_unread_counts() from public, anon;
grant execute on function public.nn_chat_unread_counts() to authenticated;

commit;

select case when n = 7 then 'Done: all 7 changes in place' else 'Only ' || n || ' of 7 in place — send Claude a screenshot' end as result from (
  select (to_regclass('public.route_stops') is not null)::int
       + (exists (select 1 from pg_proc where proname='nn_homework_complete_day'))::int
       + (not exists (select 1 from pg_policies where tablename='dogs' and policyname='dogs: read all (community)'))::int
       + (to_regclass('public.attendance') is not null)::int
       + (exists (select 1 from pg_proc where proname='nn_trainer_book_meet_greet'))::int
       + (exists (select 1 from storage.buckets where id='day-photos'))::int
       + (exists (select 1 from information_schema.columns where table_name='messages' and column_name='kind'))::int as n
) x;
