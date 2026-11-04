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
