/**
 * Community feed — posts accounts share with photos/videos, likes and
 * comments. Shaped after the Kanvas app's Student Home `Post`; read from and
 * written to `posts` / `post_media` / `post_likes` / `post_comments`
 * (supabase/migrations/20261104010000_community.sql).
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
  /** Kept at the top of the feed by a trainer. */
  pinned: boolean;
  /** Whether the signed-in user wrote it. */
  isMine: boolean;
  canDelete: boolean;
  title?: string;
  body: string;
  media: MediaItem[];
  createdAt: string; // ISO
  /** "Tue 3 Nov · 14:05", in UK time. */
  createdAtLabel: string;
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};

/** A photo or video picked from the library, not uploaded yet. */
export type PickedMedia = { uri: string; mimeType: string; kind: "image" | "video" };

export type NewPost = { title: string; body: string; media: PickedMedia[]; pinned?: boolean };

/** The signed-in account, as the community shows it. */
export type Viewer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isTrainer: boolean;
  /** False until this account has agreed to the Community Guidelines once. */
  guidelinesAccepted: boolean;
};
