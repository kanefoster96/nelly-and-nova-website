"use client";

import Link from "next/link";
import { Footer } from "../Footer";
import { ReportIcon, PawIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import { useUnseenReportCount } from "@/lib/reports/seen";
import { CommunityFeed } from "./CommunityFeed";
import type { Post } from "@/lib/community/types";

/**
 * The scheduled member's home: their dog's avatar and quick actions (report
 * cards, dog profile) above the community feed. Shown in place of the marketing
 * homepage by HomeGate.
 */
export function CommunityHome({ posts }: { posts: Post[] }) {
  const session = useSession();
  const unseen = useUnseenReportCount(session?.dogId);
  const dogName = session?.dogName || "your dog";
  const photo = session?.dogPhoto;

  return (
    <>
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            {/* Personalised header — dog avatar + quick actions */}
            <div className="flex items-center gap-4">
              {photo ? (
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={dogName} className="h-full w-full object-cover" />
                </span>
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-paper">
                  {dogName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="display-heading text-2xl text-paper">Welcome back</h1>
                <p className="text-sm text-paper-dim">{dogName}&apos;s community</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                href="/profile/reports"
                className="relative flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition-colors hover:ring-white/25"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                  <ReportIcon width={20} height={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-paper">Report cards</span>
                  <span className="block text-xs text-paper-dim">Training progress</span>
                </span>
                {unseen > 0 && (
                  <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unseen}
                  </span>
                )}
              </Link>

              <Link
                href="/profile"
                className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition-colors hover:ring-white/25"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                  <PawIcon width={20} height={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-paper">Dog&apos;s profile</span>
                  <span className="block text-xs text-paper-dim">Details &amp; plan</span>
                </span>
              </Link>
            </div>

            {/* Community feed */}
            <div className="mt-8">
              <CommunityFeed initial={posts} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
