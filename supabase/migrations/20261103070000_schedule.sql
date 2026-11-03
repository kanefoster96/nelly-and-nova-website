-- ============================================================================
-- Nelly & Nova — the real schedule: regular places and one-off bookings
-- ============================================================================
-- placements: a regular Full Day Training place on a weekday (every week or
--   every other week) from a start date. It can be held for someone still
--   onboarding (enquiry_id, owner's name) before they've registered a dog:
--   once they sign up and register, the account and dog fill themselves in.
-- bookings: one-off things on a date — a one-off Full Day Training day, or
--   a 1-1 session (with a time).
-- Meet & greets come from enquiries.meet_greet_at.
-- nn_trainer_calendar(from, to) lays all of it out by date, for the
-- trainer's Registers and Calendar.
-- ============================================================================

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  day text not null check (day in ('monday','tuesday','wednesday','thursday','friday')),
  cadence text not null default 'weekly' check (cadence in ('weekly','alternating')),
  start_on date not null,
  end_on date,
  account_id uuid references public.profiles (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  -- Shown until a dog is registered, e.g. "Sam Taylor — Biscuit".
  holder_name text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (account_id is not null or enquiry_id is not null or holder_name is not null)
);
create index if not exists placements_day_idx on public.placements (day, start_on);
create index if not exists placements_account_idx on public.placements (account_id);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('full_day','one_to_one')),
  on_date date not null,
  start_time time,
  account_id uuid references public.profiles (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  holder_name text,
  notes text,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on public.bookings (on_date);

alter table public.placements enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "placements: trainers manage, owners read own" on public.placements;
create policy "placements: trainers manage, owners read own" on public.placements
  for select using (public.nn_is_admin() or account_id = auth.uid());
drop policy if exists "placements: trainers write" on public.placements;
create policy "placements: trainers write" on public.placements
  for all to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

drop policy if exists "bookings: trainers manage, owners read own" on public.bookings;
create policy "bookings: trainers manage, owners read own" on public.bookings
  for select using (public.nn_is_admin() or account_id = auth.uid());
drop policy if exists "bookings: trainers write" on public.bookings;
create policy "bookings: trainers write" on public.bookings
  for all to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());

-- ---------------------------------------------------------------------------
-- Held places fill themselves in: the owner's account when their request
-- links to it, and the dog when they register one (waiver signed).
-- ---------------------------------------------------------------------------
create or replace function public.nn_fill_places_from_enquiry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_id is not null and (old.account_id is distinct from new.account_id) then
    update public.placements set account_id = new.account_id where enquiry_id = new.id and account_id is null;
    update public.bookings set account_id = new.account_id where enquiry_id = new.id and account_id is null;
  end if;
  return new;
end; $$;
drop trigger if exists nn_fill_places_from_enquiry on public.enquiries;
create trigger nn_fill_places_from_enquiry after update of account_id on public.enquiries
  for each row execute function public.nn_fill_places_from_enquiry();

create or replace function public.nn_fill_places_from_dog()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_place uuid;
begin
  if new.waiver_signed_at is not null and (tg_op = 'INSERT' or old.waiver_signed_at is null) then
    -- One empty place per registered dog, oldest first.
    select id into v_place from public.placements
    where account_id = new.account_id and dog_id is null
      and not exists (select 1 from public.placements p2 where p2.dog_id = new.id and p2.day = placements.day)
    order by created_at limit 1;
    if v_place is not null then update public.placements set dog_id = new.id where id = v_place; end if;
    update public.bookings set dog_id = new.id where account_id = new.account_id and dog_id is null and on_date >= current_date;
  end if;
  return new;
end; $$;
drop trigger if exists nn_fill_places_from_dog on public.dogs;
create trigger nn_fill_places_from_dog after insert or update of waiver_signed_at on public.dogs
  for each row execute function public.nn_fill_places_from_dog();

-- ---------------------------------------------------------------------------
-- The trainer's calendar: one row per thing per date.
--   kind: full_day (regular place), full_day_one_off, one_to_one, meet_greet
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
