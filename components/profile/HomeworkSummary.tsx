"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircleIcon, CloseIcon, ArrowRightIcon } from "@/components/ui/Icons";

/**
 * Missed-homework nudge. The homework percentage itself lives in the header
 * stats; when it's under 100% this explains that some homework was missed and
 * points the owner to book a 1-1 (which the trainer can use to reset to 100%).
 * Renders nothing when homework is fully complete.
 */
export function HomeworkSummary({ percent }: { percent: number }) {
  const [open, setOpen] = useState(false);
  if (percent >= 100) return null;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper">
        <HelpCircleIcon width={18} height={18} />
      </span>
      <p className="min-w-0 flex-1 text-sm text-paper/85">
        Some homework was missed.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-paper hover:border-white/40"
      >
        Learn more
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl bg-ink p-6 ring-1 ring-white/15 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="display-heading text-xl text-paper">Homework missed</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </div>
            <p className="mt-3 text-sm text-paper/80">
              It looks like some homework was missed. Book a 1-1 with us and we&apos;ll
              go through it together — and reset your homework back to 100%.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/one-to-one"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                Book a 1-1 <ArrowRightIcon width={16} height={16} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-2 text-sm text-paper-dim hover:text-paper"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
