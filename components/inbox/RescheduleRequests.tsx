"use client";

import { useMemo, useState } from "react";
import { CloseIcon, CheckIcon, MailIcon, MessageIcon } from "@/components/ui/Icons";
import { useReschedules, decide, suggest } from "@/lib/reschedule/store";
import { applyOverrides, useScheduleOverrides } from "@/lib/schedule/allocations";
import { formatSessionDate, dateForDayInWeek, spaceOnDate } from "@/lib/schedule/sessions";
import { dayLabel } from "@/lib/schedule/types";
import { formatTime } from "@/lib/inbox/format";
import type { DayId, DaySchedule } from "@/lib/schedule/types";
import type { RescheduleRequest } from "@/lib/reschedule/types";

/**
 * Admin queue of member reschedule requests. Open one to approve (optionally
 * moving it to a different day first), reject, or message the member. Approval
 * is guarded against the strict 6-space limit using live occupancy.
 */
export function RescheduleRequests({ week }: { week: DaySchedule[] }) {
  const all = useReschedules();
  const overrides = useScheduleOverrides();
  const merged = useMemo(() => applyOverrides(week, overrides), [week, overrides]);
  const pending = all.filter((r) => r.status === "pending");
  const decided = all.filter((r) => r.status !== "pending").slice(0, 5);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = all.find((r) => r.id === openId) ?? null;

  if (all.length === 0) {
    return <p className="text-sm text-paper-dim">No reschedule requests.</p>;
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="w-full rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/80">
                        {r.kind === "extra" ? "extra session" : "reschedule"}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-paper">
                      {r.dogName} · {r.ownerName}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-paper/70">
                      {r.kind === "extra"
                        ? `${r.service} · ${formatSessionDate(r.toDate)}`
                        : `${formatSessionDate(r.sessionDate)} → ${formatSessionDate(r.toDate)}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-paper-dim">{formatTime(r.createdAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-paper-dim">Recent</p>
          <ul className="space-y-1.5">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] px-4 py-2.5 text-sm"
              >
                <span className="truncate text-paper/80">
                  {r.dogName} · {formatSessionDate(r.sessionDate)} → {formatSessionDate(r.toDate)}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${r.status === "approved" ? "text-emerald-300" : "text-paper-dim"}`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <Detail request={open} merged={merged} all={all} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function Detail({
  request,
  merged,
  all,
  onClose,
}: {
  request: RescheduleRequest;
  merged: DaySchedule[];
  all: RescheduleRequest[];
  onClose: () => void;
}) {
  const [toDay, setToDay] = useState<DayId>(request.toDay);
  const [note, setNote] = useState<string | null>(null);
  const decidedAlready = request.status !== "pending";
  // The date the target day maps to — same week as the (session or requested) date.
  const baseDate = request.kind === "extra" ? request.toDate : request.sessionDate;
  const targetDate = () => dateForDayInWeek(baseDate, toDay);
  // Live space excluding this request's own reservation, so it never blocks itself.
  const others = all.filter((r) => r.id !== request.id);
  const options = merged
    .filter((d) => d.capacity > 0 && d.day !== request.fromDay)
    .map((d) => ({
      day: d.day,
      label: dayLabel(d.day),
      spaces: spaceOnDate(dateForDayInWeek(baseDate, d.day), merged, others, true),
    }));
  const targetSpace = spaceOnDate(targetDate(), merged, others, true);
  const mailto = request.email
    ? `mailto:${request.email}?subject=${encodeURIComponent("Your reschedule request — Nelly & Nova")}`
    : null;

  function approve() {
    if (targetSpace <= 0) {
      setNote(`${dayLabel(toDay)} is full — choose another day.`);
      return;
    }
    decide(request.id, "approved", { toDay, toDate: targetDate() });
    onClose();
  }
  function suggestDate() {
    suggest(request.id, toDay, targetDate());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/80">
              {request.kind === "extra" ? "extra session" : "reschedule"}
              {decidedAlready ? ` · ${request.status}` : ""}
            </span>
            <h2 className="mt-2 text-lg font-bold text-paper">
              {request.dogName} · {request.ownerName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-xl bg-white/[0.03] p-4 text-sm">
            {request.kind === "extra" ? (
              <>
                <p className="text-paper-dim">Extra session</p>
                <p className="mt-0.5 font-semibold text-paper">{request.service}</p>
                <p className="mt-2 text-paper-dim">Requested date</p>
                <p className="mt-0.5 font-semibold text-paper">{formatSessionDate(request.toDate)}</p>
              </>
            ) : (
              <>
                <p className="text-paper-dim">Moving this session</p>
                <p className="mt-0.5 font-semibold text-paper">{formatSessionDate(request.sessionDate)}</p>
                <p className="mt-2 text-paper-dim">Requested day</p>
                <p className="mt-0.5 font-semibold text-paper">{formatSessionDate(request.toDate)}</p>
              </>
            )}
            {request.note && (
              <>
                <p className="mt-2 text-paper-dim">Reason</p>
                <p className="mt-0.5 whitespace-pre-wrap text-paper">{request.note}</p>
              </>
            )}
          </div>

          {!decidedAlready && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-paper/90">
                Approve on this day, or suggest another
              </p>
              <div className="grid gap-2">
                {options.map((a) => {
                  const full = a.spaces <= 0;
                  const selected = toDay === a.day;
                  return (
                    <button
                      key={a.day}
                      type="button"
                      disabled={full}
                      onClick={() => setToDay(a.day)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "border-accent bg-accent/10 text-paper"
                          : full
                            ? "border-white/10 text-paper-dim opacity-60"
                            : "border-white/15 text-paper hover:border-white/35"
                      }`}
                    >
                      <span className="font-medium">
                        {a.label}
                        <span className="ml-2 text-xs text-paper-dim">
                          {formatSessionDate(dateForDayInWeek(request.sessionDate, a.day))}
                        </span>
                      </span>
                      <span className={`text-xs ${full ? "text-paper-dim" : "text-accent"}`}>
                        {full ? "Full" : `${a.spaces} space${a.spaces > 1 ? "s" : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-white/10 p-4">
          {mailto ? (
            <a
              href={mailto}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 text-sm font-medium text-paper hover:border-white/40"
            >
              <MailIcon width={18} height={18} /> Message
            </a>
          ) : (
            <span className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm text-paper-dim">
              <MessageIcon width={18} height={18} /> No email on file
            </span>
          )}
          {!decidedAlready && (
            <div className="w-full pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={approve}
                  className="inline-flex min-h-[44px] flex-[2] items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
                >
                  <CheckIcon width={16} height={16} />
                  {request.kind === "extra" ? "Approve & charge" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={suggestDate}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-medium text-paper hover:border-white/40"
                >
                  Suggest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    decide(request.id, "rejected");
                    onClose();
                  }}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-medium text-paper/70 hover:text-paper"
                >
                  Reject
                </button>
              </div>
              {note && <p className="mt-2 text-center text-[11px] text-red-300">{note}</p>}
              {request.kind === "extra" && !note && (
                <p className="mt-2 text-center text-[11px] text-paper-dim">
                  Approving charges the customer via GoCardless.
                </p>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
