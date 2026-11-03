"use client";

import Link from "next/link";
import { useCommunityFeed } from "@/lib/community/store";
import { PostComposer } from "./PostComposer";
import { PostCard } from "./PostCard";

/**
 * Composer + feed, the Kanvas Student Home layout (max-w-2xl, divided feed),
 * live from Supabase. The community is for signed-in accounts only.
 */
export function CommunityFeed() {
  const { viewer, posts, error, loading, reload, setPosts, markGuidelinesAccepted } = useCommunityFeed();

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/10" />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-28 rounded bg-white/10" />
                <div className="h-2.5 w-20 rounded bg-white/5" />
              </div>
            </div>
            <div className="mt-4 h-3 w-full rounded bg-white/5" />
            <div className="mt-2 h-3 w-2/3 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm text-paper/80">Log in to see the community, share and comment.</p>
        <Link
          href="/login?next=/community"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PostComposer viewer={viewer} onPosted={() => void reload()} onGuidelinesAccepted={markGuidelinesAccepted} />

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}{" "}
          <button type="button" onClick={() => void reload()} className="underline underline-offset-2">
            Try again
          </button>
        </p>
      )}

      <div className="mt-6 flex flex-col divide-y divide-white/10">
        {(posts ?? []).length === 0 ? (
          <p className="py-12 text-center text-paper-dim">No posts yet — be the first to share something.</p>
        ) : (
          (posts ?? []).map((post) => (
            <div key={post.id} id={`post-${post.id}`} className="scroll-mt-20 py-6 first:pt-0">
              <PostCard
                post={post}
                viewer={viewer}
                onGuidelinesAccepted={markGuidelinesAccepted}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPinnedChange={() => void reload()}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
