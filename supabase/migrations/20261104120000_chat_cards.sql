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
