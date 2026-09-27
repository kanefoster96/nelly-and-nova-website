import type { Comment, NewPost, Post } from "./types";
import { sampleCommunityPosts } from "./sample";

export type { Comment, MediaItem, NewPost, Post } from "./types";

type Viewer = { id: string; name: string; avatarUrl?: string | null; isTrainer: boolean };

/** Pinned first, then newest. Fills in what the viewer may do with each post. */
export async function getFeed(viewer: Viewer): Promise<Post[]> {
  // TODO(backend): select posts + post_media + like counts + comments (minus blocked authors).
  return sampleCommunityPosts
    .map((p) => {
      const isMine = p.authorId === viewer.id;
      return {
        ...p,
        isMine,
        canDelete: isMine || viewer.isTrainer,
        comments: p.comments.map((c) => ({ ...c, isMine: c.authorId === viewer.id, canDelete: c.authorId === viewer.id || viewer.isTrainer })),
      };
    })
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

export async function createPost(viewer: Viewer, input: NewPost): Promise<Post> {
  // TODO(backend): upload media to storage, insert into posts + post_media.
  return {
    id: `local-${Date.now()}`,
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatarUrl: viewer.avatarUrl ?? undefined,
    authorIsTrainer: viewer.isTrainer,
    pinned: viewer.isTrainer && input.pinned,
    isMine: true,
    canDelete: true,
    title: input.title || undefined,
    body: input.body,
    media: input.media,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    likedByMe: false,
    comments: [],
  };
}

export async function updatePost(postId: string, title: string, body: string): Promise<void> {
  // TODO(backend): update posts set title, body where id = $1 (own post only).
  void postId;
  void title;
  void body;
}

export async function deletePost(postId: string): Promise<void> {
  // TODO(backend): delete from posts where id = $1 (own post, or trainer).
  void postId;
}

export async function setLiked(postId: string, liked: boolean): Promise<void> {
  // TODO(backend): insert/delete post_likes (post_id, user_id = auth.uid()).
  void postId;
  void liked;
}

export async function addComment(viewer: Viewer, postId: string, body: string): Promise<Comment> {
  // TODO(backend): insert into post_comments (post_id, author_id, body).
  void postId;
  return {
    id: `local-${Date.now()}`,
    authorId: viewer.id,
    authorName: viewer.name,
    authorAvatarUrl: viewer.avatarUrl ?? undefined,
    body,
    createdAt: new Date().toISOString(),
    isMine: true,
    canDelete: true,
  };
}

export async function updateComment(commentId: string, body: string): Promise<void> {
  // TODO(backend): update post_comments set body where id = $1 (own comment only).
  void commentId;
  void body;
}

export async function deleteComment(commentId: string): Promise<void> {
  // TODO(backend): delete from post_comments where id = $1.
  void commentId;
}

export type ReportReason = "spam" | "abuse" | "inappropriate" | "other";
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Bullying or abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

/** Report a post or comment to the trainers (App Store guideline 1.2 for user content). */
export async function reportContent(target: { postId: string } | { commentId: string }, reason: ReportReason): Promise<void> {
  // TODO(backend): insert into content_reports and notify trainers.
  void target;
  void reason;
}

/** Hide everything by this member from the viewer. */
export async function blockUser(userId: string): Promise<void> {
  // TODO(backend): insert into blocked_users (blocker_id = auth.uid(), blocked_id = $1).
  void userId;
}

/** "11 Aug" / "Yesterday" / "3h" — the time under a post author's name. */
export function postTimeLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return "Yesterday";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}
