"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CheckCircleIcon, CloseIcon } from "@/components/ui/Icons";
import { useReports, byDateDesc } from "@/lib/reports/client";
import { markHomeworkDay, daysFor, HOMEWORK_TARGET_DAYS } from "@/lib/reports/progress";
import { resetAtFor } from "@/lib/reports/reset";
import { CARD, PRIMARY, shortDate } from "@/components/reports/styles";
import type { ReportCard } from "@/lib/reports/types";

/**
 * "Complete homework" — a daily guided flow launched from the profile. It lists
 * every homework not yet done on 3 different days (it never expires; finished
 * cards are left out). The owner works through each one and marks off the
 * day — once per card per day (UK date), enforced by the database
 * (nn_homework_complete_day, supabase/migrations/20261104080000_owner_onboarding.sql).
 */
export function CompleteHomework({
  dogId,
  todayISO,
}: {
  dogId?: string;
  todayISO: string;
}) {
  const { cards: all, progress, resets, staff } = useReports();
  const [open, setOpen] = useState(false);

  // Published cards for this dog, still to do: not yet done on 3 days.
  const cards = useMemo(() => {
    if (staff) return [];
    const resetAt = resetAtFor(resets, dogId);
    return all
      .filter((c) => c.status !== "draft")
      .filter((c) => !dogId || c.dogId === dogId)
      .filter((c) => !resetAt || c.date >= resetAt)
      .filter((c) => {
        return daysFor(progress, c.id).length < HOMEWORK_TARGET_DAYS;
      })
      .sort(byDateDesc);
  }, [all, progress, resets, dogId, staff]);

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
        className="relative flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-center text-sm font-semibold leading-tight text-paper transition-colors hover:border-white/35"
      >
        <CheckCircleIcon width={18} height={18} className="shrink-0" />
        Homework
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
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function practised() {
    setSaving(true);
    setProblem(await markHomeworkDay(card.id, todayISO, progress));
    setSaving(false);
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-paper-dim">Report card · {shortDate(card.date)}</p>
          <p className="mt-0.5 font-semibold text-paper">{card.focus}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-paper-dim">
          Day {Math.min(days.length + (doneToday ? 0 : 1), HOMEWORK_TARGET_DAYS)} of {HOMEWORK_TARGET_DAYS}
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
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-paper">Days done</span>
        <span className="text-paper-dim">
          {days.length} of {HOMEWORK_TARGET_DAYS}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((days.length / HOMEWORK_TARGET_DAYS) * 100)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {Array.from({ length: HOMEWORK_TARGET_DAYS }, (_, i) => (
          <span
            key={i}
            className={`rounded-full px-2.5 py-1 ${
              days[i] ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-white/10 text-paper-dim"
            }`}
          >
            {days[i] ? `✓ ${shortDate(days[i])}` : `Day ${i + 1}`}
          </span>
        ))}
      </div>

      <button type="button" onClick={practised} disabled={doneToday || saving} className={`${PRIMARY} mt-3 w-full`}>
        {doneToday ? (
          "Done today ✓ · come back tomorrow"
        ) : saving ? (
          "Saving…"
        ) : (
          <>
            <CheckIcon width={16} height={16} /> Complete today
          </>
        )}
      </button>
      {problem && <p className="mt-2 text-sm text-red-300">{problem}</p>}
    </div>
  );
}
