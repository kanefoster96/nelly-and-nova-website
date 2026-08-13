"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CheckCircleIcon, CloseIcon } from "@/components/ui/Icons";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkOverrides } from "@/lib/reports/homework";
import {
  useHomeworkProgress,
  markHomeworkDay,
  daysFor,
  HOMEWORK_TARGET_DAYS,
} from "@/lib/reports/progress";
import { useHomeworkResets, resetAtFor } from "@/lib/reports/reset";
import { isWindowOpen, windowEnd } from "@/lib/reports/completion";
import type { ReportCard } from "@/lib/reports/types";

const byDateDesc = (a: ReportCard, b: ReportCard) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

/** "12 Aug" from a YYYY-MM-DD date. */
function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Whole days left in the 14-day logging window (0 = last day). */
function daysToExpiry(cardDateISO: string, todayISO: string): number {
  const end = new Date(`${windowEnd(cardDateISO)}T00:00:00Z`).getTime();
  const today = new Date(`${todayISO}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - today) / 86_400_000));
}

/**
 * "Complete homework" — a daily guided flow launched from the profile. It lists
 * only homework that's still open: incomplete cards inside their 14-day window
 * (expired and finished cards are left out). The owner works through each one
 * and marks off the day — one day per card per calendar day.
 */
export function CompleteHomework({
  dogId,
  todayISO,
}: {
  dogId?: string;
  todayISO: string;
}) {
  const outbox = useOutboxCards();
  const overrides = useHomeworkOverrides();
  const progress = useHomeworkProgress();
  const resets = useHomeworkResets();
  const [open, setOpen] = useState(false);

  const cards = useMemo(() => {
    const resetAt = resetAtFor(resets, dogId);
    const byId = new Map<string, ReportCard>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    return [...byId.values()]
      .filter((c) => !dogId || !c.dogId || c.dogId === dogId)
      .filter((c) => !resetAt || c.date >= resetAt)
      .map((c) => ({ ...c, homework: overrides[c.id] ?? c.homework }))
      .filter((c) => {
        const done = daysFor(progress, c.id).length >= HOMEWORK_TARGET_DAYS;
        return !done && isWindowOpen(c.date, todayISO);
      })
      .sort(byDateDesc);
  }, [outbox, overrides, progress, resets, dogId, todayISO]);

  // How many still need a day logged today (drives the button badge).
  const todo = useMemo(
    () => cards.filter((c) => !daysFor(progress, c.id).includes(todayISO)).length,
    [cards, progress, todayISO]
  );

  // Lock the background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold leading-tight text-paper transition-colors hover:border-white/35"
      >
        <CheckCircleIcon width={18} height={18} className="shrink-0" />
        Complete homework
        {todo > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-ink">
            {todo}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Complete homework"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="display-heading text-xl text-paper">Complete homework</h2>
                <p className="mt-0.5 text-sm text-paper-dim">
                  {todo > 0
                    ? `${todo} to do today · one day each`
                    : cards.length > 0
                      ? "All done for today — come back tomorrow"
                      : "Nothing to complete right now"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {cards.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <CheckCircleIcon width={26} height={26} />
                  </span>
                  <p className="mt-3 font-semibold text-paper">You&apos;re all caught up!</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-paper-dim">
                    No homework needs completing right now. New report cards will
                    show up here.
                  </p>
                </div>
              ) : (
                cards.map((card) => (
                  <HomeworkItem key={card.id} card={card} progress={progress} todayISO={todayISO} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** One open homework card inside the flow: drills to practise + mark-today. */
function HomeworkItem({
  card,
  progress,
  todayISO,
}: {
  card: ReportCard;
  progress: Record<string, string[]>;
  todayISO: string;
}) {
  const days = daysFor(progress, card.id);
  const doneToday = days.includes(todayISO);
  const left = daysToExpiry(card.date, todayISO);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-paper">{card.focus}</p>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-paper-dim">
          {left === 0 ? "last day" : `${left} day${left === 1 ? "" : "s"} left`}
        </span>
      </div>

      {/* The drills to practise — grouped by category. */}
      <div className="mt-3 space-y-3">
        {card.homework.map((cat) => (
          <div key={cat.id}>
            <p className="mb-1 text-sm font-semibold text-paper">{cat.name}</p>
            <ul className="space-y-1">
              {cat.drills.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-sm text-paper/80">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Day progress — 3 separate days, one per calendar day. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: HOMEWORK_TARGET_DAYS }, (_, i) => {
          const date = days[i];
          return (
            <div
              key={i}
              className={`rounded-lg px-2 py-1.5 text-center ${
                date ? "bg-accent/15 text-accent" : "bg-white/[0.04] text-paper-dim"
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-xs font-semibold">
                {date && <CheckIcon width={12} height={12} />} Day {i + 1}
              </span>
              <span className="mt-0.5 block text-[11px]">{date ? shortDay(date) : "—"}</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => markHomeworkDay(card.id, todayISO)}
        disabled={doneToday}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-white/10 disabled:text-paper-dim"
      >
        {doneToday ? (
          "Done for today ✓"
        ) : (
          <>
            <CheckIcon width={16} height={16} /> Mark today&apos;s day done
          </>
        )}
      </button>
    </div>
  );
}
