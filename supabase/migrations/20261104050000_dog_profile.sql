-- ============================================================================
-- Nelly & Nova — the owner's dog Profile, session changes and session payments
-- ============================================================================
-- report_cards.strength / to_improve
--   The trainer's "biggest strength" and "biggest area to improve", shown on
--   the owner's Profile tab.
-- placement_skips
--   A date a regular place is off (the owner cancelled it, or the trainer
--   moved it). nn_trainer_calendar and the day counts leave those dates out.
-- Cancelling (nn_session_cancel)
--   Owners cancel straight away, any session up to the day before, one date
--   or a range (a holiday). Nothing is refunded: it just means we don't
--   collect the dog.
-- session_requests
--   What an owner asks for, and the trainer decides:
--     replacement       a day in place of one they cancelled
--     one_off           an extra Full Day, or a 1-1 (morning or afternoon)
--     add_regular       a new regular weekday
--     switch_week       move one session to another date
--     switch_permanent  move their regular day to another weekday
--   pending → (trainer suggests 1–3 dates) offered → confirmed, or declined
--   / withdrawn. Accept, or the owner picking an offer, makes the booking or
--   place (nn_request_apply). The trainer can move a session afterwards
--   (nn_session_move).
-- Capacity
--   6 dogs a day (nn_day_capacity). nn_day_availability gives counts and a
--   colour per date, no names, to anyone signed in.
-- Prompts
--   Every request, cancellation and decision adds a notification row for
--   whoever needs to act (returned as `notices`, which the website pushes:
--   app/api/sessions/push) and a line in the owner's chat.
-- Payments (GoCardless)
--   bookings get payment_status / amount_pence / gc_payment_id / charged_at.
--   A trainer charges a one-off from the app or website (never
--   automatically); the GoCardless webhook marks it paid or failed through
--   nn_gc_payment_event, which also flags failed membership payments
--   (payment_failures).
-- Additive and safe to run again. The older reschedule_requests table hangs
-- off training_sessions, which the schedule no longer uses: left alone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Report cards
-- ---------------------------------------------------------------------------
alter table public.report_cards add column if not exists strength text;
alter table public.report_cards add column if not exists to_improve text;

-- ---------------------------------------------------------------------------
-- Session payments on bookings (one-offs, replacements, extra days, 1-1s).
-- Rows from before this have no status: they aren't tracked.
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists payment_status text;
alter table public.bookings add column if not exists amount_pence integer;
alter table public.bookings add column if not exists gc_payment_id text;
alter table public.bookings add column if not exists charged_at timestamptz;
alter table public.bookings alter column payment_status set default 'unpaid';
alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status is null or payment_status in ('unpaid','pending','paid','failed','waived'));
alter table public.bookings drop constraint if exists bookings_amount_pence_check;
alter table public.bookings add constraint bookings_amount_pence_check check (amount_pence is null or (amount_pence > 0 and amount_pence <= 100000));
create unique index if not exists bookings_gc_payment_idx on public.bookings (gc_payment_id) where gc_payment_id is not null;

-- Failed Direct Debit payments that aren't a session (memberships).
create table if not exists public.payment_failures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.profiles (id) on delete cascade,
  mandate_id text,
  gc_payment_id text,
  action text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists payment_failures_payment_idx on public.payment_failures (gc_payment_id, action);
alter table public.payment_failures enable row level security;
revoke all on public.payment_failures from anon;
drop policy if exists "payment_failures: trainers" on public.payment_failures;
create policy "payment_failures: trainers" on public.payment_failures
  for all to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- The first draft of this file (applied once, never used) had a different
-- session_requests and two functions since renamed: clear them away.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'session_requests' and column_name = 'decided_day')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'session_requests' and column_name = 'offered_dates') then
    drop table public.session_requests cascade;
  end if;
end $$;
drop function if exists public.nn_decide_request(uuid, text, date, text, text);
drop function if exists public.nn_cancel_session(uuid, date, uuid, uuid, date, text);
drop function if exists public.nn_check_session_request() cascade;
drop function if exists public.nn_session_request_notice() cascade;
drop function if exists public.nn_notify_trainers(text, text, text);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.nn_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/London')::date;
$$;

create or replace function public.nn_day_capacity()
returns integer language sql immutable set search_path = public as $$ select 6 $$;

create or replace function public.nn_weekday_of(p_date date)
returns text language sql immutable set search_path = public as $$
  select case when extract(isodow from p_date) between 1 and 5
    then (array['monday','tuesday','wednesday','thursday','friday'])[extract(isodow from p_date)::int] end;
$$;

-- The first date strictly after p_after on p_day.
create or replace function public.nn_next_weekday(p_after date, p_day text)
returns date language sql immutable set search_path = public as $$
  select p_after + 1 + ((array_position(array['monday','tuesday','wednesday','thursday','friday'], p_day)
    - extract(isodow from p_after + 1)::int + 7) % 7);
$$;

create or replace function public.nn_long_date(p_date date)
returns text language sql immutable set search_path = public as $$ select to_char(p_date, 'FMDay FMDD FMMonth') $$;
create or replace function public.nn_short_date(p_date date)
returns text language sql immutable set search_path = public as $$ select to_char(p_date, 'Dy FMDD Mon') $$;

-- ---------------------------------------------------------------------------
-- placement_skips
-- ---------------------------------------------------------------------------
create table if not exists public.placement_skips (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  on_date date not null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (placement_id, on_date)
);
create index if not exists placement_skips_date_idx on public.placement_skips (on_date);
alter table public.placement_skips enable row level security;
revoke all on public.placement_skips from anon;
drop policy if exists "placement_skips: trainers, owners read own" on public.placement_skips;
create policy "placement_skips: trainers, owners read own" on public.placement_skips
  for select to authenticated using (
    public.nn_is_admin()
    or exists (select 1 from public.placements p where p.id = placement_id and p.account_id = auth.uid())
  );
drop policy if exists "placement_skips: trainers write" on public.placement_skips;
create policy "placement_skips: trainers write" on public.placement_skips
  for all to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

-- Does a regular place run on this date (weekday, dates, fortnight; skips aside)?
create or replace function public.nn_placement_on(p_id uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.placements pl
    where pl.id = p_id and pl.day = public.nn_weekday_of(p_date)
      and p_date >= pl.start_on and (pl.end_on is null or p_date <= pl.end_on)
      and (pl.cadence = 'weekly' or ((p_date - pl.start_on) / 7) % 2 = 0)
  );
$$;

-- Dogs in for Full Day Training on each date: regular places (held ones too)
-- minus skips, and one-off Full Days. 1-1s and meet & greets don't count.
create or replace function public.nn_day_counts(p_from date, p_to date)
returns table (on_date date, dogs integer)
language sql stable security definer set search_path = public as $$
  with days as (
    select d::date as dt, public.nn_weekday_of(d::date) as dname from generate_series(p_from, p_to, interval '1 day') d
  )
  select days.dt,
    ((select count(*) from public.placements pl
      where pl.day = days.dname and days.dt >= pl.start_on and (pl.end_on is null or days.dt <= pl.end_on)
        and (pl.cadence = 'weekly' or ((days.dt - pl.start_on) / 7) % 2 = 0)
        and not exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = days.dt))
     + (select count(*) from public.bookings b where b.on_date = days.dt and b.kind = 'full_day' and b.cancelled_at is null))::int
  from days where days.dname is not null;
$$;
revoke execute on function public.nn_day_counts(date, date) from public, anon, authenticated;

-- Anyone signed in: how full each weekday is. No names.
create or replace function public.nn_day_availability(p_from date, p_to date)
returns table (on_date date, dogs integer, capacity integer, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Bad range.'; end if;
  return query
  select c.on_date, c.dogs, public.nn_day_capacity(),
    case when c.dogs >= public.nn_day_capacity() then 'full' when c.dogs = public.nn_day_capacity() - 1 then 'orange' else 'green' end
  from public.nn_day_counts(p_from, p_to) c order by 1;
end; $$;
revoke execute on function public.nn_day_availability(date, date) from public, anon;
grant execute on function public.nn_day_availability(date, date) to authenticated;

create or replace function public.nn_day_full(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select dogs >= public.nn_day_capacity() from public.nn_day_counts(p_date, p_date)), false);
$$;
revoke execute on function public.nn_day_full(date) from public, anon, authenticated;

-- Has a Full Day membership: a current place and a Direct Debit in place
-- (the member price for one-offs). The owner themselves, or a trainer.
create or replace function public.nn_has_membership(p_account_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_account_id is distinct from auth.uid() and not public.nn_is_admin() then return false; end if;
  return exists (select 1 from public.placements p where p.account_id = p_account_id and (p.end_on is null or p.end_on >= public.nn_today()))
     and exists (select 1 from public.payment_mandates m where m.account_id = p_account_id and m.status in ('pending_submission','submitted','active'));
end; $$;
revoke execute on function public.nn_has_membership(uuid) from public, anon;
grant execute on function public.nn_has_membership(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prompts: notification rows (pushed by the website) and chat lines
-- ---------------------------------------------------------------------------
-- Each notification is pushed once (app/api/sessions/push).
create table if not exists public.notification_pushes (
  notification_id uuid primary key references public.notifications (id) on delete cascade,
  pushed_at timestamptz not null default now()
);
alter table public.notification_pushes enable row level security;
revoke all on public.notification_pushes from anon, authenticated;

create or replace function public.nn_notice(p_recipient uuid, p_title text, p_body text, p_href text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_recipient is null then return null; end if;
  insert into public.notifications (recipient_id, kind, title, body, action_href, sent_by, sent_by_name)
  values (p_recipient, 'info', left(p_title, 120), left(p_body, 2000), p_href, auth.uid(),
          coalesce((select nullif(btrim(owner_name), '') from public.profiles where id = auth.uid() and not public.nn_is_admin()), 'Nelly & Nova'))
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.nn_notice(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.nn_notice_trainers(p_title text, p_body text, p_href text default '/requests')
returns uuid[] language plpgsql security definer set search_path = public as $$
declare v_ids uuid[] := '{}'; v_id uuid; v_trainer uuid;
begin
  for v_trainer in select id from public.profiles where role = 'admin' loop
    v_id := public.nn_notice(v_trainer, p_title, p_body, p_href);
    v_ids := v_ids || v_id;
  end loop;
  return v_ids;
end; $$;
revoke execute on function public.nn_notice_trainers(text, text, text) from public, anon, authenticated;

-- A line in the owner's chat, from whoever is acting (the owner, or a trainer as staff).
create or replace function public.nn_request_chat(p_account uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_staff boolean := public.nn_is_admin(); v_name text; v_at timestamptz := now();
begin
  if p_account is null then return; end if;
  insert into public.conversations (account_id, last_message_at) values (p_account, v_at) on conflict (account_id) do nothing;
  select id into v_conv from public.conversations where account_id = p_account;
  if v_staff then select nullif(btrim(owner_name), '') into v_name from public.profiles where id = auth.uid(); end if;
  insert into public.messages (conversation_id, sender_id, sender_is_staff, sender_name, body)
  values (v_conv, auth.uid(), v_staff, v_name, left(p_body, 5000));
  if v_staff then
    update public.conversations set last_message_at = v_at, completed_at = null, completed_by = null, staff_last_read_at = v_at where id = v_conv;
  else
    update public.conversations set last_message_at = v_at, completed_at = null, completed_by = null, member_last_read_at = v_at, member_last_active_at = v_at where id = v_conv;
  end if;
exception when others then
  -- The chat is a nicety: never let it stop the change itself.
  raise warning 'nn_request_chat: %', sqlerrm;
end; $$;
revoke execute on function public.nn_request_chat(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- session_requests
-- ---------------------------------------------------------------------------
create table if not exists public.session_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('replacement','one_off','add_regular','switch_week','switch_permanent')),
  account_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  -- switch_*: the place being moved. replacement: the place the cancelled date was on.
  placement_id uuid references public.placements (id) on delete set null,
  -- replacement for a cancelled one-off.
  booking_id uuid references public.bookings (id) on delete set null,
  -- replacement: the cancelled date. switch_week: the session being moved.
  from_date date,
  service text not null default 'full_day' check (service in ('full_day','one_to_one')),
  part_of_day text check (part_of_day in ('morning','afternoon')),
  cadence text not null default 'weekly' check (cadence in ('weekly','alternating')),
  requested_date date,
  requested_day text check (requested_day in ('monday','tuesday','wednesday','thursday','friday')),
  note text check (note is null or length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','offered','confirmed','declined','withdrawn')),
  -- The trainer's suggestions (dates; for a regular day, the weekday of each, from that date).
  offered_dates date[],
  confirmed_date date,
  confirmed_day text check (confirmed_day in ('monday','tuesday','wednesday','thursday','friday')),
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  result_booking_id uuid references public.bookings (id) on delete set null,
  result_placement_id uuid references public.placements (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists session_requests_open_idx on public.session_requests (created_at) where status in ('pending','offered');
create index if not exists session_requests_account_idx on public.session_requests (account_id, created_at desc);
create unique index if not exists session_requests_one_switch_idx on public.session_requests (placement_id)
  where kind = 'switch_permanent' and status in ('pending','offered');

alter table public.session_requests enable row level security;
-- Read only: every change goes through the nn_request_* functions.
revoke all on public.session_requests from anon, authenticated;
grant select on public.session_requests to authenticated;
drop policy if exists "session_requests: trainers, owners read own" on public.session_requests;
create policy "session_requests: trainers, owners read own" on public.session_requests
  for select to authenticated using (public.nn_is_admin() or account_id = auth.uid());

-- What the request is, in words: "an extra Full Day on Monday 9 November".
create or replace function public.nn_request_words(r public.session_requests)
returns text language sql stable security definer set search_path = public as $$
  select case r.kind
    when 'replacement' then 'a replacement day on ' || public.nn_long_date(r.requested_date) || ' (for ' || public.nn_long_date(r.from_date) || ')'
    when 'one_off' then case when r.service = 'one_to_one'
      then 'a 1-1 (' || coalesce(r.part_of_day, 'any time') || ') on ' || public.nn_long_date(r.requested_date)
      else 'an extra Full Day on ' || public.nn_long_date(r.requested_date) end
    when 'add_regular' then 'a regular Full Day on ' || initcap(r.requested_day) || 's' || case when r.cadence = 'alternating' then ' (every other week)' else '' end
    when 'switch_week' then 'to move ' || public.nn_long_date(r.from_date) || ' to ' || public.nn_long_date(r.requested_date)
    else 'to move their regular day to ' || initcap(r.requested_day) || 's'
  end;
$$;
revoke execute on function public.nn_request_words(public.session_requests) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner: cancel a session, or every session from p_from to p_to. Up to the
-- day before; instant; never refunded.
-- ---------------------------------------------------------------------------
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
  perform public.nn_request_chat(v_dog.account_id, 'Cancelled ' || v_dog.name || '''s ' || v_when || '. Sessions aren''t refunded.'
    || coalesce(' Note: ' || v_reason, ''));

  return jsonb_build_object('cancelled', v_n, 'dates', to_jsonb(v_dates), 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_session_cancel(uuid, date, date, text) from public, anon;
grant execute on function public.nn_session_cancel(uuid, date, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner: ask for something.
-- ---------------------------------------------------------------------------
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
  perform public.nn_request_chat(v_dog.account_id,
    'Request for ' || v_dog.name || ': ' || public.nn_request_words(r) || '.' || coalesce(' Note: ' || r.note, '')
    || ' We''ll confirm or suggest another day. /requests/' || r.id);

  return jsonb_build_object('id', r.id, 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_request_create(uuid, text, date, text, text, text, uuid, date, text, text) from public, anon;
grant execute on function public.nn_request_create(uuid, text, date, text, text, text, uuid, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Make what was asked for (or offered and picked). Internal.
-- ---------------------------------------------------------------------------
create or replace function public.nn_request_apply(p_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.session_requests;
  v_place public.placements;
  v_today date := public.nn_today();
  v_date date;
  v_day text;
  v_booking uuid;
  v_new_place uuid;
  v_pay text;
begin
  select * into r from public.session_requests where id = p_id for update;
  if r.kind in ('replacement','one_off','switch_week') then
    v_date := coalesce(p_date, r.requested_date);
    if v_date is null or public.nn_weekday_of(v_date) is null then raise exception 'Pick a weekday.'; end if;
    if v_date < v_today then raise exception 'That date has passed. Suggest another.'; end if;
    v_pay := case
      when r.kind = 'switch_week' then 'waived'
      when r.kind = 'replacement' and r.placement_id is not null then 'waived'
      when r.kind = 'replacement' then coalesce((select case when payment_status in ('paid','pending','waived') then 'waived' end
                                                  from public.bookings where id = r.booking_id), 'unpaid')
      else 'unpaid' end;
    if r.kind = 'switch_week' then
      insert into public.placement_skips (placement_id, on_date, reason) values (r.placement_id, r.from_date, 'Moved to ' || public.nn_short_date(v_date))
        on conflict (placement_id, on_date) do nothing;
    end if;
    insert into public.bookings (kind, on_date, account_id, dog_id, notes, created_by, payment_status)
      values (r.service, v_date, r.account_id, r.dog_id,
              case r.kind
                when 'replacement' then 'Replacement for ' || public.nn_long_date(r.from_date)
                when 'switch_week' then 'Moved from ' || public.nn_long_date(r.from_date)
                else case when r.service = 'one_to_one' then initcap(coalesce(r.part_of_day, '')) || ' 1-1' else 'Extra day' end
              end,
              auth.uid(), v_pay)
      returning id into v_booking;
    update public.session_requests set status = 'confirmed', confirmed_date = v_date, result_booking_id = v_booking, updated_at = now() where id = p_id;
  else
    -- A regular day: from p_date (an offer), else the next one after today.
    v_day := coalesce(public.nn_weekday_of(p_date), r.requested_day);
    if v_day is null then raise exception 'Pick a weekday.'; end if;
    if r.kind = 'add_regular' then
      v_date := coalesce(p_date, public.nn_next_weekday(v_today, v_day));
      insert into public.placements (day, cadence, start_on, account_id, dog_id, created_by)
        values (v_day, r.cadence, v_date, r.account_id, r.dog_id, auth.uid()) returning id into v_new_place;
    else
      select * into v_place from public.placements where id = r.placement_id for update;
      if v_place.id is null then raise exception 'Their regular place has gone.'; end if;
      if v_day = v_place.day then raise exception 'That''s already their day.'; end if;
      if v_place.start_on > v_today then
        v_date := coalesce(p_date, public.nn_next_weekday(v_place.start_on - 1, v_day));
        update public.placements set day = v_day, start_on = v_date where id = v_place.id;
        v_new_place := v_place.id;
      else
        v_date := coalesce(p_date, public.nn_next_weekday(v_today, v_day));
        if v_date <= v_today then raise exception 'Pick a date after today.'; end if;
        if v_place.end_on is not null and v_place.end_on < v_date then raise exception 'Their regular place ends before then.'; end if;
        update public.placements set end_on = v_date - 1 where id = v_place.id;
        insert into public.placements (day, cadence, start_on, end_on, account_id, dog_id, created_by)
          values (v_day, v_place.cadence, v_date, v_place.end_on, v_place.account_id, v_place.dog_id, auth.uid())
          returning id into v_new_place;
      end if;
    end if;
    update public.session_requests set status = 'confirmed', confirmed_day = v_day, confirmed_date = v_date,
      result_placement_id = v_new_place, updated_at = now() where id = p_id;
  end if;
end; $$;
revoke execute on function public.nn_request_apply(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: 'accept', 'suggest' (1–3 dates) or 'decline'.
-- ---------------------------------------------------------------------------
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
  perform public.nn_request_chat(r.account_id, v_body || ' /requests/' || r.id);
  select * into r from public.session_requests where id = p_id;
  return jsonb_build_object('id', r.id, 'status', r.status, 'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_request_decide(uuid, text, date[], text) from public, anon;
grant execute on function public.nn_request_decide(uuid, text, date[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner: take one of the trainer's offers (no further approval), or
-- withdraw while it's pending or offered.
-- ---------------------------------------------------------------------------
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
  perform public.nn_request_chat(r.account_id, 'Picked ' || public.nn_long_date(p_date) || ' for ' || v_dog || '. Booked in. /requests/' || r.id);
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
  perform public.nn_request_chat(r.account_id, 'Withdrew the request for ' || public.nn_request_words(r) || '.');
  return jsonb_build_object('id', r.id, 'status', 'withdrawn', 'notices', to_jsonb(v_notices));
end; $$;
revoke execute on function public.nn_request_withdraw(uuid) from public, anon;
grant execute on function public.nn_request_withdraw(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: move a session to another date (a one-off moves; a regular
-- date gets a skip and a one-off on the new date, part of the membership).
-- ---------------------------------------------------------------------------
create or replace function public.nn_session_move(
  p_dog_id uuid,
  p_from date,
  p_to date,
  p_booking_id uuid default null,
  p_placement_id uuid default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dog public.dogs; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_notice uuid; v_body text;
begin
  if not public.nn_is_admin() then raise exception 'Trainers only.'; end if;
  select * into v_dog from public.dogs where id = p_dog_id;
  if v_dog.id is null then raise exception 'Dog not found.'; end if;
  if p_to is null or public.nn_weekday_of(p_to) is null or p_to < public.nn_today() then raise exception 'Pick a weekday from today on.'; end if;
  if p_booking_id is not null then
    update public.bookings set on_date = p_to where id = p_booking_id and dog_id = p_dog_id and cancelled_at is null;
    if not found then raise exception 'That session isn''t on any more.'; end if;
    update public.session_requests set confirmed_date = p_to, updated_at = now() where result_booking_id = p_booking_id;
  elsif p_placement_id is not null then
    if not public.nn_placement_on(p_placement_id, p_from) then raise exception 'There''s no session on that date.'; end if;
    insert into public.placement_skips (placement_id, on_date, reason) values (p_placement_id, p_from, 'Moved to ' || public.nn_short_date(p_to))
      on conflict (placement_id, on_date) do nothing;
    insert into public.bookings (kind, on_date, account_id, dog_id, notes, created_by, payment_status)
      values ('full_day', p_to, v_dog.account_id, p_dog_id, 'Moved from ' || public.nn_long_date(p_from), auth.uid(), 'waived');
  else
    raise exception 'Which session?';
  end if;
  v_body := 'We''ve moved ' || v_dog.name || '''s session on ' || public.nn_long_date(p_from) || ' to ' || public.nn_long_date(p_to) || '.'
    || coalesce(' ' || v_note, '');
  v_notice := public.nn_notice(v_dog.account_id, '📅 ' || v_dog.name || '''s session has moved', v_body, '/schedule');
  perform public.nn_request_chat(v_dog.account_id, v_body);
  return jsonb_build_object('moved', true, 'notices', to_jsonb(array[v_notice]));
end; $$;
revoke execute on function public.nn_session_move(uuid, date, date, uuid, uuid, text) from public, anon;
grant execute on function public.nn_session_move(uuid, date, date, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily: requests a trainer hasn't answered in 24 hours (the cron pushes them).
-- ---------------------------------------------------------------------------
create or replace function public.nn_request_reminders()
returns uuid[] language plpgsql security definer set search_path = public as $$
declare v_ids uuid[] := '{}'; r record;
begin
  for r in
    select sr.*, d.name as dog_name from public.session_requests sr join public.dogs d on d.id = sr.dog_id
    where sr.status = 'pending' and sr.created_at < now() - interval '24 hours'
      and (sr.reminded_at is null or sr.reminded_at < now() - interval '24 hours')
    for update of sr
  loop
    v_ids := v_ids || public.nn_notice_trainers('⏰ ' || r.dog_name || '''s request is waiting',
      'Asked ' || public.nn_short_date((r.created_at at time zone 'Europe/London')::date) || '. Accept, suggest another day or decline.',
      '/requests/' || r.id);
    update public.session_requests set reminded_at = now() where id = r.id;
  end loop;
  return v_ids;
end; $$;
revoke execute on function public.nn_request_reminders() from public, anon, authenticated;
grant execute on function public.nn_request_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- GoCardless payment events, from the webhook (relay secret, like nn_gc_record).
--   A session's payment → paid / failed. A failed payment on a mandate we
--   hold that isn't a session (a membership) → payment_failures + trainers.
-- ---------------------------------------------------------------------------
create or replace function public.nn_gc_payment_event(p_secret text, p_payment_id text, p_mandate_id text, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_status text;
  v_booking public.bookings;
  v_account uuid;
  v_owner text;
  v_dog text;
  v_notices uuid[] := '{}';
begin
  select value into v_secret from private.settings where key = 'gocardless_relay_secret';
  if v_secret is null or p_secret is distinct from v_secret then raise exception 'Not allowed.'; end if;
  if p_payment_id is null or p_payment_id !~ '^PM[0-9A-Z]{4,30}$' then return jsonb_build_object('kind', 'ignored'); end if;
  v_status := case when p_action in ('confirmed','paid_out') then 'paid'
                   when p_action in ('failed','cancelled','charged_back') then 'failed' end;
  if v_status is null then return jsonb_build_object('kind', 'ignored'); end if;

  select * into v_booking from public.bookings where gc_payment_id = p_payment_id;
  if v_booking.id is not null then
    update public.bookings set payment_status = v_status where id = v_booking.id and payment_status is distinct from v_status;
    if v_status = 'failed' then
      select coalesce(nullif(btrim(owner_name), ''), 'an owner') into v_owner from public.profiles where id = v_booking.account_id;
      select name into v_dog from public.dogs where id = v_booking.dog_id;
      v_notices := public.nn_notice_trainers('💳 Payment failed for ' || v_owner,
        'The Direct Debit for ' || coalesce(v_dog, 'their dog') || '''s session on ' || public.nn_long_date(v_booking.on_date) || ' didn''t go through.',
        '/requests');
    end if;
    return jsonb_build_object('kind', 'booking', 'notices', to_jsonb(v_notices));
  end if;

  if v_status = 'failed' and p_action in ('failed','charged_back') and p_mandate_id is not null then
    select account_id into v_account from public.payment_mandates where mandate_id = p_mandate_id limit 1;
    if v_account is not null then
      insert into public.payment_failures (account_id, mandate_id, gc_payment_id, action)
        values (v_account, p_mandate_id, p_payment_id, p_action) on conflict do nothing;
      if found then
        select coalesce(nullif(btrim(owner_name), ''), 'an owner') into v_owner from public.profiles where id = v_account;
        v_notices := public.nn_notice_trainers('💳 Payment failed for ' || v_owner,
          'Their membership Direct Debit (' || p_payment_id || ') ' || case when p_action = 'charged_back' then 'was charged back.' else 'failed.' end,
          '/requests');
      end if;
      return jsonb_build_object('kind', 'membership', 'notices', to_jsonb(v_notices));
    end if;
  end if;
  return jsonb_build_object('kind', 'ignored');
end; $$;
revoke execute on function public.nn_gc_payment_event(text, text, text, text) from public;
grant execute on function public.nn_gc_payment_event(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- One dog's sessions by date, for its owner (and trainers): regular places
-- (cancelled ones flagged), one-offs and 1-1s, with their payment.
-- ---------------------------------------------------------------------------
drop function if exists public.nn_dog_sessions(uuid, date, date);
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
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.nn_is_admin() or exists (select 1 from public.dogs d where d.id = p_dog_id and d.account_id = auth.uid())) then
    raise exception 'That dog isn''t on your account.';
  end if;
  if p_to < p_from or p_to - p_from > 1200 then raise exception 'Bad range.'; end if;
  return query
  select d::date, 'full_day'::text, null::time, pl.id, null::uuid,
         exists (select 1 from public.placement_skips s where s.placement_id = pl.id and s.on_date = d::date),
         null::text, null::text
  from public.placements pl, generate_series(p_from, p_to, interval '1 day') d
  where pl.dog_id = p_dog_id and public.nn_placement_on(pl.id, d::date)
  union all
  select b.on_date, case when b.kind = 'full_day' then 'full_day_one_off' else 'one_to_one' end, b.start_time, null::uuid, b.id,
         b.cancelled_at is not null, b.notes, b.payment_status
  from public.bookings b
  where b.dog_id = p_dog_id and b.on_date between p_from and p_to
  order by 1, 3 nulls first;
end; $$;
revoke execute on function public.nn_dog_sessions(uuid, date, date) from public, anon;
grant execute on function public.nn_dog_sessions(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- The trainer's calendar, as before, minus cancelled dates.
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
         e.account_id, null::uuid, e.dog_names, null::text, e.name, false, e.name, e.id
  from public.enquiries e
  where e.meet_greet_at is not null and e.status <> 'closed'
    and (e.meet_greet_at at time zone 'Europe/London')::date between p_from and p_to
  order by 1, 2, 3 nulls first, 7;
end; $$;
revoke execute on function public.nn_trainer_calendar(date, date) from public, anon;
grant execute on function public.nn_trainer_calendar(date, date) to authenticated;
