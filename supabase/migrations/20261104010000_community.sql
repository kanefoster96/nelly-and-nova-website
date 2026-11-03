-- ============================================================================
-- Nelly & Nova — Community (website /community + the home feed, app's
-- Community tab)
-- ============================================================================
-- Safe to re-run, additive only: adds columns, tables, helpers and policies on
-- top of the existing `posts`, `post_media`, `post_likes`, `post_comments`
-- tables and the public `media` bucket. Nothing is dropped or rewritten.
--
-- Ported from the Kanvas Academy Student Home:
--   * posts get a title, a trainer-only pin and an "edited" stamp;
--   * photos AND videos (post_media.kind), uploaded to media/<uid>/…;
--   * comments can be edited by their author ("edited");
--   * report a post or comment to the trainers, block a member (their posts
--     and comments disappear for you, enforced here by RLS);
--   * a one-time Community Guidelines agreement on the profile.
--
-- Who can do what (existing policies + the guards below):
--   members  read everything, post / comment (account with a dog), like, and
--            edit or delete only their own;
--   trainers (profiles.role = 'admin') can edit, delete and pin anything.
--
-- Members can't read each other's `profiles` rows, so names and avatars come
-- from nn_community_authors(): an account is shown by its dog names
-- ("Nova & Rex"), a trainer by their display name ("Charlotte (Trainer)")
-- and photo (the logo if none) with the official tick.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists title text;
-- Kept at the top of the feed. Only a trainer can set it (guard below).
alter table public.posts add column if not exists pinned boolean not null default false;
-- Its words were changed after posting.
alter table public.posts add column if not exists edited_at timestamptz;

-- 'image' or 'video'.
alter table public.post_media add column if not exists kind text not null default 'image';
-- The object's path in the `media` bucket (<uid>/<file>) — for tidying up.
alter table public.post_media add column if not exists path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_media_kind_check') then
    alter table public.post_media add constraint post_media_kind_check check (kind in ('image', 'video'));
  end if;
end $$;

alter table public.post_comments add column if not exists edited_at timestamptz;

-- When the account agreed to the Community Guidelines (asked once, with their
-- first post or comment).
alter table public.profiles add column if not exists community_guidelines_accepted_at timestamptz;

create index if not exists posts_feed_idx on public.posts (pinned desc, created_at desc);
create index if not exists post_media_post_idx on public.post_media (post_id, sort_order);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create index if not exists post_likes_account_idx on public.post_likes (account_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Is this account a trainer? (members can't read other profiles directly)
create or replace function public.nn_is_trainer(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_account and role = 'admin');
$$;
revoke all on function public.nn_is_trainer(uuid) from public, anon;
grant execute on function public.nn_is_trainer(uuid) to authenticated;

-- How each author is shown in the community: a trainer as the business with
-- the official tick; a member by their dogs' names ("Nova", "Nova & Rex",
-- "Nova, Rex & Bella"), falling back to the owner's name. Avatar: the
-- account photo, else the first dog's photo. Signed-in callers only.
create or replace function public.nn_community_authors(p_ids uuid[])
returns table (id uuid, name text, avatar_url text, is_trainer boolean, dog_names text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    case
      when p.role = 'admin' then coalesce(nullif(trim(p.owner_name), ''), 'Nelly & Nova')
      else coalesce(
        case cardinality(d.names)
          when 0 then null
          when 1 then d.names[1]
          else array_to_string(d.names[1:cardinality(d.names) - 1], ', ') || ' & ' || d.names[cardinality(d.names)]
        end,
        nullif(trim(p.owner_name), ''),
        'Member'
      )
    end as name,
    case when p.role = 'admin' then nullif(p.avatar_url, '') else coalesce(nullif(p.avatar_url, ''), d.photo) end as avatar_url,
    p.role = 'admin' as is_trainer,
    d.names as dog_names
  from public.profiles p
  cross join lateral (
    select
      coalesce(array_agg(x.name order by x.sort_order, x.created_at) filter (where nullif(trim(x.name), '') is not null), '{}') as names,
      (array_agg(x.photo_url order by x.sort_order, x.created_at) filter (where nullif(x.photo_url, '') is not null))[1] as photo
    from public.dogs x
    where x.account_id = p.id
  ) d
  where p.id = any (p_ids)
    and auth.uid() is not null;
$$;
revoke all on function public.nn_community_authors(uuid[]) from public, anon;
grant execute on function public.nn_community_authors(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards: only a trainer can pin; nobody can move a post or comment to
-- another author or post; editing the words stamps edited_at. Skipped for
-- server-side jobs (no signed-in user).
-- ---------------------------------------------------------------------------
create or replace function public.nn_community_post_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.nn_is_admin() then
      new.pinned := false;
    end if;
    new.edited_at := null;
  else
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    if not public.nn_is_admin() then
      new.pinned := old.pinned;
    end if;
    if new.title is distinct from old.title or new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_community_guard on public.posts;
create trigger posts_community_guard
  before insert or update on public.posts
  for each row execute function public.nn_community_post_guard();

create or replace function public.nn_community_comment_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.edited_at := null;
  else
    new.author_id := old.author_id;
    new.post_id := old.post_id;
    new.created_at := old.created_at;
    if new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_community_guard on public.post_comments;
create trigger post_comments_community_guard
  before insert or update on public.post_comments
  for each row execute function public.nn_community_comment_guard();

-- ---------------------------------------------------------------------------
-- Blocking: hide a member's posts and comments from yourself.
-- ---------------------------------------------------------------------------
create table if not exists public.community_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_blocks_not_self check (blocker_id <> blocked_id)
);
alter table public.community_blocks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_blocks' and policyname = 'community_blocks: read own') then
    create policy "community_blocks: read own" on public.community_blocks
      for select to authenticated using (blocker_id = auth.uid());
  end if;
  -- Members can't block the trainers.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_blocks' and policyname = 'community_blocks: insert own') then
    create policy "community_blocks: insert own" on public.community_blocks
      for insert to authenticated with check (blocker_id = auth.uid() and not public.nn_is_trainer(blocked_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_blocks' and policyname = 'community_blocks: delete own') then
    create policy "community_blocks: delete own" on public.community_blocks
      for delete to authenticated using (blocker_id = auth.uid());
  end if;

  -- Restrictive: on top of "read all", a blocked author's posts and comments
  -- don't come back for the person who blocked them.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts: hide blocked authors') then
    create policy "posts: hide blocked authors" on public.posts
      as restrictive for select to authenticated
      using (not exists (select 1 from public.community_blocks b where b.blocker_id = auth.uid() and b.blocked_id = posts.author_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_comments' and policyname = 'post_comments: hide blocked authors') then
    create policy "post_comments: hide blocked authors" on public.post_comments
      as restrictive for select to authenticated
      using (not exists (select 1 from public.community_blocks b where b.blocker_id = auth.uid() and b.blocked_id = post_comments.author_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reports: a post or comment flagged to the trainers.
-- ---------------------------------------------------------------------------
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  constraint post_reports_one_target check (num_nonnulls(post_id, comment_id) = 1),
  constraint post_reports_reason_check check (reason in ('spam', 'harassment', 'inappropriate', 'other'))
);
alter table public.post_reports enable row level security;
create index if not exists post_reports_open_idx on public.post_reports (created_at desc) where resolved_at is null;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_reports' and policyname = 'post_reports: insert own') then
    create policy "post_reports: insert own" on public.post_reports
      for insert to authenticated with check (reporter_id = auth.uid() and resolved_at is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_reports' and policyname = 'post_reports: read own or trainer') then
    create policy "post_reports: read own or trainer" on public.post_reports
      for select to authenticated using (reporter_id = auth.uid() or public.nn_is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_reports' and policyname = 'post_reports: trainer update') then
    create policy "post_reports: trainer update" on public.post_reports
      for update to authenticated using (public.nn_is_admin()) with check (public.nn_is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_reports' and policyname = 'post_reports: trainer delete') then
    create policy "post_reports: trainer delete" on public.post_reports
      for delete to authenticated using (public.nn_is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: the `media` bucket takes videos too, and a trainer can tidy up the
-- files of a post they delete. Uploads stay in the user's own folder (the
-- existing "media: insert own folder" policy).
-- ---------------------------------------------------------------------------
update storage.buckets
set
  allowed_mime_types = case
    when allowed_mime_types is null then null
    else array(
      select distinct m from unnest(
        allowed_mime_types || array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
                                    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
      ) as m
    )
  end,
  file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800)
where id = 'media';

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media: trainer delete') then
    create policy "media: trainer delete" on storage.objects
      for delete to authenticated using (bucket_id = 'media' and public.nn_is_admin());
  end if;
end $$;
