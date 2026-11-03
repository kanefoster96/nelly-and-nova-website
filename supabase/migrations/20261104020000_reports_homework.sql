-- Report cards, homework, practice drills and the skills tracker, made real.
-- ---------------------------------------------------------------------------
-- The tables (report_cards, report_card_items, library_categories,
-- library_drills, library_drill_blocks, skills, dog_skills,
-- skill_drill_blocks, homework_completions) already exist with RLS. This adds
-- what the website and app flows still need, and seeds the drill library and
-- skills from the old sample configs (config/homeworkLibrary.ts,
-- config/drills.ts, config/skills.ts) when they're empty.
--
-- Idempotent and additive: safe to run again. The one change to an existing
-- object is homework_completions.completed_by, which now cascades when the
-- owner's account is deleted (account deletion was blocked by it).

-- 1. Report cards: "went well" list, and when the owner first saw it ---------
alter table public.report_cards add column if not exists wins text[] not null default '{}';
alter table public.report_cards add column if not exists seen_at timestamptz;

-- Owners can't update report_cards (trainer-only), so "seen" goes through here.
create or replace function public.mark_report_cards_seen(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.report_cards rc
     set seen_at = now()
   where rc.id = any(p_ids)
     and rc.seen_at is null
     and rc.status = 'published'
     and public.owns_dog(rc.dog_id);
$$;
revoke all on function public.mark_report_cards_seen(uuid[]) from public, anon;
grant execute on function public.mark_report_cards_seen(uuid[]) to authenticated;

-- 2. Homework completions: one day per item per calendar day ---------------
alter table public.homework_completions
  add column if not exists practised_on date not null default ((now() at time zone 'Europe/London')::date);
create unique index if not exists homework_completions_item_day_key
  on public.homework_completions (report_card_item_id, practised_on);

-- Completions go with the owner's account (Apple requires account deletion).
do $$
declare c text;
begin
  select con.conname into c
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
   where con.conrelid = 'public.homework_completions'::regclass
     and con.contype = 'f' and a.attname = 'completed_by'
     and con.confdeltype <> 'c'
   limit 1;
  if c is not null then
    execute format('alter table public.homework_completions drop constraint %I', c);
    alter table public.homework_completions
      add constraint homework_completions_completed_by_fkey
      foreign key (completed_by) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Only on a published card for that same dog, inside its 14-day window.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework_completions'
                 and policyname = 'homework_completions: published card in window') then
    create policy "homework_completions: published card in window"
      on public.homework_completions as restrictive for insert to authenticated
      with check (exists (
        select 1
          from public.report_card_items i
          join public.report_cards c on c.id = i.report_card_id
         where i.id = homework_completions.report_card_item_id
           and c.dog_id = homework_completions.dog_id
           and c.status = 'published'
           and coalesce(c.session_date, c.published_at::date, c.created_at::date) + 14 >= homework_completions.practised_on
      ));
  end if;
end $$;

-- 3. Homework resets (a trainer resets completion to 100% after a 1-1) ------
create table if not exists public.homework_resets (
  dog_id uuid primary key references public.dogs(id) on delete cascade,
  reset_at timestamptz not null default now(),
  reset_by uuid references public.profiles(id) on delete set null
);
alter table public.homework_resets enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework_resets'
                 and policyname = 'homework_resets: select own-dog or admin') then
    create policy "homework_resets: select own-dog or admin" on public.homework_resets
      for select to authenticated using (public.owns_dog(dog_id) or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'homework_resets'
                 and policyname = 'homework_resets: admin write') then
    create policy "homework_resets: admin write" on public.homework_resets
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- 4. Questions about homework, on a card (owner and trainers only) ----------
create table if not exists public.report_card_comments (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_role text not null check (author_role in ('owner', 'staff')),
  author_name text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists report_card_comments_card_idx on public.report_card_comments (report_card_id, created_at);
alter table public.report_card_comments enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_card_comments'
                 and policyname = 'report_card_comments: select via card') then
    create policy "report_card_comments: select via card" on public.report_card_comments
      for select to authenticated using (public.can_read_report_card(report_card_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_card_comments'
                 and policyname = 'report_card_comments: insert own via card') then
    create policy "report_card_comments: insert own via card" on public.report_card_comments
      for insert to authenticated with check (
        author_id = auth.uid()
        and public.can_read_report_card(report_card_id)
        and author_role = case when public.is_admin() then 'staff' else 'owner' end
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'report_card_comments'
                 and policyname = 'report_card_comments: delete own or admin') then
    create policy "report_card_comments: delete own or admin" on public.report_card_comments
      for delete to authenticated using (author_id = auth.uid() or public.is_admin());
  end if;
end $$;

-- 5. Photos and videos on drill pages: a public bucket only trainers write --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drill-media', 'drill-media', true, 104857600,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'drill-media: public read') then
    create policy "drill-media: public read" on storage.objects
      for select using (bucket_id = 'drill-media');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'drill-media: admin insert') then
    create policy "drill-media: admin insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'drill-media' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'drill-media: admin update') then
    create policy "drill-media: admin update" on storage.objects
      for update to authenticated using (bucket_id = 'drill-media' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'drill-media: admin delete') then
    create policy "drill-media: admin delete" on storage.objects
      for delete to authenticated using (bucket_id = 'drill-media' and public.is_admin());
  end if;
end $$;

-- 6. Seed the library and skills from the old sample configs, once ---------
-- Categories: the three pillars' templates, plus the report-card picker's
-- older categories (config/drills.ts). Existing rows are left alone.
insert into public.library_categories (pillar, slug, name, sort_order)
select v.pillar, v.slug, v.name, v.sort_order
  from (values
    ('engagement', 'ready', 'Ready', 0),
    ('engagement', 'finish', 'Finish', 1),
    ('engagement', 'yes-marker', 'Yes marker', 2),
    ('skills', 'luring', 'Luring', 0),
    ('skills', 'spatial-pressure', 'Spatial pressure', 1),
    ('skills', 'sit', 'Sit', 2),
    ('mindset', 'settling', 'Settling', 0),
    ('mindset', 'arousal', 'Arousal', 1),
    ('mindset', 'triggers', 'Triggers', 2),
    ('skills', 'heeling', 'Heeling', 10),
    ('skills', 'recall', 'Recall', 11),
    ('skills', 'loose-lead', 'Loose lead', 12),
    ('engagement', 'marker-words', 'Marker words', 13),
    ('mindset', 'settle', 'Settle', 14),
    ('mindset', 'impulse-control', 'Impulse control', 15)
  ) as v(pillar, slug, name, sort_order)
on conflict (pillar, slug) do nothing;

-- Drills (and each one's how-to as a paragraph block), only into an empty library.
do $$
begin
  if exists (select 1 from public.library_drills) then
    return;
  end if;

  with v(pillar, slug, level, sort_order, name, how_to) as (
    values
    ('engagement', 'ready', 1, 0, 'Introduce the ready cue', 'Say “ready?” in a happy voice, then immediately reward. Repeat 10 times so the word predicts good things and switches your dog on.'),
    ('engagement', 'ready', 1, 1, 'Ready before meals', 'Ask “ready?” just before putting the food bowl down. Reward the focus, then release to eat.'),
    ('engagement', 'ready', 2, 2, 'Ready with movement', 'Say “ready?” then take a few steps; reward your dog for coming with you and staying engaged.'),
    ('engagement', 'ready', 2, 3, 'Ready near a distraction', 'Use the ready cue with a low-level distraction nearby; reward them for choosing you.'),
    ('engagement', 'finish', 1, 0, 'Lure to your side', 'Lure your dog around behind you into a sit at your left side. Reward in position. 5 reps.'),
    ('engagement', 'finish', 1, 1, 'Add the word “finish”', 'Say “finish”, then lure into position and reward. Repeat until the word starts the movement.'),
    ('engagement', 'finish', 2, 2, 'Finish without a lure', 'Say “finish” and use just a hand signal; reward the tuck into position.'),
    ('engagement', 'finish', 2, 3, 'Finish from in front', 'With your dog sitting in front of you, cue “finish” so they swing round to your side.'),
    ('engagement', 'yes-marker', 1, 0, 'Charge the marker', 'Say “yes”, then treat — 10 reps, twice a day — so “yes” always means a reward is coming.'),
    ('engagement', 'yes-marker', 1, 1, 'Mark a known behaviour', 'Ask for a sit; the instant they sit, say “yes” and reward.'),
    ('engagement', 'yes-marker', 2, 2, 'Mark then delay', 'Say “yes”, pause 2–3 seconds, then reward — building a gap between the marker and the treat.'),
    ('engagement', 'yes-marker', 2, 3, 'Mark a free choice', 'Catch and mark a good behaviour your dog offers on a walk (a check-in, a sit).'),
    ('skills', 'luring', 1, 0, 'How to hold a treat', 'Hold the treat flat against your fingers with your thumb so your dog can smell it but not snatch it. Keep your hand relaxed and lead their nose.'),
    ('skills', 'luring', 1, 1, 'Lure a sit', 'With the treat at your dog’s nose, slowly raise it up over their head. As their nose goes up, their bottom goes down. Reward the sit.'),
    ('skills', 'luring', 2, 2, 'Lure a down', 'From a sit, lure the treat straight down between their paws, then out along the floor. Reward the down.'),
    ('skills', 'luring', 2, 3, 'Fade the lure', 'Make the same movement with an empty hand and reward from the other hand — the food comes after, not as a bribe.'),
    ('skills', 'spatial-pressure', 1, 0, 'Step in, step out', 'Take a calm step toward your dog to ask them to move back a step, then step away to release the pressure. Reward the movement.'),
    ('skills', 'spatial-pressure', 1, 1, 'Body block a threshold', 'Use your body to calmly block a doorway; reward your dog for waiting rather than barging through.'),
    ('skills', 'spatial-pressure', 2, 2, 'Pressure to position', 'Use a small step of pressure to guide your dog into a sit or back to your side without a lure.'),
    ('skills', 'spatial-pressure', 2, 3, 'Release on a loose lead', 'Use gentle pressure and release on the lead to show your dog where to be; reward the slack.'),
    ('skills', 'sit', 1, 0, 'Capture a sit', 'Wait for your dog to sit on their own; the moment they do, mark and reward. Repeat so sitting earns rewards.'),
    ('skills', 'sit', 1, 1, 'Add the cue', 'Say “sit” just as they begin to sit, then reward — building the word onto the action.'),
    ('skills', 'sit', 2, 2, 'Sit at a distance', 'Ask for a sit from a step or two away; reward them for staying put.'),
    ('skills', 'sit', 2, 3, 'Sit with a distraction', 'Ask for a sit with a mild distraction present; reward the focus.'),
    ('mindset', 'settling', 1, 0, 'Settle on a mat', 'Reward your dog for lying calmly on a mat for a few minutes while you relax. Build the duration up slowly.'),
    ('mindset', 'settling', 1, 1, 'Calm on cue', 'Reward a relaxed down-stay while you make a cup of tea; keep the energy low and quiet.'),
    ('mindset', 'settling', 2, 2, 'Settle in a busy room', 'Practise the mat settle somewhere busier at home; reward calmness.'),
    ('mindset', 'settling', 2, 3, 'Settle out and about', 'Settle at a café or outside a shop for a few minutes; reward staying relaxed.'),
    ('mindset', 'arousal', 1, 0, 'Up and down game', 'Do a few seconds of tug, then ask for a sit to stop. Reward the “off switch” — this teaches your dog to come back down from excitement.'),
    ('mindset', 'arousal', 1, 1, 'Sniffing to settle', 'Scatter a few treats in the grass after play so your dog can sniff and bring their arousal down.'),
    ('mindset', 'arousal', 2, 2, 'Recover faster', 'After a burst of play, ask for calm and reward how quickly they settle.'),
    ('mindset', 'arousal', 2, 3, 'Arousal around dogs', 'At a distance from another dog, reward your dog for staying under threshold and disengaging.'),
    ('mindset', 'triggers', 1, 0, 'Find the distance', 'Work out how far from a trigger your dog can stay calm, and reward relaxed behaviour at that distance.'),
    ('mindset', 'triggers', 1, 1, 'Mark the trigger', 'The moment your dog notices the trigger calmly, mark and reward — so it starts to predict good things.'),
    ('mindset', 'triggers', 2, 2, 'Close the gap slowly', 'Over several sessions, reduce the distance to the trigger a little at a time, keeping your dog calm.'),
    ('mindset', 'triggers', 2, 3, 'Disengage from a trigger', 'Reward your dog for looking away from the trigger and back to you.'),
    ('skills', 'heeling', 1, 0, 'Practise 5 minutes of heelwork on your usual walk, rewarding every few steps while they''re at your side.', null),
    ('skills', 'heeling', 1, 1, 'Do 10 changes of direction, keeping them in the heel position as you turn.', null),
    ('skills', 'heeling', 1, 2, 'Heel past a mild distraction (a bin, a parked car) and reward focus.', null),
    ('skills', 'recall', 1, 0, 'Call them back 3 times in the garden with a happy voice and a high-value treat.', null),
    ('skills', 'recall', 1, 1, 'Recall away from a low-level distraction, then release them back to it as the reward.', null),
    ('skills', 'loose-lead', 1, 0, '10 minutes of loose-lead walking — stop the moment the lead goes tight, reward when it softens.', null),
    ('skills', 'loose-lead', 1, 1, 'Reward every time they choose to walk at your side without being asked.', null),
    ('engagement', 'marker-words', 1, 0, 'Charge your marker: say “yes”, then treat — 10 reps, twice a day.', null),
    ('engagement', 'marker-words', 1, 1, 'Mark and reward one calm behaviour they offer on your walk.', null),
    ('mindset', 'settle', 1, 0, 'Place/settle on a mat for 5 minutes each evening while you relax.', null),
    ('mindset', 'settle', 1, 1, 'Reward a calm down-stay while you make a cup of tea.', null),
    ('mindset', 'impulse-control', 1, 0, '“Leave it” with a treat on the floor — 5 reps daily.', null),
    ('mindset', 'impulse-control', 1, 1, 'Wait at thresholds — ask for a wait before going through every door.', null)
  ),
  ins as (
    insert into public.library_drills (category_id, name, level, sort_order)
    select c.id, v.name, v.level, v.sort_order
      from v join public.library_categories c on c.pillar = v.pillar and c.slug = v.slug
    returning id, category_id, name
  )
  insert into public.library_drill_blocks (drill_id, type, text, sort_order)
  select ins.id, 'paragraph', v.how_to, 0
    from ins
    join public.library_categories c on c.id = ins.category_id
    join v on v.pillar = c.pillar and v.slug = c.slug and v.name = ins.name
   where v.how_to is not null;
end $$;

-- Skills (the ticked-off checklist per pillar). Existing rows are left alone.
insert into public.skills (id, pillar, name, level, sort_order)
select v.id, v.pillar, v.name, v.level, v.sort_order
  from (values
    ('eng-name', 'engagement', 'Responds to their name', 1, 0),
    ('eng-checkin', 'engagement', 'Checks in on walks', 1, 1),
    ('eng-watch', 'engagement', 'Eye contact / watch me', 1, 2),
    ('eng-disengage', 'engagement', 'Disengages from distractions', 2, 3),
    ('eng-play', 'engagement', 'Engages in play with you', 2, 4),
    ('sk-sit', 'skills', 'Sit & down on cue', 1, 0),
    ('sk-stay', 'skills', 'Stay / wait', 1, 1),
    ('sk-recall', 'skills', 'Reliable recall', 1, 2),
    ('sk-loose', 'skills', 'Loose-lead walking', 2, 3),
    ('sk-heel', 'skills', 'Heelwork', 2, 4),
    ('sk-place', 'skills', 'Place / settle on a mat', 2, 5),
    ('mind-calm', 'mindset', 'Calm in new places', 1, 0),
    ('mind-settle', 'mindset', 'Settles in the home', 1, 1),
    ('mind-frustration', 'mindset', 'Handles frustration', 2, 2),
    ('mind-noise', 'mindset', 'Confident with noises', 2, 3),
    ('mind-impulse', 'mindset', 'Impulse control', 2, 4)

  ) as v(id, pillar, name, level, sort_order)
on conflict (id) do nothing;
