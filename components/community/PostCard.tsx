"use client";

import { useState } from "react";
import { HeartIcon, MoreIcon, TrashIcon } from "@/components/ui/Icons";
import { Avatar } from "./Avatar";
import { setLike, pushComment, removePost } from "@/lib/community/store";
import type { Comment, MediaItem, Post } from "@/lib/community/types";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deterministic "11 Aug 2026 · 08:20" from an ISO string (no relative time). */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${yr} · ${hh}:${mm}`;
}

const BODY_LIMIT = 220;

export function PostCard({
  post,
  user,
}: {
  post: Post;
  user: { name: string; avatarUrl?: string } | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const long = post.body.length > BODY_LIMIT;
  const shownBody = long && !showAll ? post.body.slice(0, BODY_LIMIT).trimEnd() + "…" : post.body;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
          <div>
            <p className="text-sm font-medium text-paper">{post.authorName}</p>
            <p className="text-xs text-paper-dim">{formatWhen(post.createdAt)}</p>
          </div>
        </div>
        {post.mine && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Post options"
              className="flex h-8 w-8 items-center justify-center rounded-full text-paper-dim hover:bg-white/5 hover:text-paper"
            >
              <MoreIcon className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-xl bg-ink-raised ring-1 ring-white/15">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    removePost(post.id);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-red-300 hover:bg-white/5"
                >
                  <TrashIcon className="h-4 w-4" /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      {post.title && <h3 className="mt-4 text-base font-semibold text-paper">{post.title}</h3>}

      {/* Body */}
      {post.body && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-paper/90">
          {shownBody}
          {long && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="ml-1 font-medium text-accent"
            >
              {showAll ? "See less" : "See more"}
            </button>
          )}
        </p>
      )}

      {/* Media */}
      <MediaGrid media={post.media} />

      {/* Like */}
      <div className="mt-4 flex items-center gap-3">
        <LikeButton postId={post.id} likeCount={post.likeCount} likedByMe={post.likedByMe} />
      </div>

      {/* Comments */}
      <CommentsSection postId={post.id} comments={post.comments} user={user} />
    </div>
  );
}

function MediaGrid({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    const item = media[0];
    return (
      <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-white/10">
        {item.type === "video" ? (
          <video src={item.url} controls className="block w-full bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="block w-full" />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl ring-1 ring-white/10">
      {media.map((item, i) =>
        item.type === "video" ? (
          <video key={i} src={item.url} controls className="aspect-square w-full bg-black object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={item.url} alt="" className="aspect-square w-full object-cover" />
        )
      )}
    </div>
  );
}

function LikeButton({
  postId,
  likeCount,
  likedByMe,
}: {
  postId: string;
  likeCount: number;
  likedByMe: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => setLike(postId, !likedByMe)}
      aria-pressed={likedByMe}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        likedByMe
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-white/10 text-paper-dim hover:border-white/30 hover:text-paper"
      }`}
    >
      <HeartIcon filled={likedByMe} className="h-4 w-4" />
      {likeCount > 0 ? likeCount : "Like"}
    </button>
  );
}

function CommentsSection({
  postId,
  comments,
  user,
}: {
  postId: string;
  comments: Comment[];
  user: { name: string; avatarUrl?: string } | null;
}) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    pushComment(postId, {
      id: `c-${crypto.randomUUID()}`,
      authorName: user.name,
      authorAvatarUrl: user.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
    });
    setText("");
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
      {comments.length > 0 && (
        <p className="text-sm font-medium text-paper-dim">
          {comments.length} Comment{comments.length === 1 ? "" : "s"}
        </p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={c.authorName} avatarUrl={c.authorAvatarUrl} size="sm" />
          <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-2">
            <p className="text-sm font-medium text-paper">{c.authorName}</p>
            <p className="text-sm text-paper/80">{c.body}</p>
            <p className="mt-1 text-xs text-paper-dim/70">{formatWhen(c.createdAt)}</p>
          </div>
        </div>
      ))}

      {user ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-paper outline-none placeholder:text-paper-dim focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-paper transition-colors hover:border-white/40 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="text-sm text-paper-dim">Log in to join the conversation.</p>
      )}
    </div>
  );
}
