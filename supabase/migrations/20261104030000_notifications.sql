-- ============================================================================
-- Nelly & Nova — notifications made real (website /inbox, the app's bell)
-- ============================================================================
-- Safe to re-run, additive only. Builds on the `notifications` table that
-- already exists (recipient_id, kind, title, body, session_id, read_at,
-- created_at, already in the Realtime publication) and its policies:
--   select own or admin · insert admin only · update own or admin.
--
-- Like Kanvas's notifications: each row is one person's copy (no
-- broadcasts — "everyone" is a row each), it carries where tapping it goes
-- (action_href, an app path such as "/chat") and who it's from
-- (sent_by_name). Titles start with one emoji, like Kanvas's automated
-- notices ("💬 Kane", "📅 Your meet & greet is booked").
--
-- Owners can only ever read their own and mark them read: the only column
-- anyone signed in may update is read_at. Trainers insert (the website's
-- /admin/notifications/new and the app's Send a notification, plus every
-- place the site already sends an app push).
-- ============================================================================

alter table public.notifications add column if not exists action_href text;
alter table public.notifications add column if not exists sent_by uuid references public.profiles (id) on delete set null;
alter table public.notifications add column if not exists sent_by_name text;
alter table public.notifications alter column sent_by set default auth.uid();

-- Same kinds as before, plus the ones the site now raises.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'info', 'pickup_eta', 'dropoff_eta', 'chat_message', 'reschedule_accepted',
  'report_card_published', 'broadcast',
  'announcement', 'onboarding', 'meet_greet', 'register_reminder'
));

-- An app path or a site path, never another domain.
alter table public.notifications drop constraint if exists notifications_action_href_check;
alter table public.notifications add constraint notifications_action_href_check
  check (action_href is null or (action_href like '/%' and action_href not like '//%' and length(action_href) <= 300));

alter table public.notifications drop constraint if exists notifications_title_length_check;
alter table public.notifications add constraint notifications_title_length_check
  check (length(title) <= 120 and length(body) <= 2000);

-- The bell's unread count.
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Who can do what. Row Level Security stays on; nobody signed out touches it.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
revoke update, delete, truncate, references, trigger on public.notifications from authenticated;
grant select, insert on public.notifications to authenticated;
-- Marking read is the only change anyone signed in can make…
grant update (read_at) on public.notifications to authenticated;

-- …and only on their own (a trainer marks their own too, never an owner's).
drop policy if exists "notifications: update own or admin" on public.notifications;
drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Trainers insert (unchanged), stamped as themselves.
drop policy if exists "notifications: insert admin only" on public.notifications;
create policy "notifications: insert admin only"
  on public.notifications for insert to authenticated
  with check (public.is_admin() and (sent_by is null or sent_by = auth.uid()));

-- Read your own; trainers can read everyone's (what was sent, to whom).
drop policy if exists "notifications: select own or admin" on public.notifications;
create policy "notifications: select own or admin"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

-- Realtime (the bell updates live) — already published; kept idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
