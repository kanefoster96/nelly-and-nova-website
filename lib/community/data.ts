/**
 * Community feed, backed by Supabase (browser client).
 * ----------------------------------------------------
 * Row Level Security does the gatekeeping (supabase/migrations/
 * 20261104010000_community.sql): members read everything, post, like and
 * comment, and edit or delete only their own; trainers can do everything,
 * including pinning. A blocked member's posts and comments never come back.
 * Uploads go to the public `media` bucket under the user's own folder.
 *
 * The app has the same functions in mobile/src/data/community/index.ts.
 */
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Comment, MediaItem, Post, ReportReason, Viewer } from "./types";

const BUCKET = "media";
const FEED_LIMIT = 50;
/** The trainers post as the business, with its logo. */
export const TRAINER_AVATAR = "/brand/nn-icon.svg";

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  _client ??= createClient();
  return _client;
}

const WEEKDAYS: Record<string, string> = { Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 3 Nov · 14:05" in UK time — the Kanvas Student Home timestamp. */
export function formatPostTimestamp(iso: string): string {
  const date = new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    const month = MONTHS[Number(get("month")) - 1] ?? "";
    return `${WEEKDAYS[get("weekday")] ?? get("weekday")} ${get("day")} ${month} · ${get("hour").padStart(2, "0")}:${get("minute")}`;
  } catch {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${Object.values(WEEKDAYS)[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} · ${hh}:${mm}`;
  }
}

type Author = { id: string; name: string; avatar_url: string | null; is_trainer: boolean };

async function loadAuthors(ids: string[]): Promise<Map<string, Author>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await sb().rpc("nn_community_authors", { p_ids: unique });
  if (error) throw error;
  return new Map(((data ?? []) as Author[]).map((a) => [a.id, a]));
}

function authorAvatar(a: Author | undefined): string | undefined {
  if (!a) return undefined;
  return a.avatar_url || (a.is_trainer ? TRAINER_AVATAR : undefined);
}

/** The signed-in account (or null), with how the community shows it. */
export async function getViewer(): Promise<Viewer | null> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  if (!user) return null;
  const [{ data: profile }, authors] = await Promise.all([
    sb().from("profiles").select("role, community_guidelines_accepted_at").eq("id", user.id).maybeSingle(),
    loadAuthors([user.id]),
  ]);
  const me = authors.get(user.id);
  return {
    id: user.id,
    name: me?.name ?? "Member",
    avatarUrl: authorAvatar(me),
    isTrainer: profile?.role === "admin",
    guidelinesAccepted: !!profile?.community_guidelines_accepted_at,
  };
}

type PostRow = {
  id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  pinned: boolean;
  created_at: string;
  post_media: { url: string; kind: string; sort_order: number }[];
  post_likes: { account_id: string }[];
  post_comments: { id: string; author_id: string; body: string; created_at: string; edited_at: string | null }[];
};

const POST_SELECT =
  "id, author_id, title, body, pinned, created_at, post_media(url, kind, sort_order), post_likes(account_id), post_comments(id, author_id, body, created_at, edited_at)";

async function toPosts(rows: PostRow[], viewer: Pick<Viewer, "id" | "isTrainer">): Promise<Post[]> {
  const authors = await loadAuthors(rows.flatMap((p) => [p.author_id, ...p.post_comments.map((c) => c.author_id)]));
  return rows.map((p) => {
    const author = authors.get(p.author_id);
    const comments: Comment[] = [...p.post_comments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => {
        const ca = authors.get(c.author_id);
        return {
          id: c.id,
          authorId: c.author_id,
          authorName: ca?.name ?? "Member",
          authorAvatarUrl: authorAvatar(ca),
          authorIsTrainer: !!ca?.is_trainer,
          body: c.body,
          createdAt: c.created_at,
          createdAtLabel: formatPostTimestamp(c.created_at),
          isMine: c.author_id === viewer.id,
          canDelete: c.author_id === viewer.id || viewer.isTrainer,
          edited: !!c.edited_at,
        };
      });
    return {
      id: p.id,
      authorId: p.author_id,
      authorName: author?.name ?? "Member",
      authorAvatarUrl: authorAvatar(author),
      authorIsTrainer: !!author?.is_trainer,
      title: p.title || undefined,
      body: p.body ?? "",
      media: [...p.post_media]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({ type: m.kind === "video" ? "video" : "image", url: m.url })),
      createdAt: p.created_at,
      createdAtLabel: formatPostTimestamp(p.created_at),
      pinned: !!p.pinned,
      isMine: p.author_id === viewer.id,
      canDelete: p.author_id === viewer.id || viewer.isTrainer,
      likeCount: p.post_likes.length,
      likedByMe: p.post_likes.some((l) => l.account_id === viewer.id),
      comments,
    };
  });
}

/** Pinned first, then newest. */
export async function getFeed(viewer: Pick<Viewer, "id" | "isTrainer">): Promise<Post[]> {
  const { data, error } = await sb()
    .from("posts")
    .select(POST_SELECT)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;
  return toPosts((data ?? []) as PostRow[], viewer);
}

/** The account's own newest post (for the profile page), or null. */
export async function getMyLatestPost(viewer: Pick<Viewer, "id" | "isTrainer">): Promise<Post | null> {
  const { data, error } = await sb()
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const [post] = await toPosts((data ?? []) as PostRow[], viewer);
  return post ?? null;
}

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  return (fromName || file.type.split("/").pop() || "bin").toLowerCase();
}

/** Upload one photo/video to media/<uid>/… and return its public URL. */
async function uploadMedia(userId: string, file: File): Promise<MediaItem & { path: string }> {
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message || "Couldn't upload that file.");
  const url = sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { type: file.type.startsWith("video") ? "video" : "image", url, path };
}

/** Stamp the one-time Community Guidelines agreement. */
export async function acceptGuidelines(viewerId: string): Promise<void> {
  const { error } = await sb()
    .from("profiles")
    .update({ community_guidelines_accepted_at: new Date().toISOString() })
    .eq("id", viewerId);
  if (error) throw error;
}

export async function createPost(
  viewer: Viewer,
  input: { title: string; body: string; files: File[]; pinned?: boolean }
): Promise<void> {
  const uploaded = await Promise.all(input.files.map((f) => uploadMedia(viewer.id, f)));
  const { data: post, error } = await sb()
    .from("posts")
    .insert({
      author_id: viewer.id,
      title: input.title || null,
      body: input.body,
      pinned: viewer.isTrainer && !!input.pinned,
    })
    .select("id")
    .single();
  if (error) {
    if (uploaded.length) void sb().storage.from(BUCKET).remove(uploaded.map((m) => m.path));
    throw new Error(
      error.code === "42501" ? "Add your dog to your profile before posting." : error.message
    );
  }
  if (uploaded.length) {
    const { error: mediaError } = await sb()
      .from("post_media")
      .insert(uploaded.map((m, i) => ({ post_id: post.id, url: m.url, kind: m.type, path: m.path, sort_order: i })));
    if (mediaError) {
      await sb().from("posts").delete().eq("id", post.id);
      throw mediaError;
    }
  }
}

/** Your own post's words (a trainer can change anyone's). */
export async function updatePostText(postId: string, title: string, body: string): Promise<void> {
  const { error } = await sb().from("posts").update({ title: title || null, body }).eq("id", postId);
  if (error) throw error;
}

/** Trainers only — the database ignores it from anyone else. */
export async function setPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await sb().from("posts").update({ pinned }).eq("id", postId);
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { data: media } = await sb().from("post_media").select("path").eq("post_id", postId);
  const { error } = await sb().from("posts").delete().eq("id", postId);
  if (error) throw error;
  const paths = (media ?? []).map((m) => m.path as string | null).filter((p): p is string => !!p);
  // Best-effort tidy-up of the files (your own folder, or any for a trainer).
  if (paths.length) void sb().storage.from(BUCKET).remove(paths);
}

export async function setLiked(viewerId: string, postId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await sb().from("post_likes").upsert({ post_id: postId, account_id: viewerId }, { ignoreDuplicates: true })
    : await sb().from("post_likes").delete().eq("post_id", postId).eq("account_id", viewerId);
  if (error) throw error;
}

export async function addComment(viewer: Viewer, postId: string, body: string): Promise<Comment> {
  const { data, error } = await sb()
    .from("post_comments")
    .insert({ post_id: postId, author_id: viewer.id, body })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.code === "42501" ? "Add your dog to your profile before commenting." : error.message);
  return {
    id: data.id,
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatarUrl: viewer.avatarUrl,
    authorIsTrainer: viewer.isTrainer,
    body,
    createdAt: data.created_at,
    createdAtLabel: "Just now",
    isMine: true,
    canDelete: true,
    edited: false,
  };
}

export async function updateComment(commentId: string, body: string): Promise<void> {
  const { error } = await sb().from("post_comments").update({ body }).eq("id", commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await sb().from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

/** Flag a post or comment to the trainers. */
export async function reportContent(
  target: { postId: string } | { commentId: string },
  reason: ReportReason,
  details?: string
): Promise<void> {
  const { error } = await sb()
    .from("post_reports")
    .insert({
      post_id: "postId" in target ? target.postId : null,
      comment_id: "commentId" in target ? target.commentId : null,
      reason,
      details: details?.trim() || null,
    });
  if (error) throw error;
}

/** Hide everything by this member from the viewer. They aren't told. */
export async function blockUser(viewerId: string, authorId: string): Promise<void> {
  const { error } = await sb()
    .from("community_blocks")
    .upsert({ blocker_id: viewerId, blocked_id: authorId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.code === "42501" ? "You can't block the Nelly & Nova team." : error.message);
}

export async function unblockUser(viewerId: string, authorId: string): Promise<void> {
  const { error } = await sb().from("community_blocks").delete().eq("blocker_id", viewerId).eq("blocked_id", authorId);
  if (error) throw error;
}
