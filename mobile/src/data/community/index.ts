import type { Comment, Post } from "./types";
import { sampleCommunityPosts } from "./sample";

export type { Comment, Post } from "./types";

export async function getFeed(): Promise<Post[]> {
  // TODO(backend): select posts + post_media + like counts + comments, newest first.
  return sampleCommunityPosts;
}

export async function setLiked(postId: string, liked: boolean): Promise<void> {
  // TODO(backend): insert/delete post_likes (post_id, user_id = auth.uid()).
  void postId;
  void liked;
}

export async function addComment(postId: string, comment: Comment): Promise<void> {
  // TODO(backend): insert into post_comments (post_id, author_id, body).
  void postId;
  void comment;
}
