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

/** A dog on the posting account, with its training level (for the badge). */
export type AuthorDog = { name: string; level: number };

export type Post = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** The account's dog(s) + level, shown as level badges under the name.
   * In order of the name ("Nova & Rex" → Nova's level, then Rex's). */
  authorDogs?: AuthorDog[];
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
