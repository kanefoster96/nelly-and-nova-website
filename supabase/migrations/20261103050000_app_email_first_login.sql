-- ============================================================================
-- The app's email-first log in, like Kanvas Academy's (applied 3 Nov 2026)
-- ============================================================================
-- email → has an account? → password
--       → asked for a meet & greet but no account? → "Set up my account"
--         email; its button opens the app on "Create a password" with a
--         one-use ticket (email_codes) → account made, signed in
--       → neither → ask for a free meet & greet
-- Only the website's server (service role) touches these.
-- ============================================================================

create table if not exists public.email_codes (
  email text not null,
  purpose text not null check (purpose in ('ticket')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  primary key (email, purpose)
);
alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated;

-- Per-IP / per-email limits for the no-sign-in endpoints.
create table if not exists public.app_request_log (
  id bigint generated always as identity primary key,
  action text not null,
  ip text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists app_request_log_action_time_idx on public.app_request_log (action, created_at desc);
alter table public.app_request_log enable row level security;
revoke all on public.app_request_log from anon, authenticated;

create or replace function public.nn_user_id_for_email(check_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(check_email)) limit 1;
$$;
revoke execute on function public.nn_user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.nn_user_id_for_email(text) to service_role;

create or replace function public.nn_has_open_request(check_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enquiries where lower(email) = lower(trim(check_email)) and status <> 'closed');
$$;
revoke execute on function public.nn_has_open_request(text) from public, anon, authenticated;
grant execute on function public.nn_has_open_request(text) to service_role;
