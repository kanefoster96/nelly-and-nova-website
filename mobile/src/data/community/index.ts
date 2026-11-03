/**
 * Community feed, backed by Supabase.
 * -----------------------------------
 * Row Level Security does the gatekeeping (supabase/migrations/
 * 20261104010000_community.sql): members read everything, post, like and
 * comment, and edit or delete only their own; trainers can do everything,
 * including pinning. A blocked member's posts and comments never come back.
 * Photos and videos go to the public `media` bucket under the user's own
 * folder. The website has the same functions in lib/community/data.ts.
 */
import { supabase } from "@/lib/supabase";

import type { Comment, NewPost, PickedMedia, Post, Viewer } from "./types";

export type { Comment, MediaItem, NewPost, PickedMedia, Post, Viewer } from "./types";

const BUCKET = "media";
const FEED_LIMIT = 50;
/** The trainers post as the business, with its logo (served by the website). */
export const TRAINER_AVATAR = "/brand/nn-icon.svg";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const month = MONTHS[Number(get("month")) - 1];
    if (!month) throw new Error("no month");
    return `${get("weekday")} ${get("day")} ${month} · ${get("hour").padStart(2, "0")}:${get("minute")}`;
  } catch {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} · ${hh}:${mm}`;
  }
}

type Author = { id: string; name: string; avatar_url: string | null; is_trainer: boolean };

async function loadAuthors(ids: string[]): Promise<Map<string, Author>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.rpc("nn_community_authors", { p_ids: unique });
  if (error) throw error;
  return new Map(((data ?? []) as Author[]).map((a) => [a.id, a]));
}

function authorAvatar(a: Author | undefined): string | undefined {
  if (!a) return undefined;
  return a.avatar_url || (a.is_trainer ? TRAINER_AVATAR : undefined);
}

/** The signed-in account, as the community shows it (dog names, avatar, guidelines). */
export async function getViewer(userId: string, isTrainer: boolean): Promise<Viewer> {
  const [{ data: profile }, authors] = await Promise.all([
    supabase.from("profiles").select("community_guidelines_accepted_at").eq("id", userId).maybeSingle(),
    loadAuthors([userId]),
  ]);
  const me = authors.get(userId);
  return {
    id: userId,
    name: me?.name ?? (isTrainer ? "Nelly & Nova" : "Member"),
    avatarUrl: authorAvatar(me) ?? null,
    isTrainer,
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

/** Pinned first, then newest. Fills in what the viewer may do with each post. */
export async function getFeed(viewer: Pick<Viewer, "id" | "isTrainer">): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, body, pinned, created_at, post_media(url, kind, sort_order), post_likes(account_id), post_comments(id, author_id, body, created_at, edited_at)"
    )
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
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
      pinned: !!p.pinned,
      isMine: p.author_id === viewer.id,
      canDelete: p.author_id === viewer.id || viewer.isTrainer,
      title: p.title || undefined,
      body: p.body ?? "",
      media: [...p.post_media]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({ type: m.kind === "video" ? ("video" as const) : ("image" as const), url: m.url })),
      createdAt: p.created_at,
      createdAtLabel: formatPostTimestamp(p.created_at),
      likeCount: p.post_likes.length,
      likedByMe: p.post_likes.some((l) => l.account_id === viewer.id),
      comments,
    };
  });
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Uploads a picked photo/video to media/<uid>/… and returns its public URL and path. */
async function uploadMedia(userId: string, item: PickedMedia): Promise<{ url: string; path: string; kind: "image" | "video" }> {
  const fromUri = item.uri.split("?")[0].split(".").pop();
  const ext = (fromUri && fromUri.length <= 5 && !fromUri.includes("/") ? fromUri : item.mimeType.split("/").pop() || "bin").toLowerCase();
  const path = `${userId}/${randomId()}.${ext}`;
  // fetch() reads a local file:// URI without needing another native module.
  const bytes = await (await fetch(item.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: item.mimeType });
  if (error) throw new Error(error.message || "Couldn't upload that file.");
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path, kind: item.kind };
}

/** Stamp the one-time Community Guidelines agreement. */
export async function acceptGuidelines(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ community_guidelines_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function createPost(viewer: Viewer, input: NewPost): Promise<void> {
  const uploaded = await Promise.all(input.media.map((m) => uploadMedia(viewer.id, m)));
  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: viewer.id, title: input.title || null, body: input.body, pinned: viewer.isTrainer && !!input.pinned })
    .select("id")
    .single();
  if (error) {
    if (uploaded.length) void supabase.storage.from(BUCKET).remove(uploaded.map((m) => m.path));
    throw new Error(error.code === "42501" ? "Add your dog to your profile before posting." : error.message);
  }
  if (uploaded.length) {
    const { error: mediaError } = await supabase
      .from("post_media")
      .insert(uploaded.map((m, i) => ({ post_id: post.id, url: m.url, kind: m.kind, path: m.path, sort_order: i })));
    if (mediaError) {
      await supabase.from("posts").delete().eq("id", post.id);
      throw mediaError;
    }
  }
}

/** Your own post's words (a trainer can change anyone's). */
export async function updatePost(postId: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.from("posts").update({ title: title || null, body }).eq("id", postId);
  if (error) throw error;
}

/** Trainers only — the database ignores it from anyone else. */
export async function setPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId);
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { data: media } = await supabase.from("post_media").select("path").eq("post_id", postId);
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
  const paths = (media ?? []).map((m) => m.path as string | null).filter((p): p is string => !!p);
  // Best-effort tidy-up of the files (your own folder, or any for a trainer).
  if (paths.length) void supabase.storage.from(BUCKET).remove(paths);
}

export async function setLiked(viewerId: string, postId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from("post_likes").upsert({ post_id: postId, account_id: viewerId }, { ignoreDuplicates: true })
    : await supabase.from("post_likes").delete().eq("post_id", postId).eq("account_id", viewerId);
  if (error) throw error;
}

export async function addComment(viewer: Viewer, postId: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: viewer.id, body })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.code === "42501" ? "Add your dog to your profile before commenting." : error.message);
  return {
    id: data.id,
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatarUrl: viewer.avatarUrl ?? undefined,
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
  const { error } = await supabase.from("post_comments").update({ body }).eq("id", commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Bullying or harassment" },
  { value: "inappropriate", label: "Inappropriate or offensive" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** Report a post or comment to the trainers (App Store guideline 1.2 for user content). */
export async function reportContent(target: { postId: string } | { commentId: string }, reason: ReportReason): Promise<void> {
  const { error } = await supabase.from("post_reports").insert({
    post_id: "postId" in target ? target.postId : null,
    comment_id: "commentId" in target ? target.commentId : null,
    reason,
  });
  if (error) throw error;
}

/** Hide everything by this member from the viewer. They aren't told. */
export async function blockUser(viewerId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("community_blocks").upsert({ blocker_id: viewerId, blocked_id: userId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.code === "42501" ? "You can't block the Nelly & Nova team." : error.message);
}
