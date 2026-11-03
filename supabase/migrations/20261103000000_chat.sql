-- ============================================================================
-- Nelly & Nova — live chat (website /messages, /inbox and the app's Chat tab)
-- ============================================================================
-- Safe to re-run. Builds on the `conversations` and `messages` tables that
-- already exist in the project (one conversation per account, already in the
-- Realtime publication) and the existing `is_admin()` check.
--
-- Ported from the Kanvas Academy chat: one running conversation per member
-- with the team (any trainer can read and reply; no member-to-member chat),
-- live delivery over Realtime, photo/video/file attachments in a private
-- bucket, and a trainer-side "mark complete".
--
-- Every write goes through the SECURITY DEFINER functions below — the
-- website and the app call the same ones, and each checks whether the caller
-- is the conversation's member or a trainer. The tables keep select policies
-- only, so nobody can write a message with someone else's name on it or
-- mark their own conversation read for the team.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.conversations alter column last_message_at set default now();
-- Heartbeat from an open chat, refreshed every ~30s while it's on screen.
alter table public.conversations add column if not exists member_last_active_at timestamptz;
-- A trainer marked it done. Any new message (either side) reopens it.
alter table public.conversations add column if not exists completed_at timestamptz;
alter table public.conversations add column if not exists completed_by uuid references public.profiles (id) on delete set null;

-- The trainer's name when they sent it (members can't read trainer profiles).
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists attachment_type text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_attachment_type_check;
alter table public.messages add constraint messages_attachment_type_check
  check (attachment_type in ('image', 'video', 'file'));

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

-- nn_chat_send sets last_message_at itself (and reopens the conversation).
drop trigger if exists messages_touch_conversation on public.messages;

-- ---------------------------------------------------------------------------
-- Policies: read your own conversation (trainers read all); writes only
-- through the functions below.
-- ---------------------------------------------------------------------------
drop policy if exists "conversations: insert own or admin" on public.conversations;
drop policy if exists "conversations: update own or admin" on public.conversations;
drop policy if exists "messages: insert via conversation" on public.messages;

-- ---------------------------------------------------------------------------
-- Attachments — private (chats can carry photos of people's homes and dogs),
-- read through short-lived signed URLs. Paths are "{conversationId}/{file}".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

drop policy if exists "chat-attachments: read own conversation or admin" on storage.objects;
create policy "chat-attachments: read own conversation or admin"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.account_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "chat-attachments: upload to own conversation or admin" on storage.objects;
create policy "chat-attachments: upload to own conversation or admin"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.account_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- The signed-in member's conversation, created the first time they open chat.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_my_conversation()
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;
  insert into public.conversations (account_id, last_message_at)
  values (auth.uid(), now())
  on conflict (account_id) do nothing;
  select * into conv from public.conversations where account_id = auth.uid();
  return conv;
end;
$$;

-- ---------------------------------------------------------------------------
-- Send a message. The member sends into their own conversation; a trainer
-- into anyone's. Sending reopens a completed conversation and counts as
-- reading it.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_send(
  p_conversation_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_type text default null,
  p_attachment_name text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations;
  v_owner boolean;
  v_staff boolean;
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
  msg public.messages;
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;

  select * into conv from public.conversations where id = p_conversation_id;
  if conv.id is null then
    raise exception 'Conversation not found.';
  end if;

  v_owner := conv.account_id = auth.uid();
  v_staff := not v_owner and public.is_admin();
  if not v_owner and not v_staff then
    raise exception 'Not your conversation.';
  end if;

  if v_body = '' and p_attachment_path is null then
    raise exception 'Message can''t be empty.';
  end if;
  if length(v_body) > 5000 then
    raise exception 'That message is too long.';
  end if;
  -- An attachment must live in this conversation's own folder, otherwise a
  -- message could point at (and get a signed link to) someone else's file.
  if p_attachment_path is not null and (
    p_attachment_path not like conv.id::text || '/%'
    or position('..' in p_attachment_path) > 0
    or coalesce(p_attachment_type, '') not in ('image', 'video', 'file')
  ) then
    raise exception 'Could not attach that file.';
  end if;

  if v_staff then
    select nullif(btrim(owner_name), '') into v_name from public.profiles where id = auth.uid();
  end if;

  insert into public.messages (
    conversation_id, sender_id, sender_is_staff, sender_name, body,
    attachment_path, attachment_type, attachment_name
  ) values (
    conv.id, auth.uid(), v_staff, v_name, v_body,
    p_attachment_path,
    case when p_attachment_path is null then null else p_attachment_type end,
    case when p_attachment_path is null then null else left(p_attachment_name, 200) end
  )
  returning * into msg;

  if v_staff then
    update public.conversations
    set last_message_at = msg.created_at, completed_at = null, completed_by = null,
        staff_last_read_at = msg.created_at
    where id = conv.id;
  else
    update public.conversations
    set last_message_at = msg.created_at, completed_at = null, completed_by = null,
        member_last_read_at = msg.created_at, member_last_active_at = msg.created_at
    where id = conv.id;
  end if;

  return msg;
end;
$$;

-- Mark read: the member's own read time, or the team's shared one.
create or replace function public.nn_chat_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.conversations
  set member_last_read_at = now(), member_last_active_at = now()
  where id = p_conversation_id and account_id = auth.uid();
  if not found and public.is_admin() then
    update public.conversations set staff_last_read_at = now() where id = p_conversation_id;
  end if;
end;
$$;

-- "I'm in the chat right now" — every ~30s while the member's chat is on screen.
create or replace function public.nn_chat_heartbeat()
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations set member_last_active_at = now() where account_id = auth.uid();
$$;

-- Trainer only: mark a conversation complete, or reopen it.
create or replace function public.nn_chat_set_completed(p_conversation_id uuid, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Trainers only.';
  end if;
  update public.conversations
  set completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then auth.uid() else null end
  where id = p_conversation_id;
end;
$$;

-- How many trainer messages the member hasn't read yet (the Live Chat badge).
create or replace function public.nn_chat_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.account_id = auth.uid()
    and m.sender_is_staff
    and m.created_at > coalesce(c.member_last_read_at, 'epoch'::timestamptz);
$$;

-- The team's names and photos, so a member's chat can show who replied.
create or replace function public.nn_chat_team()
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.owner_name, p.avatar_url
  from public.profiles p
  where p.role = 'admin' and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Trainer inbox: every conversation with the member's name, photo, phone,
-- their dogs, the latest message and whether the team has read it.
-- ---------------------------------------------------------------------------
create or replace function public.nn_chat_inbox()
returns table (
  id uuid,
  account_id uuid,
  owner_name text,
  email text,
  phone text,
  avatar_url text,
  dog_names text,
  last_message_at timestamptz,
  last_body text,
  last_attachment_type text,
  last_from_staff boolean,
  unread boolean,
  completed_at timestamptz,
  member_last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Trainers only.';
  end if;
  return query
  select
    c.id,
    c.account_id,
    p.owner_name,
    p.email,
    p.phone,
    p.avatar_url,
    (select string_agg(d.name, ', ' order by d.sort_order) from public.dogs d where d.account_id = c.account_id),
    coalesce(c.last_message_at, c.created_at),
    lm.body,
    lm.attachment_type,
    lm.sender_is_staff,
    coalesce(not lm.sender_is_staff
      and lm.created_at > coalesce(c.staff_last_read_at, 'epoch'::timestamptz), false),
    c.completed_at,
    c.member_last_active_at
  from public.conversations c
  left join public.profiles p on p.id = c.account_id
  join lateral (
    select m.id, m.body, m.attachment_type, m.sender_is_staff, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  -- (the inner join keeps conversations nobody has written in out of the inbox)
  order by coalesce(c.last_message_at, c.created_at) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what: signed-in people only (each function checks the rest).
-- ---------------------------------------------------------------------------
revoke execute on function public.nn_chat_my_conversation() from public, anon;
revoke execute on function public.nn_chat_send(uuid, text, text, text, text) from public, anon;
revoke execute on function public.nn_chat_mark_read(uuid) from public, anon;
revoke execute on function public.nn_chat_heartbeat() from public, anon;
revoke execute on function public.nn_chat_set_completed(uuid, boolean) from public, anon;
revoke execute on function public.nn_chat_unread_count() from public, anon;
revoke execute on function public.nn_chat_team() from public, anon;
revoke execute on function public.nn_chat_inbox() from public, anon;

grant execute on function public.nn_chat_my_conversation() to authenticated;
grant execute on function public.nn_chat_send(uuid, text, text, text, text) to authenticated;
grant execute on function public.nn_chat_mark_read(uuid) to authenticated;
grant execute on function public.nn_chat_heartbeat() to authenticated;
grant execute on function public.nn_chat_set_completed(uuid, boolean) to authenticated;
grant execute on function public.nn_chat_unread_count() to authenticated;
grant execute on function public.nn_chat_team() to authenticated;
grant execute on function public.nn_chat_inbox() to authenticated;
