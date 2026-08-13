"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSession, accountDisplayName, accountAvatar } from "@/lib/auth/session";
import { useCommunityOverlay, mergeFeed } from "@/lib/community/store";
import type { Post } from "@/lib/community/types";
import { PostComposer } from "./PostComposer";
import { PostCard } from "./PostCard";

/** Composer + feed, mirroring the reference layout (max-w-2xl, divided feed). */
export function CommunityFeed({ initial }: { initial: Post[] }) {
  const session = useSession();
  const overlay = useCommunityOverlay();

  // In the community an account is known by its dog(s) — "Nova & Rex" — not the
  // owner's name. New posts and comments are authored under that.
  const user = session
    ? { name: accountDisplayName(session), avatarUrl: accountAvatar(session) }
    : null;

  const posts = useMemo(() => mergeFeed(initial, overlay), [initial, overlay]);

  return (
    <div>
      {user ? (
        <PostComposer user={user} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-paper/80">Log in to share and comment.</p>
          <Link
            href="/login"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col divide-y divide-white/10">
        {posts.map((post) => (
          <div key={post.id} className="py-6 first:pt-0">
            <PostCard post={post} user={user} />
          </div>
        ))}
      </div>
    </div>
  );
}
