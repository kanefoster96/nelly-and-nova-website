"use client";

/**
 * Community feed store (scaffold — localStorage).
 * -----------------------------------------------
 * Holds an overlay on top of the sample posts: new posts the user creates,
 * their like toggles, added comments, and deletions. The feed component merges
 * this with the base posts. Client-only stand-in for lib/community/data.ts.
 */
import { useSyncExternalStore } from "react";
import type { Comment, Post } from "./types";
import { createPost, deletePost, toggleLike, addComment } from "./data";

export type CommunityOverlay = {
  posts: Post[];
  likes: Record<string, boolean>;
  comments: Record<string, Comment[]>;
  deleted: string[];
};

const EMPTY: CommunityOverlay = { posts: [], likes: {}, comments: {}, deleted: [] };
const KEY = "nn-community";
const EVENT = "nn-community-change";

function read(): CommunityOverlay {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as CommunityOverlay) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(o: CommunityOverlay) {
  localStorage.setItem(KEY, JSON.stringify(o));
  window.dispatchEvent(new Event(EVENT));
}

export function addPost(post: Post) {
  const o = read();
  write({ ...o, posts: [post, ...o.posts] });
  void createPost(post);
}

export function removePost(postId: string) {
  const o = read();
  write({
    ...o,
    posts: o.posts.filter((p) => p.id !== postId),
    deleted: o.deleted.includes(postId) ? o.deleted : [...o.deleted, postId],
  });
  void deletePost(postId);
}

export function setLike(postId: string, liked: boolean) {
  const o = read();
  write({ ...o, likes: { ...o.likes, [postId]: liked } });
  void toggleLike(postId, liked);
}

export function pushComment(postId: string, comment: Comment) {
  const o = read();
  write({ ...o, comments: { ...o.comments, [postId]: [...(o.comments[postId] ?? []), comment] } });
  void addComment(postId, comment);
}

/** Merge the overlay onto the base posts — newest first, deletions removed. */
export function mergeFeed(base: Post[], o: CommunityOverlay): Post[] {
  return [...o.posts, ...base]
    .filter((p) => !o.deleted.includes(p.id))
    .map((p) => {
      const likedByMe = o.likes[p.id] ?? p.likedByMe;
      const delta = (likedByMe ? 1 : 0) - (p.likedByMe ? 1 : 0);
      const extra = o.comments[p.id] ?? [];
      return {
        ...p,
        likedByMe,
        likeCount: p.likeCount + delta,
        comments: extra.length ? [...p.comments, ...extra] : p.comments,
      };
    });
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: CommunityOverlay = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): CommunityOverlay {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function getServerSnapshot(): CommunityOverlay {
  return EMPTY;
}

export function useCommunityOverlay(): CommunityOverlay {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
