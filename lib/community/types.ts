/**
 * Community feed — posts accounts share with photos/videos, likes and
 * comments. Shaped after the Kanvas Academy Student Home `PostData`; read from
 * and written to `posts` / `post_media` / `post_likes` / `post_comments`
 * (see lib/community/data.ts and supabase/migrations/20261104010000_community.sql).
 *
 * An account is shown by its dogs' names ("Nova & Rex"); a trainer as
 * "Nelly & Nova" with the official tick.
 */
export type MediaItem = {
  type: "image" | "video";
  url: string;
};

export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** A trainer: the official tick by their name. */
  authorIsTrainer: boolean;
  body: string;
  createdAt: string; // ISO
  /** "Tue 3 Nov · 14:05", in UK time. */
  createdAtLabel: string;
  isMine: boolean;
  /** Your own, or anyone's for a trainer. */
  canDelete: boolean;
  /** Changed by its author since it was posted — shown as "edited". */
  edited: boolean;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** Posted by the Nelly & Nova team — the official tick. */
  authorIsTrainer: boolean;
  title?: string;
  body: string;
  media: MediaItem[];
  createdAt: string; // ISO
  createdAtLabel: string;
  /** Kept at the top of the feed by a trainer. */
  pinned: boolean;
  isMine: boolean;
  canDelete: boolean;
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};

/** The signed-in account, as the community shows it. */
export type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string;
  isTrainer: boolean;
  /** False until this account has agreed to the Community Guidelines once. */
  guidelinesAccepted: boolean;
};

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Bullying or harassment" },
  { value: "inappropriate", label: "Inappropriate or offensive" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
