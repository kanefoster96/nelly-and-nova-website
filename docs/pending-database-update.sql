-- Nelly & Nova database update (4 and 20 Nov changes). Paste ALL of this into Supabase → SQL Editor → New query → Run.
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

-- ===== 20261120000000_memberships_online.sql
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

commit;

select case when n = 8 then 'Done: all 8 changes in place' else 'Only ' || n || ' of 8 in place — send Claude a screenshot' end as result from (
  select (to_regclass('public.route_stops') is not null)::int
       + (exists (select 1 from pg_proc where proname='nn_homework_complete_day'))::int
       + (not exists (select 1 from pg_policies where tablename='dogs' and policyname='dogs: read all (community)'))::int
       + (to_regclass('public.attendance') is not null)::int
       + (exists (select 1 from pg_proc where proname='nn_trainer_book_meet_greet'))::int
       + (exists (select 1 from storage.buckets where id='day-photos'))::int
       + (exists (select 1 from information_schema.columns where table_name='messages' and column_name='kind'))::int
       + (exists (select 1 from information_schema.columns where table_name='placements' and column_name='service'))::int as n
) x;
