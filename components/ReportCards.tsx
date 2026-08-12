"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { CheckIcon, ChevronDownIcon } from "./ui/Icons";
import { formatDate, formatTime } from "@/lib/inbox/format";
import { useSession } from "@/lib/auth/session";
import { markReportsSeen } from "@/lib/reports/seen";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkOverrides, saveCardHomework } from "@/lib/reports/homework";
import { HomeworkEditModal } from "@/components/reports/HomeworkEditor";
import { setHomeworkDone, addReportComment } from "@/lib/reports/data";
import type { ReportCard, ReportComment } from "@/lib/reports/types";

const byDateDesc = (a: ReportCard, b: ReportCard) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

/** Owner edits kept as an overlay so they apply to sample + sent cards alike. */
type Edit = { hw: Record<string, boolean>; comments: ReportComment[] };

/**
 * Report cards for the owner's dog. The latest opens by default. Owners mark
 * homework complete and can ask questions in a per-card thread that only they
 * and staff can see. Viewing the cards clears the "new report" badge.
 *
 * Role-aware: staff (admin) see the same thread with a reply box, so a question
 * that lands in their notifications opens here and they can reply before the
 * owner marks the homework complete.
 */
export function ReportCards({ initial }: { initial: ReportCard[] }) {
  const session = useSession();
  const isStaff = session?.role === "admin";
  const outbox = useOutboxCards();
  const overrides = useHomeworkOverrides();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  // `undefined` = follow the newest card automatically; set once the user clicks.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editingCard, setEditingCard] = useState<ReportCard | null>(null);

  // Base list: sample cards plus any a coach has just sent (scaffold outbox),
  // newest first. Then apply trainer homework edits, then the owner's ticks.
  const activeDogId = session?.dogId;
  const cards = useMemo(() => {
    const byId = new Map<string, ReportCard>();
    for (const c of [...outbox, ...initial]) if (!byId.has(c.id)) byId.set(c.id, c);
    // A member sees only the active dog's cards (untagged cards show for all);
    // staff (admin) see every dog's cards.
    const list = [...byId.values()].filter(
      (c) => isStaff || !activeDogId || !c.dogId || c.dogId === activeDogId
    );
    return list.sort(byDateDesc).map((c) => {
      // Trainer's homework edit (if any) replaces the card's categories/drills.
      const baseHw = overrides[c.id] ?? c.homework;
      const e = edits[c.id];
      if (!e) return baseHw === c.homework ? c : { ...c, homework: baseHw };
      return {
        ...c,
        homework: baseHw.map((cat) => ({
          ...cat,
          drills: cat.drills.map((d) => (d.id in e.hw ? { ...d, done: e.hw[d.id] } : d)),
        })),
        comments: e.comments.length ? [...c.comments, ...e.comments] : c.comments,
      };
    });
  }, [outbox, initial, edits, isStaff, activeDogId, overrides]);

  const openCardId = openId === undefined ? cards[0]?.id ?? null : openId;

  // Clear the "new report card" badge once the owner views them.
  const idsKey = cards.map((c) => c.id).join(",");
  useEffect(() => {
    if (!isStaff) markReportsSeen(idsKey ? idsKey.split(",") : []);
  }, [idsKey, isStaff]);

  if (!session) {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Please log in</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Report cards are private to you and Nelly &amp; Nova.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }

  function editFor(cardId: string, prev: Record<string, Edit>): Edit {
    return prev[cardId] ?? { hw: {}, comments: [] };
  }

  function toggleHw(cardId: string, hwId: string, done: boolean) {
    setEdits((prev) => {
      const e = editFor(cardId, prev);
      return { ...prev, [cardId]: { ...e, hw: { ...e.hw, [hwId]: done } } };
    });
    // TODO(backend): persist the change (the edit overlay stands in until then).
    void setHomeworkDone(cardId, hwId, done);
  }

  function submitComment(cardId: string) {
    const body = (draft[cardId] ?? "").trim();
    if (!body || !session) return;
    const comment: ReportComment = {
      id: `temp-${crypto.randomUUID()}`,
      author: isStaff ? "staff" : "owner",
      authorName: isStaff ? "Nelly & Nova" : session.ownerName || "You",
      body,
      createdAt: new Date().toISOString(),
    };
    setEdits((prev) => {
      const e = editFor(cardId, prev);
      return { ...prev, [cardId]: { ...e, comments: [...e.comments, comment] } };
    });
    setDraft((d) => ({ ...d, [cardId]: "" }));
    // TODO(backend): insert the comment; an owner comment notifies staff.
    void addReportComment(cardId, comment);
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const open = openCardId === card.id;
        const remaining = card.homework.reduce(
          (n, cat) => n + cat.drills.filter((d) => !d.done).length,
          0
        );
        return (
          <div
            key={card.id}
            className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10"
          >
            {/* Card header */}
            <button
              type="button"
              onClick={() => setOpenId(open ? null : card.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-paper">{card.focus}</p>
                  {card.isNew && !isStaff && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-paper-dim">
                  {formatDate(card.date)}
                  {remaining > 0 && (
                    <span className="text-paper/60">
                      {" "}
                      · {remaining} homework left
                    </span>
                  )}
                </p>
              </div>
              <ChevronDownIcon
                width={18}
                height={18}
                className={`shrink-0 text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && (
              <div className="border-t border-white/10 px-5 py-5">
                <p className="text-sm text-paper/80">{card.summary}</p>

                {/* Wins */}
                {card.wins.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      Went well
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {card.wins.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-paper/80">
                          <CheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-accent" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Homework — grouped by category, each with its drills */}
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      Homework
                    </p>
                    {isStaff && (
                      <button
                        type="button"
                        onClick={() => setEditingCard(card)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-paper transition-colors hover:border-white/40"
                      >
                        Edit drills
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-4">
                    {card.homework.map((cat) => (
                      <div key={cat.id}>
                        <p className="mb-1.5 text-sm font-semibold text-paper">{cat.name}</p>
                        <ul className="space-y-2">
                          {cat.drills.map((d) => (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => toggleHw(card.id, d.id, !d.done)}
                                disabled={isStaff}
                                aria-pressed={d.done}
                                className="flex w-full items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-default disabled:hover:bg-white/[0.03]"
                              >
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                    d.done
                                      ? "border-accent bg-accent text-accent-ink"
                                      : "border-white/30"
                                  }`}
                                >
                                  {d.done && <CheckIcon width={13} height={13} />}
                                </span>
                                <span
                                  className={`min-w-0 text-sm font-medium ${
                                    d.done ? "text-paper/50 line-through" : "text-paper"
                                  }`}
                                >
                                  {d.name}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {remaining === 0 && (
                    <p className="mt-3 text-sm font-medium text-accent">
                      All homework complete — great work! 🐾
                    </p>
                  )}
                </div>

                {/* Comment thread — owner + staff only */}
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    Questions about homework
                  </p>
                  <p className="mt-1 text-xs text-paper-dim">
                    Only {isStaff ? "the owner" : "you"} and Nelly &amp; Nova can
                    see this.
                  </p>

                  {card.comments.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {card.comments.map((c) => (
                        <li
                          key={c.id}
                          className={`rounded-2xl px-4 py-2.5 ${
                            c.author === "staff"
                              ? "bg-white/[0.06]"
                              : "bg-accent/10"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-xs font-semibold text-paper">
                              {c.authorName}
                            </span>
                            <span className="shrink-0 text-xs text-paper-dim">
                              {formatTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-paper/85">{c.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex items-end gap-2">
                    <textarea
                      rows={2}
                      value={draft[card.id] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [card.id]: e.target.value }))
                      }
                      placeholder={
                        isStaff
                          ? "Reply as Nelly & Nova…"
                          : "Ask a question about your homework…"
                      }
                      className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <Button
                      radius="xl"
                      onClick={() => submitComment(card.id)}
                      className="shrink-0"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editingCard && (
        <HomeworkEditModal
          title={`${editingCard.focus} · ${formatDate(editingCard.date)}`}
          initial={overrides[editingCard.id] ?? editingCard.homework}
          onSave={(cats) => saveCardHomework(editingCard.id, cats)}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
