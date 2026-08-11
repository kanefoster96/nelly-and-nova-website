"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { CheckIcon, ChevronDownIcon } from "./ui/Icons";
import { formatDate, formatTime } from "@/lib/inbox/format";
import { useSession } from "@/lib/auth/session";
import { markReportsSeen } from "@/lib/reports/seen";
import { setHomeworkDone, addReportComment } from "@/lib/reports/data";
import type { ReportCard, ReportComment } from "@/lib/reports/types";

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
  const [cards, setCards] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Clear the "new report card" badge once the owner views them.
  useEffect(() => {
    if (!isStaff) markReportsSeen(initial.map((c) => c.id));
  }, [initial, isStaff]);

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

  function toggleHw(cardId: string, hwId: string) {
    setCards((cs) => {
      const next = cs.map((c) =>
        c.id !== cardId
          ? c
          : {
              ...c,
              homework: c.homework.map((h) =>
                h.id === hwId ? { ...h, done: !h.done } : h
              ),
            }
      );
      const hw = next.find((c) => c.id === cardId)?.homework.find((h) => h.id === hwId);
      // TODO(backend): persist the change (localStorage stands in until then).
      if (hw) void setHomeworkDone(cardId, hwId, hw.done);
      return next;
    });
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
    setCards((cs) =>
      cs.map((c) =>
        c.id === cardId ? { ...c, comments: [...c.comments, comment] } : c
      )
    );
    setDraft((d) => ({ ...d, [cardId]: "" }));
    // TODO(backend): insert the comment; an owner comment notifies staff.
    void addReportComment(cardId, comment);
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => {
        const open = openId === card.id;
        const remaining = card.homework.filter((h) => !h.done).length;
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

                {/* Homework */}
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    Homework
                  </p>
                  <ul className="mt-2 space-y-2">
                    {card.homework.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => toggleHw(card.id, h.id)}
                          disabled={isStaff}
                          aria-pressed={h.done}
                          className="flex w-full items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-default disabled:hover:bg-white/[0.03]"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              h.done
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-white/30"
                            }`}
                          >
                            {h.done && <CheckIcon width={13} height={13} />}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block text-sm font-medium ${
                                h.done ? "text-paper/50 line-through" : "text-paper"
                              }`}
                            >
                              {h.title}
                            </span>
                            {h.detail && (
                              <span className="mt-0.5 block text-sm text-paper/60">
                                {h.detail}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {remaining === 0 && (
                    <p className="mt-2 text-sm font-medium text-accent">
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
    </div>
  );
}
