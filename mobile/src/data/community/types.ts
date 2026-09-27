/**
 * Community feed — posts owners share with photos/videos, likes and comments.
 * Shaped after the Kanvas app's student-home Post; the backend maps these to
 * `posts` / `post_media` / `post_likes` / `post_comments`.
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
  body: string;
  createdAt: string; // ISO
  isMine?: boolean;
  /** Your own, or anyone's for a trainer. */
  canDelete?: boolean;
  edited?: boolean;
};

/** A dog on the posting account, with its training level (for the badge). */
export type AuthorDog = { name: string; level: number };

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  /** Posted by the Nelly & Nova team — shows the OFFICIAL tag. */
  authorIsTrainer?: boolean;
  authorDogs?: AuthorDog[];
  pinned?: boolean;
  /** Whether the signed-in user wrote it. */
  isMine?: boolean;
  canDelete?: boolean;
  title?: string;
  body: string;
  media: MediaItem[];
  createdAt: string; // ISO
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
};

export type NewPost = { title: string; body: string; media: MediaItem[]; pinned?: boolean };
