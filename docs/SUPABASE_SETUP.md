# Connecting the site to Supabase

A step-by-step guide for wiring this scaffold up to a real Supabase project
(auth + database + storage). Tailored to this codebase.

## What's already in place (don't redo)

- **Packages**: `@supabase/ssr` and `@supabase/supabase-js` are installed.
- **Client helpers**: `lib/supabase/client.ts` (browser) and
  `lib/supabase/server.ts` (server components / route handlers), both reading
  the env vars below.
- **Session middleware**: `proxy.ts` already calls `supabase.auth.getUser()`
  on every request to keep the auth cookie fresh.
- **Env template**: `.env.example` documents the variable names.
- **Git**: `.env*` is gitignored (except `.env.example`), so real keys aren't
  committed.

> The app is a **scaffold**. Every backend action currently runs off
> `localStorage` and the `TODO(backend)` seams in `lib/*/data.ts`. Setting the
> env vars connects Supabase but does **not** change behaviour on its own — you
> swap the seams over one at a time (Phase 5).

---

## Phase 1 — Create the project & connect

1. **Create the project** at https://supabase.com → *New project*. Name it
   (e.g. `nelly-and-nova`), set + save a DB password, choose a region near your
   users (e.g. London / `eu-west-2`). Wait ~2 min.
2. **Get the API keys** — *Settings → API*. (Newer dashboards label these
   *Publishable* / *Secret*; the "anon" key == the **Publishable** key.)
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role / secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. **Add them locally** — create `.env.local` (gitignored) from `.env.example`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=          # leave blank until admin actions need it
   ```
   Then **restart `npm run dev`** — Next.js reads env vars at startup, and
   `NEXT_PUBLIC_*` values are inlined at build time.
4. **Add them in production** — Vercel (or your host) → *Settings → Environment
   Variables*, add the same three, redeploy.
5. **Sanity check** — temporarily, in a server component/route:
   ```ts
   import { createClient } from "@/lib/supabase/server";
   const supabase = await createClient();
   const { data, error } = await supabase.auth.getUser(); // null user is fine
   ```
   No crash = connected. Remove afterwards.

---

## Phase 2 — Build the database schema

Use the Supabase **SQL Editor** (or `supabase` CLI migrations). Main tables,
mirroring the `lib/*` folders — each `TODO(backend)` comment describes the exact
insert/update it expects:

- `dogs`, owner = auth user (a dog belongs to an owner) — `lib/dogs`,
  `lib/dogs/account.ts`
- `schedule_slots` (dog, day, cadence, status held/permanent, start_date) —
  `lib/schedule`
- `report_cards` → `homework_categories` → `drills`;
  `homework_completions(report_id, date)` with **`UNIQUE(report_id, date)`**
  (one-per-day rule); `report_comments` — `lib/reports/*`
- `reschedules` / session exceptions — `lib/reschedule`
- `holidays` + `holiday_usage` — `lib/holidays`
- `onboarding` — `lib/onboarding`
- `payments` (fed by GoCardless webhooks); `homework_resets(dog_id, reset_at)` —
  `lib/payments`, `lib/reports/reset.ts`
- `waiver_drafts` — `lib/waiver`
- `member_cancellations` — `lib/members`

**Enable Row Level Security on every table** and add policies (owners see only
their own dogs/cards; staff see all). This is the biggest, most important step.

---

## Phase 3 — Authentication  ✅ wired

Email/password auth is live. `lib/auth/session.ts` sources the account from
`supabase.auth` + the `profiles`/`dogs` tables; `LoginForm`, `SignupForm` and
`AccountInfo` call `signInWithPassword` / `signUp` / `updateUser`; role comes
from `profiles.role` (trainer = `admin`). The `handle_new_user` trigger creates
the profile (and any dogs from sign-up metadata) and assigns the trainer role
to allowlisted emails.

**Remaining dashboard toggle — email confirmation.** Supabase defaults to
requiring email confirmation before a user can log in. Two options:

- **Off (quick start):** *Authentication → Providers → Email* → turn off
  **Confirm email**. New sign-ups log in immediately, no email needed. Fine for
  early testing; anyone can register with any address.
- **On (recommended for launch):** keep it on and give Supabase a real email
  sender — see Phase 3b. Until a sender is configured, Supabase's built-in mailer
  is heavily rate-limited and unreliable, so confirmations often never arrive.

---

## Phase 3b — Email (Resend)

There are **two independent email paths** — set up whichever you need:

**1. Supabase auth emails** (confirm-email, magic links, password resets).
Sent by Supabase's servers, so Resend is configured as Supabase's **SMTP
provider** in the dashboard — *not* via the app's `RESEND_API_KEY`.

- *Authentication → Emails → SMTP Settings* → **Enable Custom SMTP**:
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: your Resend API key (`re_…`)
  - Sender email: an address on a **verified domain** (e.g.
    `hello@nellyandnova.co.uk`), or `onboarding@resend.dev` for testing
  - Sender name: `Nelly & Nova`
- Then raise *Authentication → Rate Limits → emails per hour* off the default.

**2. App transactional emails** (contact form, booking + onboarding
confirmations). Sent by the Next app via Resend's HTTP API in
`lib/email/resend.ts` (best-effort — skipped if no key). Set env vars:

```
RESEND_API_KEY=re_…
CONTACT_FROM_EMAIL=Nelly & Nova <hello@nellyandnova.co.uk>   # verified domain, or onboarding@resend.dev
CONTACT_TO_EMAIL=charlotte@nellyandnova.co.uk
```

Add these in **Vercel → Settings → Environment Variables** for production, and
in `.env.local` for local dev.

> **Resend prerequisites** (do once at resend.com):
> 1. Create an account and an **API key**.
> 2. To email *anyone*, **verify your domain** (Resend → Domains → add
>    `nellyandnova.co.uk`, then add the DNS records it shows). Without a
>    verified domain you can only send from `onboarding@resend.dev` and only to
>    the address you signed up with — fine for testing, not for real customers.
>
> **Sandbox note:** this cloud dev environment's egress is locked down, so the
> app can't actually reach `api.resend.com` from here — app emails send only
> from production (Vercel). Supabase's SMTP sending happens on Supabase's
> servers, so confirmation emails are unaffected by the sandbox.

---

## Phase 4 — Storage for dog photos

The upload is written but disabled behind an env check in
`lib/storage/photos.ts`.
1. *Storage → New bucket* → name **`dog-photos`**, public (or add a read policy).
2. Uncomment the upload body in `uploadDogPhoto()` — path is namespaced by owner
   id for RLS.

---

## Phase 5 — Swap the seams, one feature at a time

Replace the localStorage stand-ins with real queries, testing each first. Order:

1. **Auth** (Phase 3) — everything keys off the logged-in user.
2. **Dogs + schedule** — the roster the trainer dashboard reads.
3. **Report cards + homework** — the reports/homework/progress/reset stores.
4. **Reschedules, holidays, onboarding.**
5. **Payments** — GoCardless: set up the mandate flow and a webhook route that
   writes to `payments`. Refund/cancel live in `lib/payments/data.ts`. Realtime
   or webhooks flip statuses.
6. **Resend email** is separate and already works — just set `RESEND_API_KEY`
   (see `.env.example`).

Each `lib/*/data.ts` function is the single place to change. The UI stores
(`useSyncExternalStore` hooks) can stay as an optimistic cache, or be swapped
for Supabase Realtime subscriptions.

---

## Env var reference (`.env.example`)

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | bypasses RLS — never `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | server only | transactional email (optional) |
| `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` | server | email routing |
