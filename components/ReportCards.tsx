"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { CheckIcon, ChevronDownIcon } from "./ui/Icons";
import { formatTime } from "@/lib/inbox/format";
import { useSession } from "@/lib/auth/session";
import { markReportsSeen } from "@/lib/reports/seen";
import { useReports, byDateDesc, addComment } from "@/lib/reports/client";
import { saveCardHomework } from "@/lib/reports/homework";
import { markHomeworkDay, daysFor, HOMEWORK_TARGET_DAYS } from "@/lib/reports/progress";
import { isWindowOpen, HOMEWORK_WINDOW_DAYS } from "@/lib/reports/completion";
import { useLibrary, findLibraryDrill, findLibraryDrillByName } from "@/lib/homework-library/store";
import { HomeworkEditModal } from "@/components/reports/HomeworkEditor";
import { DrillBlocks } from "@/components/profile/DrillPage";
import { CARD, ERROR_BANNER, PILL, PRIMARY, QUIET, INPUT, SECTION, shortDate, longDate } from "@/components/reports/styles";
import type { HomeworkDrill, ReportCard } from "@/lib/reports/types";

/**
 * Report cards for the owner's dog, newest first; the latest opens by
 * default. Each has what went well, the homework (open a drill for its
 * how-to), "I practised today" for 3 separate days in 14, and a question
 * thread only the owner and the trainers see. Viewing them clears the "new"
 * badge.
 *
 * Role-aware: trainers see every dog's cards (drafts marked), can edit the
 * drills, and reply in the thread.
 */
export function ReportCards() {
  const session = useSession();
  const { cards: all, progress, loaded, error, staff } = useReports();
  const isStaff = staff || session?.role === "admin";
  const today = new Date().toISOString().slice(0, 10);
  // `undefined` = follow the newest card automatically; set once the user clicks.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [editingCard, setEditingCard] = useState<ReportCard | null>(null);

  const activeDogId = session?.dogId;
  const cards = useMemo(
    () => all.filter((c) => (isStaff ? true : !activeDogId || c.dogId === activeDogId)).sort(byDateDesc),
    [all, isStaff, activeDogId]
  );
  const openCardId = openId === undefined ? cards[0]?.id ?? null : openId;

  // Clear the "new report card" badge once the owner views them.
  const idsKey = cards.map((c) => c.id).join(",");
  useEffect(() => {
    if (!isStaff && idsKey) markReportsSeen(idsKey.split(","));
  }, [idsKey, isStaff]);

  if (!session) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <h2 className="display-heading text-2xl text-paper">Please log in</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">Report cards are private to you and Nelly &amp; Nova.</p>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className={`${CARD} h-24 animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className={ERROR_BANNER}>{error}</p>}
      {cards.length === 0 && !error && (
        <p className={`${CARD} px-6 py-10 text-center text-sm text-paper-dim`}>
          No report cards yet. After each session your trainer&apos;s card, with this week&apos;s homework, appears here.
        </p>
      )}
      {cards.map((card) => (
        <CardView
          key={card.id}
          card={card}
          open={openCardId === card.id}
          onToggle={() => setOpenId(openCardId === card.id ? null : card.id)}
          days={daysFor(progress, card.id)}
          progress={progress}
          today={today}
          isStaff={isStaff}
          ownerName={session.ownerName || "You"}
          onEdit={() => setEditingCard(card)}
        />
      ))}

      {editingCard && (
        <HomeworkEditModal
          title={`${editingCard.dogName ? `${editingCard.dogName} · ` : ""}${editingCard.focus} · ${longDate(editingCard.date)}`}
          initial={editingCard.homework}
          onSave={(cats) => saveCardHomework(editingCard.id, cats)}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

function CardView({
  card,
  open,
  onToggle,
  days,
  progress,
  today,
  isStaff,
  ownerName,
  onEdit,
}: {
  card: ReportCard;
  open: boolean;
  onToggle: () => void;
  days: string[];
  progress: Record<string, string[]>;
  today: string;
  isStaff: boolean;
  ownerName: string;
  onEdit: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const doneToday = days.includes(today);
  const complete = days.length >= HOMEWORK_TARGET_DAYS;
  const daysLeft = HOMEWORK_TARGET_DAYS - days.length;
  const windowOpen = isWindowOpen(card.date, today);
  const drillCount = card.homework.reduce((n, c) => n + c.drills.length, 0);

  async function practised() {
    setSaving(true);
    setProblem(await markHomeworkDay(card.id, today, progress));
    setSaving(false);
  }

  return (
    <div className={`${CARD} overflow-hidden`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-paper-dim">
              {isStaff && card.dogName ? `${card.dogName} · ` : ""}
              {shortDate(card.date)}
            </span>
            {card.isNew && <span className={`${PILL} bg-red-500 text-white`}>New</span>}
            {card.status === "draft" && <span className={`${PILL} bg-amber-400/15 text-amber-300`}>Draft</span>}
          </div>
          <p className="mt-1 font-semibold text-paper">{card.focus}</p>
          <p className="mt-0.5 text-xs text-paper-dim">
            {drillCount} drill{drillCount === 1 ? "" : "s"} ·{" "}
            {complete ? "homework done ✓" : `${days.length} of ${HOMEWORK_TARGET_DAYS} days practised`}
          </p>
        </div>
        <ChevronDownIcon width={18} height={18} className={`shrink-0 text-paper-dim transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 py-5">
          {card.summary && <p className="whitespace-pre-wrap text-sm text-paper/85">{card.summary}</p>}

          {card.wins.length > 0 && (
            <div className="mt-5">
              <p className={SECTION}>Went well</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {card.wins.map((w, i) => (
                  <li key={i} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                    ✓ {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className={SECTION}>Homework</p>
              {isStaff && (
                <button type="button" onClick={onEdit} className={QUIET}>
                  Edit drills
                </button>
              )}
            </div>
            <div className="mt-3 space-y-4">
              {card.homework.map((cat) => (
                <div key={cat.id}>
                  <p className="text-sm font-semibold text-paper">{cat.name}</p>
                  <ul className="mt-1.5 divide-y divide-white/5 rounded-xl border border-white/10 bg-ink">
                    {cat.drills.map((d) => (
                      <DrillRow key={d.id} drill={d} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Practise on 3 separate days (one a day), within 14 days. */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-paper">This week</span>
                <span className="text-paper-dim">
                  {days.length} of {HOMEWORK_TARGET_DAYS} days
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((Math.min(days.length, HOMEWORK_TARGET_DAYS) / HOMEWORK_TARGET_DAYS) * 100)}%` }}
                />
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

              {!isStaff &&
                (complete ? (
                  <p className="mt-4 text-sm font-medium text-emerald-300">Homework complete, great work! 🐾</p>
                ) : !windowOpen ? (
                  <p className="mt-4 text-sm text-paper-dim">The {HOMEWORK_WINDOW_DAYS}-day window to log this homework has closed.</p>
                ) : (
                  <>
                    <button type="button" onClick={practised} disabled={doneToday || saving} className={`${PRIMARY} mt-4 w-full`}>
                      {doneToday ? (
                        "Practised today ✓"
                      ) : saving ? (
                        "Saving…"
                      ) : (
                        <>
                          <CheckIcon width={16} height={16} /> I practised today
                        </>
                      )}
                    </button>
                    {!doneToday && (
                      <p className="mt-1.5 text-center text-[11px] text-paper-dim">
                        {daysLeft} more day{daysLeft === 1 ? "" : "s"} to finish
                      </p>
                    )}
                  </>
                ))}
              {problem && <p className="mt-2 text-sm text-red-300">{problem}</p>}
            </div>
          </div>

          {card.status !== "draft" && <Thread card={card} isStaff={isStaff} ownerName={ownerName} />}
        </div>
      )}
    </div>
  );
}

/** One homework drill; one from the library opens its how-to in place. */
function DrillRow({ drill }: { drill: HomeworkDrill }) {
  const library = useLibrary();
  const [open, setOpen] = useState(false);
  const page = findLibraryDrill(library, drill.ref)?.drill ?? findLibraryDrillByName(library, drill.name);
  if (!page) {
    return <li className="px-3.5 py-2.5 text-sm text-paper/85">{drill.name}</li>;
  }
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left">
        <span className="min-w-0 flex-1 text-sm text-paper/85">{drill.name}</span>
        <span className="shrink-0 text-xs text-paper-dim">{open ? "Hide" : "How to"}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-4">
          <DrillBlocks blocks={page.blocks} />
        </div>
      )}
    </li>
  );
}

/** Questions about the homework — the owner and the trainers only. */
function Thread({ card, isStaff, ownerName }: { card: ReportCard; isStaff: boolean; ownerName: string }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setProblem(null);
    try {
      await addComment(card.id, draft, ownerName);
      setDraft("");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <p className={SECTION}>Questions about homework</p>
      <p className="mt-1 text-xs text-paper-dim">Only {isStaff ? "the owner" : "you"} and Nelly &amp; Nova can see this.</p>
      {card.comments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {card.comments.map((c) => (
            <li key={c.id} className={`rounded-2xl px-4 py-2.5 ${c.author === "staff" ? "bg-white/[0.06]" : "bg-accent/10"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-paper">{c.authorName}</span>
                <span className="shrink-0 text-xs text-paper-dim">{formatTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-paper/85">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          rows={2}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isStaff ? "Reply as Nelly & Nova…" : "Ask a question about your homework…"}
          className={INPUT}
        />
        <button type="button" onClick={send} disabled={sending || !draft.trim()} className={`${PRIMARY} shrink-0`}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {problem && <p className="mt-2 text-sm text-red-300">{problem}</p>}
    </div>
  );
}
