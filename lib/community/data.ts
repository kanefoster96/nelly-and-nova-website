/**
 * Community feed backend seam (scaffold).
 * ---------------------------------------
 * Client-callable stand-ins. Today they log; the store calls them alongside its
 * local write so the wiring is ready for Supabase.
 */
import type { Comment, MediaItem, Post } from "./types";

export async function createPost(post: Post): Promise<void> {
  // TODO(backend): insert into posts (author_id, title, body); upload each
  // media item to Storage and insert post_media rows.
  console.log(`[community] post created ${post.id} (${post.media.length} media) (scaffold)`);
}

export async function deletePost(postId: string): Promise<void> {
  // TODO(backend): delete from posts where id = $1 and author_id = auth.uid().
  console.log(`[community] post deleted ${postId} (scaffold)`);
}

export async function toggleLike(postId: string, liked: boolean): Promise<void> {
  // TODO(backend): insert/delete post_likes (post_id, user_id).
  console.log(`[community] like ${postId} → ${liked} (scaffold)`);
}

export async function addComment(postId: string, comment: Comment): Promise<void> {
  // TODO(backend): insert into post_comments (post_id, author_id, body).
  console.log(`[community] comment ${comment.id} on ${postId} (scaffold)`);
}

/** Read a File as a data URL — stand-in for uploading to Storage. */
export function fileToMedia(file: File): Promise<MediaItem> {
  const type: MediaItem["type"] = file.type.startsWith("video") ? "video" : "image";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type, url: String(reader.result) });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
