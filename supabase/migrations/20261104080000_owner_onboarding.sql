-- ============================================================================
-- Nelly & Nova — the owner's onboarding in the app (applied 4 Nov 2026)
-- ============================================================================
-- Like the Kanvas Academy app taking a family from free trial to a
-- registered dancer, the app now takes an owner from their meet & greet
-- request to a registered dog without leaving it:
--
--   nn_my_onboarding()
--     The signed-in owner's checklist: their request (requested → meet &
--     greet booked → onboarding), their Direct Debit, their dogs and whether
--     each is registered (consent & waiver signed), and the training day
--     once the trainer sets it. auth.uid() only: nobody can ask about
--     anyone else.
--     On the way it ties to the account any open request sent with the
--     account's own, confirmed email address (the same thing the
--     nn_link_enquiries trigger does for a brand new account, for requests
--     made after the account), and moves that request's Direct Debit set-up
--     onto the account as nn_onboarding_claim does. A request already tied
--     to another account is never touched.
--
--   nn_waiver_notify_trainers(dog)
--     After an owner signs a dog's consent & waiver (app or website): a
--     notification for every trainer ("📝 Bella is registered"), once per
--     signed form, returned as ids for app/api/sessions/push to push.
--     Only for the caller's own dog, and only a form signed in the last hour.
--
-- Additive and safe to run again.
-- ============================================================================

-- Which signed forms the trainers have been told about.
alter table public.waivers add column if not exists trainers_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- The owner's own onboarding.
-- ---------------------------------------------------------------------------
create or replace function public.nn_my_onboarding()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  e public.enquiries;
  m public.payment_mandates;
  v_dogs jsonb;
begin
  if v_uid is null then return null; end if;

  -- Requests sent with this account's confirmed email, not yet tied to anyone.
  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null and coalesce(u.email, '') <> '';
  if v_email is not null then
    update public.enquiries
    set account_id = v_uid, updated_at = now()
    where account_id is null and lower(email) = v_email and status <> 'closed';
  end if;
  -- Their requests' Direct Debit set-ups follow them onto the account.
  update public.payment_mandates pm
  set account_id = v_uid, updated_at = now()
  where pm.account_id is null
    and pm.enquiry_id in (select x.id from public.enquiries x where x.account_id = v_uid);

  -- The request being onboarded, else the latest open meet & greet request.
  select * into e
  from public.enquiries x
  where x.account_id = v_uid and x.status <> 'closed' and (x.kind = 'booking' or x.status = 'onboarding')
  order by (x.status = 'onboarding') desc, x.created_at desc
  limit 1;

  if e.id is not null then
    select * into m from public.payment_mandates pm
    where pm.enquiry_id = e.id or pm.account_id = v_uid
    order by pm.created_at desc limit 1;
  else
    select * into m from public.payment_mandates pm
    where pm.account_id = v_uid
    order by pm.created_at desc limit 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'registered', d.waiver_signed_at is not null)
                            order by d.sort_order, d.created_at), '[]'::jsonb)
  into v_dogs from public.dogs d where d.account_id = v_uid;

  return jsonb_build_object(
    'enquiry', case when e.id is null then null else jsonb_build_object(
      'id', e.id,
      'status', e.status,
      'service', e.service,
      'firstName', split_part(coalesce(e.name, ''), ' ', 1),
      'name', e.name,
      'email', e.email,
      'dogNames', e.dog_names,
      'meetGreetAt', e.meet_greet_at,
      'meetGreetNotes', e.meet_greet_notes,
      'onboardingStarted', e.onboarding_token is not null,
      'trainingDay', e.training_day,
      'trainingCadence', e.training_cadence,
      'firstSessionOn', e.first_session_on
    ) end,
    'directDebit', coalesce(m.status, 'none'),
    'billingRequestId', m.billing_request_id,
    'dogs', v_dogs
  );
end;
$$;
revoke execute on function public.nn_my_onboarding() from public, anon;
grant execute on function public.nn_my_onboarding() to authenticated;

-- ---------------------------------------------------------------------------
-- Tell the trainers a dog has been registered.
-- ---------------------------------------------------------------------------
create or replace function public.nn_waiver_notify_trainers(p_dog_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.dogs;
  w public.waivers;
  v_owner text;
begin
  if auth.uid() is null or p_dog_id is null then return '{}'; end if;
  select * into d from public.dogs where id = p_dog_id and account_id = auth.uid();
  if d.id is null then return '{}'; end if;

  select * into w from public.waivers
  where dog_id = d.id and account_id = auth.uid()
  order by signed_at desc limit 1
  for update;
  if w.id is null or w.trainers_notified_at is not null or w.signed_at < now() - interval '1 hour' then
    return '{}';
  end if;
  update public.waivers set trainers_notified_at = now() where id = w.id;

  select nullif(btrim(owner_name), '') into v_owner from public.profiles where id = auth.uid();
  return public.nn_notice_trainers(
    left('📝 ' || d.name || ' is registered', 120),
    coalesce(v_owner, w.signed_name, 'Their owner') || ' has signed ' || d.name || '''s consent & waiver. Their health, vet and emergency details are on their record.',
    '/dog/' || d.id::text
  );
end;
$$;
revoke execute on function public.nn_waiver_notify_trainers(uuid) from public, anon;
grant execute on function public.nn_waiver_notify_trainers(uuid) to authenticated;

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
