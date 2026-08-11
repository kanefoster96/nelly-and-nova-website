-- Nelly & Nova — inbox schema (chat + notifications + requests)
-- Reference for the live build. Three independent tables feeding one page.
-- Enable Realtime on all three, and RLS: `auth.uid() = user_id OR is_staff(auth.uid())`.

-- 1) CHAT ----------------------------------------------------------------
-- One row per person (user_id unique) — everyone has a single ongoing thread.
create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users (id),
  display_name         text,                 -- guest_name for anonymous visitors
  is_guest             boolean not null default false,
  last_message_at      timestamptz,
  member_last_read_at  timestamptz,
  staff_last_read_at   timestamptz,
  created_at           timestamptz not null default now()
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_id        uuid not null,
  sender_is_staff  boolean not null default false,
  body             text not null,
  attachment_path  text,
  attachment_type  text,
  attachment_name  text,
  created_at       timestamptz not null default now()
);

-- 2) NOTIFICATIONS -------------------------------------------------------
-- Generic one-way inbox. recipient_id null = broadcast, set = targeted.
-- "Read" is a single timestamp in auth.users.user_metadata (no read table).
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  sent_by       uuid,
  sent_by_name  text,
  title         text,
  body          text not null,
  action_href   text,
  recipient_id  uuid references auth.users (id),  -- null = everyone
  created_at    timestamptz not null default now()
);

-- 3) REQUESTS ------------------------------------------------------------
-- Structured form submissions (e.g. booking / meet & greet) awaiting review.
-- `kind` discriminates the payload shape. Approving copies fields onto the
-- real record AND inserts a targeted notifications row (the only link).
create table requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,                          -- or account_id
  kind          text not null,                 -- 'booking' | 'meet-greet' | …
  payload       jsonb not null,
  status        text not null default 'pending', -- 'pending'|'approved'|'rejected'
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid
);

-- Realtime:  alter publication supabase_realtime add table conversations, messages, notifications, requests;
