"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HelpCircleIcon, CloseIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkProgress } from "@/lib/reports/progress";
import { useHomeworkResets, resetAtFor } from "@/lib/reports/reset";
import { dogCompletion } from "@/lib/reports/completion";

/**
 * All-time homework completion for the active dog, shown as a percentage. When
 * it's under 100% a small info button explains that homework was missed and
 * points the owner to book a 1-1 (which the trainer can use to reset to 100%).
 */
export function HomeworkSummary({ dogId }: { dogId?: string }) {
  const outbox = useOutboxCards();
  const progress = useHomeworkProgress();
  const resets = useHomeworkResets();
  const [open, setOpen] = useState(false);

  const { percent } = useMemo(() => {
    const byId = new Map<string, (typeof sampleReportCards)[number]>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    return dogCompletion([...byId.values()], progress, dogId, resetAtFor(resets, dogId));
  }, [outbox, progress, resets, dogId]);

  return (
    <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-paper/90">Homework completed</p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-paper">{percent}%</span>
          {percent < 100 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Why isn't my homework at 100%?"
              className="flex h-6 w-6 items-center justify-center rounded-full text-paper-dim hover:text-paper"
            >
              <HelpCircleIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${percent >= 100 ? "bg-accent" : "bg-accent/70"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-paper-dim">All-time across your report cards</p>

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
