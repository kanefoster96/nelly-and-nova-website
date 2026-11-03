-- ============================================================================
-- Nelly & Nova — onboarding after a meet & greet (applied 3 Nov 2026)
-- ============================================================================
-- "Start onboarding" on a meet & greet request gives it a private join link
-- (/join/<token>) and a GoCardless Direct Debit set-up. The owner may not
-- have an account yet, so a Direct Debit set-up can belong to the request
-- first and to their account once they've made one (and opened the link
-- signed in). Safe to re-run.
-- ============================================================================

alter table public.enquiries add column if not exists onboarding_token text unique;
alter table public.enquiries add column if not exists onboarding_started_at timestamptz;
alter table public.enquiries add column if not exists closed_reason text;

alter table public.payment_mandates alter column account_id drop not null;
alter table public.payment_mandates add column if not exists enquiry_id uuid references public.enquiries (id) on delete set null;
alter table public.payment_mandates drop constraint if exists payment_mandates_owner_check;
alter table public.payment_mandates add constraint payment_mandates_owner_check
  check (account_id is not null or enquiry_id is not null);
create index if not exists payment_mandates_enquiry_idx on public.payment_mandates (enquiry_id, created_at desc);

-- ---------------------------------------------------------------------------
-- The join page: what to show for a join link (no sign-in needed — the
-- token is the secret). Never returns anything for an unknown token.
-- ---------------------------------------------------------------------------
create or replace function public.nn_onboarding_status(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.enquiries;
  m public.payment_mandates;
  v_dogs jsonb;
  v_mine boolean;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into e from public.enquiries where onboarding_token = p_token and status <> 'closed';
  if e.id is null then return null; end if;

  select * into m from public.payment_mandates
  where enquiry_id = e.id or (e.account_id is not null and account_id = e.account_id)
  order by created_at desc limit 1;

  -- Dogs only for the account it belongs to, signed in.
  v_mine := e.account_id is not null and e.account_id = auth.uid();
  if v_mine then
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'registered', d.waiver_signed_at is not null) order by d.sort_order), '[]'::jsonb)
    into v_dogs from public.dogs d where d.account_id = e.account_id;
  end if;

  return jsonb_build_object(
    'firstName', split_part(e.name, ' ', 1),
    'name', e.name,
    'email', e.email,
    'dogNames', e.dog_names,
    'accountLinked', e.account_id is not null,
    'linkedToYou', v_mine,
    'directDebit', coalesce(m.status, 'none'),
    'billingRequestId', m.billing_request_id,
    'dogs', coalesce(v_dogs, '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.nn_onboarding_status(text) from public;
grant execute on function public.nn_onboarding_status(text) to anon, authenticated;

-- Signed-in owner opening their join link: ties the request (and its Direct
-- Debit) to their account. Only if it isn't already tied to someone else.
create or replace function public.nn_onboarding_claim(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.enquiries;
begin
  if auth.uid() is null or p_token is null or length(p_token) < 20 then return false; end if;
  select * into e from public.enquiries where onboarding_token = p_token and status <> 'closed';
  if e.id is null then return false; end if;
  if e.account_id is not null and e.account_id <> auth.uid() then return false; end if;
  update public.enquiries set account_id = auth.uid(), updated_at = now() where id = e.id;
  update public.payment_mandates set account_id = auth.uid(), updated_at = now()
  where enquiry_id = e.id and account_id is null;
  return true;
end;
$$;
revoke execute on function public.nn_onboarding_claim(text) from public, anon;
grant execute on function public.nn_onboarding_claim(text) to authenticated;
