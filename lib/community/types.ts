/**
 * Community feed — posts owners share with photos/videos, likes and comments.
 * Scaffold types; the backend maps these to `posts` / `post_media` /
 * `post_likes` / `post_comments` (see lib/community/data.ts).
 */
export type MediaItem = {
  type: "image" | "video";
  url: string; // a hosted URL, or a data: URL in the scaffold
};

export type Comment = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string; // ISO
};

export type Post = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** Whether the signed-in user wrote it (can delete it). */
  mine?: boolean;
  title?: string;
  body: string;
  media: MediaItem[];
  createdAt: string; // ISO
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};
