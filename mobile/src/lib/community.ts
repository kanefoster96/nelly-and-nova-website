/**
 * Community feed data access — real Supabase tables (`posts`, `post_media`,
 * `post_likes`, `post_comments`), same project/tables the website's
 * lib/community is designed around (see lib/community/types.ts there).
 *
 * An account is known in the community by its dog(s) — "Nova" or "Nova &
 * Rex" — not the owner's name, so every query joins back to `dogs` for
 * display. RLS (see the "community_feed_access" migration) lets any
 * signed-in member read any account's dogs for this, but only accounts with
 * an active membership (a dog on the account) may insert a post or comment.
 */
import { supabase } from "@/lib/supabase";
import { joinNames } from "@/lib/session";

export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  media: string[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  comments: Comment[];
  /** Whether the signed-in account wrote it (can delete it later). */
  mine: boolean;
};

type AuthorDog = { name: string; photo: string };

/** dogs.account_id -> that account's dogs, for authors appearing in a query. */
async function dogsByAccount(accountIds: string[]): Promise<Map<string, AuthorDog[]>> {
  const map = new Map<string, AuthorDog[]>();
  const ids = [...new Set(accountIds)];
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from("dogs")
    .select("account_id, name, photo_url")
    .in("account_id", ids)
    .order("sort_order");

  for (const d of data ?? []) {
    const list = map.get(d.account_id) ?? [];
    list.push({ name: d.name ?? "", photo: d.photo_url ?? "" });
    map.set(d.account_id, list);
  }
  return map;
}

function authorDisplay(dogs: AuthorDog[]): { name: string; avatar: string } {
  return {
    name: joinNames(dogs.map((d) => d.name)) || "A member",
    avatar: dogs[0]?.photo ?? "",
  };
}

type RawComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function mapComments(rows: RawComment[], dogs: Map<string, AuthorDog[]>): Comment[] {
  return rows
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => {
      const { name, avatar } = authorDisplay(dogs.get(c.author_id) ?? []);
      return {
        id: c.id,
        authorId: c.author_id,
        authorName: name,
        authorAvatar: avatar,
        body: c.body,
        createdAt: c.created_at,
      };
    });
}

/** The whole feed, newest first — posts, their media, likes and comments. */
export async function getFeed(): Promise<Post[]> {
  const [{ data: posts, error }, {
    data: { user },
  }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, body, created_at, author_id, post_media(url, sort_order), post_likes(account_id), post_comments(id, post_id, author_id, body, created_at)"
      )
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (error || !posts) return [];

  const authorIds = posts.flatMap((p) => [
    p.author_id,
    ...(p.post_comments ?? []).map((c) => c.author_id),
  ]);
  const dogs = await dogsByAccount(authorIds);

  return posts.map((p) => {
    const { name, avatar } = authorDisplay(dogs.get(p.author_id) ?? []);
    const likes = p.post_likes ?? [];
    return {
      id: p.id,
      authorId: p.author_id,
      authorName: name,
      authorAvatar: avatar,
      body: p.body ?? "",
      media: (p.post_media ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => m.url),
      createdAt: p.created_at,
      likeCount: likes.length,
      likedByMe: likes.some((l) => l.account_id === user?.id),
      comments: mapComments(p.post_comments ?? [], dogs),
      mine: p.author_id === user?.id,
    };
  });
}

/** Start a post. Requires an active membership — enforced by RLS, not just the UI. */
export async function createPost(body: string): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("posts").insert({ author_id: user.id, body: body.trim() });
  return { error: error?.message ?? null };
}

export async function addComment(postId: string, body: string): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: user.id, body: body.trim() });
  return { error: error?.message ?? null };
}

export async function setLike(postId: string, liked: boolean): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = liked
    ? await supabase.from("post_likes").insert({ post_id: postId, account_id: user.id })
    : await supabase.from("post_likes").delete().eq("post_id", postId).eq("account_id", user.id);
  return { error: error?.message ?? null };
}
