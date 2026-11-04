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
