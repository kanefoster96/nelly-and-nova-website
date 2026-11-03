-- ============================================================================
-- Nelly & Nova — GoCardless Direct Debits (step 1: setting one up)
-- ============================================================================
-- Safe to re-run. Applied to the project 3 Nov 2026.
--
-- The GoCardless account already has customers that this site must never
-- touch, so the site keeps its own list of what it created (this table) and
-- only ever acts on rows in it. GoCardless's notifications (the webhook) and
-- the customer's return from GoCardless can only UPDATE rows that already
-- exist here, never add one, so anything the site didn't start is ignored.
--
-- The webhook has no signed-in user, and the site has no service-role key,
-- so it calls nn_gc_* functions with a shared secret that lives in a
-- private schema the API can't read (and in Vercel as
-- GOCARDLESS_RELAY_SECRET). The secret's value is NOT in this file; it is
-- set separately (see "relay secret" below).
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

-- Every GoCardless event handled once, even if GoCardless sends it again.
create table if not exists private.gocardless_events (
  id text primary key,
  received_at timestamptz not null default now()
);
revoke all on private.gocardless_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- One row per Direct Debit set-up link the site created.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_mandates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  -- GoCardless IDs (BRQ…, MD…, CU…). The billing request is known straight
  -- away; the mandate and customer once they've filled in their bank details.
  billing_request_id text not null unique,
  mandate_id text unique,
  customer_id text,
  -- The link they open to fill in their bank details on GoCardless's page.
  authorisation_url text,
  -- 'link_sent' until they finish, then GoCardless's mandate status:
  -- pending_submission, submitted, active, failed, cancelled, expired, …
  status text not null default 'link_sent',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_mandates_account_idx on public.payment_mandates (account_id, created_at desc);

alter table public.payment_mandates enable row level security;

drop policy if exists "payment_mandates: read own or admin" on public.payment_mandates;
create policy "payment_mandates: read own or admin"
  on public.payment_mandates for select
  using (account_id = auth.uid() or public.is_admin());

drop policy if exists "payment_mandates: admin creates" on public.payment_mandates;
create policy "payment_mandates: admin creates"
  on public.payment_mandates for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- GoCardless → site: record progress on a set-up the site created.
-- Matches on the billing request or the mandate; anything else is ignored.
-- Returns true if a row was updated.
-- ---------------------------------------------------------------------------
create or replace function public.nn_gc_record(
  p_secret text,
  p_billing_request_id text,
  p_mandate_id text,
  p_customer_id text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_count int;
begin
  select value into v_secret from private.settings where key = 'gocardless_relay_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'Not allowed.';
  end if;
  if p_status is not null and p_status !~ '^[a-z_]{3,40}$' then
    raise exception 'Bad status.';
  end if;

  update public.payment_mandates m
  set mandate_id = coalesce(m.mandate_id, nullif(p_mandate_id, '')),
      customer_id = coalesce(m.customer_id, nullif(p_customer_id, '')),
      status = coalesce(p_status, m.status),
      updated_at = now()
  where (p_billing_request_id is not null and m.billing_request_id = p_billing_request_id)
     or (p_mandate_id is not null and m.mandate_id = p_mandate_id);
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- True the first time an event id is seen, false for a repeat.
create or replace function public.nn_gc_event_first_time(p_secret text, p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_count int;
begin
  select value into v_secret from private.settings where key = 'gocardless_relay_secret';
  if v_secret is null or p_secret is distinct from v_secret then
    raise exception 'Not allowed.';
  end if;
  insert into private.gocardless_events (id) values (p_event_id) on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- Called without a signed-in user (the webhook), so open to anon — the
-- secret check inside is the lock.
revoke execute on function public.nn_gc_record(text, text, text, text, text) from public;
revoke execute on function public.nn_gc_event_first_time(text, text) from public;
grant execute on function public.nn_gc_record(text, text, text, text, text) to anon, authenticated;
grant execute on function public.nn_gc_event_first_time(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trainer: the conversation with an owner (created if they've never
-- chatted), so a Direct Debit link can be sent in their chat.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_conversation_for(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Trainers only.';
  end if;
  insert into public.conversations (account_id, last_message_at)
  values (p_account_id, now())
  on conflict (account_id) do nothing;
  select id into v_id from public.conversations where account_id = p_account_id;
  return v_id;
end;
$$;
revoke execute on function public.nn_chat_conversation_for(uuid) from public, anon;
grant execute on function public.nn_chat_conversation_for(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Relay secret: set once, outside this file, with
--   insert into private.settings (key, value)
--   values ('gocardless_relay_secret', '<same value as Vercel's GOCARDLESS_RELAY_SECRET>')
--   on conflict (key) do update set value = excluded.value;
-- ---------------------------------------------------------------------------
