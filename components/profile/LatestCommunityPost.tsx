"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { useSession, useAuthStatus, accountDisplayName } from "@/lib/auth/session";
import { getMyLatestPost, getViewer } from "@/lib/community/data";
import type { Post } from "@/lib/community/types";

/**
 * The account's latest community post, shown on their profile. If they haven't
 * posted yet, a friendly nudge invites them to share their first so everyone
 * can meet their dog(s). Tapping either opens the community.
 */
export function LatestCommunityPost() {
  const session = useSession();
  const status = useAuthStatus();
  const accountName = accountDisplayName(session);
  const [mine, setMine] = useState<Post | null>(null);

  // Their newest post, from Supabase, once auth has resolved.
  useEffect(() => {
    if (status !== "authed") return;
    let live = true;
    (async () => {
      try {
        const viewer = await getViewer();
        const post = viewer ? await getMyLatestPost(viewer) : null;
        if (live) setMine(post);
      } catch {
        // Leave the "share your first post" nudge in place.
      }
    })();
    return () => {
      live = false;
    };
  }, [status]);

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Community
      </h2>

      {mine ? (
        <Link
          href="/community"
          className="block rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition-colors hover:ring-white/25"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-paper-dim">
            Your latest post
          </p>
          <div className="mt-2 flex items-start gap-3">
            {mine.media[0]?.type === "image" && (
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mine.media[0].url} alt="" className="h-full w-full object-cover" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {mine.title && (
                <p className="truncate text-sm font-semibold text-paper">{mine.title}</p>
              )}
              <p className="line-clamp-2 text-sm text-paper/80">{mine.body}</p>
              <p className="mt-1 flex items-center gap-3 text-xs text-paper-dim">
                <span>
                  {mine.likeCount} {mine.likeCount === 1 ? "like" : "likes"}
                </span>
                <span>
                  {mine.comments.length}{" "}
                  {mine.comments.length === 1 ? "comment" : "comments"}
                </span>
              </p>
            </div>
            <ArrowRightIcon width={16} height={16} className="mt-1 shrink-0 text-paper-dim" />
          </div>
        </Link>
      ) : (
        <Link
          href="/community"
          className="block rounded-2xl bg-white/[0.04] p-5 text-center ring-1 ring-white/10 transition-colors hover:ring-white/25"
        >
          <p className="text-sm font-semibold text-paper">Share your first post</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-paper-dim">
            Post a photo and let everyone meet {accountName || "your dog"}! 🐾
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Say hello <ArrowRightIcon width={16} height={16} />
          </span>
        </Link>
      )}
    </div>
  );
}
