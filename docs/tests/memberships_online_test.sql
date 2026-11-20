-- ============================================================================
-- Test: supabase/migrations/20261120000000_memberships_online.sql
-- ============================================================================
-- Paste into Supabase → SQL Editor and Run, after the migration. It makes
-- made-up trainers, owners and dogs, checks the rules, and then ROLLS
-- EVERYTHING BACK: nothing is kept, nobody is notified (pushes only go from
-- the website). "All memberships_online checks passed" means it worked; any
-- failure stops with the reason.
--
-- It plays each person by setting request.jwt.claims, as Supabase does.
-- ============================================================================
begin;

do $$
declare
  v_trainer uuid := gen_random_uuid();
  v_sarah uuid := gen_random_uuid();   -- 1-1, already paid at £120
  v_tom uuid := gen_random_uuid();     -- 1-1, not paid yet
  v_olly uuid := gen_random_uuid();    -- Online only
  v_nina uuid := gen_random_uuid();    -- Online, no check-in
  v_full uuid := gen_random_uuid();    -- Full Day dogs' owner
  v_bella uuid; v_max uuid; v_rex uuid; v_luna uuid;
  v_today date := public.nn_today();
  v_d1 date;          -- the next training day after today
  v_mon date;         -- a training day in a couple of weeks
  v_fri date;
  v_b uuid; v_b2 uuid; v_place uuid; v_card uuid;
  r jsonb; v_n int; v_s text;
  v_item uuid;
  i int;

begin
  -- ---- people -------------------------------------------------------------
  insert into auth.users (id, email) values
    (v_trainer, 'trainer-' || v_trainer || '@example.test'), (v_sarah, 'sarah-' || v_sarah || '@example.test'),
    (v_tom, 'tom-' || v_tom || '@example.test'), (v_olly, 'olly-' || v_olly || '@example.test'),
    (v_nina, 'nina-' || v_nina || '@example.test'), (v_full, 'full-' || v_full || '@example.test');
  insert into public.profiles (id, role, owner_name, email) values
    (v_trainer, 'admin', 'Test Trainer', 'trainer@example.test'), (v_sarah, 'member', 'Sarah Test', 'sarah@example.test'),
    (v_tom, 'member', 'Tom Test', 'tom@example.test'), (v_olly, 'member', 'Olly Test', 'olly@example.test'),
    (v_nina, 'member', 'Nina Test', 'nina@example.test'), (v_full, 'member', 'Full Test', 'full@example.test')
  on conflict (id) do update set role = excluded.role, owner_name = excluded.owner_name;
  insert into public.dogs (account_id, name, waiver_signed_at) values (v_sarah, 'Bella', now()) returning id into v_bella;
  insert into public.dogs (account_id, name, waiver_signed_at) values (v_tom, 'Max', now()) returning id into v_max;
  insert into public.dogs (account_id, name, waiver_signed_at) values (v_olly, 'Rex', now()) returning id into v_rex;
  insert into public.dogs (account_id, name, waiver_signed_at) values (v_nina, 'Luna', now()) returning id into v_luna;
  insert into public.payment_mandates (account_id, billing_request_id, mandate_id, status)
  select a, 'BRQtest' || left(a::text, 8), 'MDtest' || left(a::text, 8), 'active' from unnest(array[v_sarah, v_tom, v_olly, v_nina]) a;

  v_d1 := v_today + 1;
  while public.nn_training_day(v_d1) is null loop v_d1 := v_d1 + 1; end loop;
  -- A training day a couple of weeks on, not v_d1's weekday (the memberships below use that).
  v_mon := v_d1 + 15;
  while public.nn_training_day(v_mon) is null or public.nn_training_day(v_mon) = public.nn_training_day(v_d1) loop v_mon := v_mon + 1; end loop;
  v_fri := public.nn_monday_of(v_mon) + 4;

  -- ---- Monday to Thursday, 5 dogs ------------------------------------------
  assert public.nn_day_capacity() = 5, 'capacity should be 5';
  assert public.nn_training_day(v_fri) is null and public.nn_training_day(v_fri - 1) = 'thursday', 'Mon–Thu only';
  assert public.nn_one_to_one_times() = array['12:00'::time, '13:00'::time], 'two 1-1 slots';
  assert public.nn_clock('13:00') = '1:00pm' and public.nn_clock('12:00') = '12:00pm', 'nn_clock';
  assert public.nn_pounds(3000) = '£30' and public.nn_pounds(3050) = '£30.50', 'nn_pounds';

  begin
    insert into public.bookings (kind, on_date, account_id) values ('full_day', v_fri, v_full);
    raise exception 'a Friday booking should be refused';
  exception when others then
    assert sqlerrm like 'We train Monday to Thursday%', 'Friday booking: ' || sqlerrm;
  end;
  begin
    insert into public.placements (day, start_on, holder_name) values ('friday', v_mon, 'Friday dog');
    raise exception 'a Friday place should be refused';
  exception when others then
    assert sqlerrm like 'We train Monday to Thursday%', 'Friday place: ' || sqlerrm;
  end;

  -- 4 Full Day places on that day: orange. A 1-1 membership that day doesn't count.
  for i in 1..4 loop
    insert into public.placements (day, start_on, account_id, holder_name) values (public.nn_training_day(v_mon), v_mon, v_full, 'Dog ' || i);
  end loop;
  insert into public.placements (service, day, start_on, start_time, account_id, holder_name)
  values ('one_to_one', public.nn_training_day(v_mon), v_mon, '12:00', v_full, '1-1 dog');
  perform set_config('request.jwt.claims', json_build_object('sub', v_full, 'role', 'authenticated')::text, true);
  select status into v_s from public.nn_day_availability(v_mon, v_mon);
  assert v_s = 'orange', '4 of 5 should be orange, got ' || coalesce(v_s, 'null');
  insert into public.bookings (kind, on_date, account_id) values ('full_day', v_mon, v_full);
  select status into v_s from public.nn_day_availability(v_mon, v_mon);
  assert v_s = 'full', '5 of 5 should be full, got ' || coalesce(v_s, 'null');
  select status into v_s from public.nn_day_availability(v_fri, v_fri);
  assert v_s = 'full', 'a Friday shows as full';

  -- ---- 1-1 slots -----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_sarah, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.nn_one_to_one_slots(v_mon, v_mon);
  assert v_n = 1, 'the 12:00 slot is a membership''s, so one left, got ' || v_n;
  r := public.nn_one_to_one_book(v_bella, v_mon, '13:00', 'Recall please');
  assert (r ->> 'amountPence')::int = 12000, 'no membership yet: £120';
  assert jsonb_array_length(r -> 'notices') >= 1, 'trainers told';
  select count(*) into v_n from public.nn_one_to_one_slots(v_mon, v_mon);
  assert v_n = 0, 'both slots gone';
  begin
    perform public.nn_one_to_one_book(v_bella, v_mon, '13:00');
    raise exception 'a taken slot should be refused';
  exception when others then
    assert sqlerrm like 'Sorry, that slot has just gone%', 'taken slot: ' || sqlerrm;
  end;
  begin
    perform public.nn_one_to_one_book(v_bella, v_mon, '10:00');
    raise exception 'a time that isn''t a slot should be refused';
  exception when others then
    assert sqlerrm like 'Pick 12 to 1pm%', 'bad time: ' || sqlerrm;
  end;
  begin
    perform public.nn_one_to_one_book(v_max, v_mon + 1, '12:00');
    raise exception 'someone else''s dog should be refused';
  exception when others then
    assert sqlerrm like 'That dog isn''t on your account%', 'other dog: ' || sqlerrm;
  end;
  -- Anyone (anon) can see free slots; only date and time come back.
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from public.nn_one_to_one_slots(null, null);
  assert v_n > 0, 'free slots for the next 6 weeks';

  -- ---- Start 1-1 membership: already paid at £120 → £30 owed -----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer, 'role', 'authenticated')::text, true);
  insert into public.bookings (kind, on_date, start_time, account_id, dog_id, payment_status, amount_pence, gc_payment_id)
  values ('one_to_one', v_d1, '12:00', v_sarah, v_bella, 'paid', 12000, 'PMTEST' || upper(left(replace(v_sarah::text, '-', ''), 10)))
  returning id into v_b;
  r := public.nn_membership_start_one_to_one(v_bella, public.nn_training_day(v_d1), 'weekly', '12:00', v_d1, v_b, 60);
  v_place := (r ->> 'placementId')::uuid;
  assert (r ->> 'refundPence')::int = 3000, '£30 refund owed, got ' || (r ->> 'refundPence');
  assert exists (select 1 from public.refunds_owed where booking_id = v_b and amount_pence = 3000 and done_at is null), 'refund to-do';
  assert exists (select 1 from public.bookings where id = v_b and placement_id = v_place and membership_on = v_d1), 'today''s 1-1 is the first membership session';
  assert exists (select 1 from public.notifications where recipient_id = v_sarah and title = '🎉 Welcome to 1-1 membership!'
                   and body = 'Your sessions are now £90, and we''ll refund the £30 difference from today.'), 'welcome notification';
  assert exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                 where c.account_id = v_sarah and m.kind = 'membership'), 'membership chat card';
  -- Next week's session is a £90 1-1 on the calendar; the slot is taken.
  assert exists (select 1 from public.nn_trainer_calendar(v_d1 + 7, v_d1 + 7) c where c.kind = 'one_to_one' and c.dog_id = v_bella and c.start_time = '12:00'),
    'membership 1-1 on the calendar';
  assert exists (select 1 from public.bookings where placement_id = v_place and on_date = v_d1 + 7 and amount_pence = 9000 and payment_status = 'unpaid'),
    'membership session at £90';
  assert not exists (select 1 from public.nn_one_to_one_slots(v_d1 + 7, v_d1 + 7) s where s.start_time = '12:00'), 'membership takes its slot';
  -- Viewing the calendar again doesn't double up.
  perform public.nn_trainer_calendar(v_d1, v_d1 + 28);
  select count(*) into v_n from public.bookings where placement_id = v_place and on_date = v_d1 + 7;
  assert v_n = 1, 'one booking per membership date';
  assert not exists (select 1 from public.nn_day_counts(v_d1 + 7, v_d1 + 7) c where c.dogs > 0), '1-1s don''t count toward the 5';
  -- Any membership gets the 1-1 member price; Full Day needs a Full Day membership.
  assert public.nn_has_membership(v_sarah, 'one_to_one'), '1-1 member: £90 1-1s';
  assert not public.nn_has_membership(v_sarah, 'full_day'), '1-1 member: no Full Day member price';
  assert not public.nn_has_membership(v_sarah), 'the old one-argument check is Full Day';
  begin
    perform public.nn_membership_start_one_to_one(v_bella, 'tuesday', 'weekly', '13:00', v_d1);
    raise exception 'a second 1-1 membership should be refused';
  exception when others then
    assert sqlerrm like '%already has a 1-1 membership%', 'second membership: ' || sqlerrm;
  end;

  -- ---- Start 1-1 membership: not paid → £90 ------------------------------------
  insert into public.bookings (kind, on_date, start_time, account_id, dog_id, payment_status)
  values ('one_to_one', v_d1, '13:00', v_tom, v_max, 'unpaid') returning id into v_b2;
  r := public.nn_membership_start_one_to_one(v_max, public.nn_training_day(v_d1), 'alternating', '13:00', v_d1, v_b2);
  assert (r ->> 'refundPence')::int = 0, 'nothing to refund';
  assert exists (select 1 from public.bookings where id = v_b2 and amount_pence = 9000 and payment_status = 'unpaid'), 'today''s 1-1 now £90';
  assert exists (select 1 from public.notifications where recipient_id = v_tom and body = 'Your sessions are now £90, starting with today''s.'), 'unpaid wording';
  -- Every other week: nothing a week later, a session a fortnight later.
  perform public.nn_trainer_calendar(v_d1, v_d1 + 21);
  assert not exists (select 1 from public.bookings where placement_id = (r ->> 'placementId')::uuid and on_date = v_d1 + 7), 'alternating: not next week';
  assert exists (select 1 from public.bookings where placement_id = (r ->> 'placementId')::uuid and on_date = v_d1 + 14), 'alternating: the week after';
  -- That slot's taken too, so Bella can't be moved onto it.
  begin
    perform public.nn_membership_start_one_to_one(v_rex, public.nn_training_day(v_d1), 'weekly', '13:00', v_d1 + 14);
    raise exception 'a taken slot should be refused for a membership';
  exception when others then
    assert sqlerrm like 'The 1:00pm slot is taken%', 'membership slot: ' || sqlerrm;
  end;

  -- An owner cancels next week's membership 1-1: it's off, and its slot is free.
  perform set_config('request.jwt.claims', json_build_object('sub', v_sarah, 'role', 'authenticated')::text, true);
  r := public.nn_session_cancel(v_bella, v_d1 + 7, v_d1 + 7, 'Away');
  assert exists (select 1 from public.bookings where placement_id = v_place and on_date = v_d1 + 7 and cancelled_at is not null), 'cancelled';
  assert exists (select 1 from public.nn_one_to_one_slots(v_d1 + 7, v_d1 + 7) s where s.start_time = '12:00'), 'cancelled slot is free again';
  -- The owner's own view shows their membership sessions.
  assert exists (select 1 from public.nn_dog_sessions(v_bella, v_d1, v_d1 + 21) s where s.kind = 'one_to_one' and s.on_date = v_d1 + 14), 'owner sees membership 1-1s';
  r := public.nn_my_memberships();
  assert r -> 'memberships' -> 0 ->> 'service' = 'one_to_one', 'my memberships';

  -- Ending it: later uncharged sessions go.
  perform set_config('request.jwt.claims', json_build_object('sub', v_trainer, 'role', 'authenticated')::text, true);
  perform public.nn_trainer_calendar(v_d1, v_d1 + 35);
  r := public.nn_membership_end(v_place, v_d1 + 14);
  assert not exists (select 1 from public.bookings where placement_id = v_place and on_date > v_d1 + 14 and cancelled_at is null), 'ended';
  assert exists (select 1 from public.bookings where id = v_b), 'the paid session stays';

  -- ---- Online ----------------------------------------------------------------
  r := public.nn_membership_start_online(v_rex, v_today, array['Loose lead', ' Calm at the door ', '']);
  assert exists (select 1 from public.placements where id = (r ->> 'placementId')::uuid and service = 'online' and day is null
                   and goals = array['Loose lead', 'Calm at the door']), 'online membership with goals';
  perform public.nn_membership_start_online(v_luna, v_today, '{}');
  assert not exists (select 1 from public.nn_trainer_calendar(v_today, v_today + 30) c where c.dog_id in (v_rex, v_luna)), 'online isn''t on the calendar';
  assert public.nn_has_membership(v_olly, 'one_to_one') and not public.nn_has_membership(v_olly, 'full_day'), 'online: £90 1-1s only';

  r := public.nn_online_board();
  assert jsonb_array_length(r -> 'members') >= 2, 'board lists online members';
  assert exists (select 1 from jsonb_array_elements(r -> 'members') m where m ->> 'dogId' = v_rex::text and m -> 'thisWeekCardId' = 'null'::jsonb), 'not sent yet';

  r := public.nn_online_send_week(v_rex,
    '[{"category":"Loose lead","name":"Stop when it goes tight"},{"category":"Door","name":"Wait at the door","note":"5 a day"}]'::jsonb,
    'Little and often.', 'Lovely progress on the lead.');
  v_card := (r ->> 'cardId')::uuid;
  assert exists (select 1 from public.report_cards where id = v_card and kind = 'online_week' and status = 'published'
                   and week_of = public.nn_homework_week() and review = 'Lovely progress on the lead.'), 'online week card';
  assert (select count(*) from public.report_card_items where report_card_id = v_card) = 2, 'two drills';
  assert exists (select 1 from public.notifications where recipient_id = v_olly and title = '📚 Your homework for this week is ready'), 'homework notification';
  begin
    perform public.nn_online_send_week(v_rex, '[{"name":"Again"}]'::jsonb);
    raise exception 'a second card for the same week should be refused';
  exception when others then
    assert sqlerrm like '%has already gone%', 'second week card: ' || sqlerrm;
  end;
  r := public.nn_online_board();
  assert exists (select 1 from jsonb_array_elements(r -> 'members') m where m ->> 'dogId' = v_rex::text and m ->> 'thisWeekCardId' = v_card::text), 'sent';

  -- The owner checks in (no video): a chat card and a notice for the trainers.
  perform set_config('request.jwt.claims', json_build_object('sub', v_olly, 'role', 'authenticated')::text, true);
  select id into v_item from public.report_card_items where report_card_id = v_card order by sort_order limit 1;
  -- The check-in rates this week's homework when it's the same week; else the card above is still the latest.
  r := public.nn_online_checkin_submit(v_rex, jsonb_build_array(jsonb_build_object('item_id', v_item, 'rating', 'great')), 'ok', 'Jumped at the postman', null, null);
  assert exists (select 1 from public.online_checkins where id = (r ->> 'id')::uuid and overall = 'ok' and week_of = public.nn_checkin_week()), 'check-in saved';
  assert exists (select 1 from public.messages where id = (r ->> 'messageId')::uuid and kind = 'checkin' and body like 'Weekly check-in: Rex%'), 'check-in chat card';
  assert exists (select 1 from public.notifications where recipient_id = v_trainer and title = '📝 Weekly check-in: Rex'), 'trainers told';
  begin
    perform public.nn_online_checkin_submit(v_rex, '[]'::jsonb, 'great');
    raise exception 'a second check-in should be refused';
  exception when others then
    assert sqlerrm like 'You''ve already checked in this week%', 'second check-in: ' || sqlerrm;
  end;
  begin
    perform public.nn_online_checkin_submit(v_luna, '[]'::jsonb, 'great');
    raise exception 'someone else''s dog should be refused';
  exception when others then
    assert sqlerrm like 'That dog isn''t on your account%', 'other dog check-in: ' || sqlerrm;
  end;
  r := public.nn_my_memberships();
  assert r -> 'memberships' -> 0 ->> 'service' = 'online' and (r ->> 'upcomingBookings')::int = 0, 'online-only member';

  -- Sunday's reminder: Luna's owner (no check-in), once a week; not Rex's.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  select count(*) into v_n from public.nn_online_checkin_reminders_claim(null) c where c.account_id = v_nina;
  assert v_n = 1, 'Nina is reminded';
  select count(*) into v_n from public.nn_online_checkin_reminders_claim(null) c where c.account_id in (v_nina, v_olly);
  assert v_n = 0, 'once a week, and not after checking in';

  -- Owners can't start memberships or read the refunds.
  perform set_config('request.jwt.claims', json_build_object('sub', v_sarah, 'role', 'authenticated')::text, true);
  begin
    perform public.nn_membership_start_online(v_bella);
    raise exception 'an owner starting a membership should be refused';
  exception when others then
    assert sqlerrm like 'Trainers only%', 'owner start: ' || sqlerrm;
  end;

  raise notice 'All memberships_online checks passed';
end $$;

rollback;
