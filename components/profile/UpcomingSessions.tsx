"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarIcon, CloseIcon, CheckIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import {
  upcomingSessions,
  formatSessionDate,
  dateForDayInWeek,
  type DayAvailability,
} from "@/lib/schedule/sessions";
import { createReschedule, useReschedules, exceptionsFor, pendingFor } from "@/lib/reschedule/store";
import type { Cadence, DayId } from "@/lib/schedule/types";

type Plan = { dayId: DayId; cadence: Cadence; service: string; day: string };

export function UpcomingSessions({
  todayISO,
  plan,
  avail,
}: {
  todayISO: string;
  plan: Plan;
  avail: DayAvailability[];
}) {
  const session = useSession();
  const reschedules = useReschedules();
  const [openDate, setOpenDate] = useState<string | null>(null);

  const sessions = useMemo(
    () => upcomingSessions({ dayId: plan.dayId, cadence: plan.cadence }, todayISO),
    [plan.dayId, plan.cadence, todayISO]
  );

  if (!session) {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Please log in</h2>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">Log in</Button>
        </div>
      </div>
    );
  }

  const dogId = session.dogId ?? "me";
  const approved = exceptionsFor(reschedules, dogId);
  const pending = pendingFor(reschedules, dogId);
  const openSession = sessions.find((s) => s.date === openDate) ?? null;

  return (
    <>
      <p className="text-sm text-paper/70">
        {plan.service} · {plan.day} — your sessions for the next two months. Can&apos;t
        make one? Request a swap to another day that has space.
      </p>

      <ul className="mt-6 space-y-2">
        {sessions.map((s) => {
          const moved = approved[s.date];
          const req = pending[s.date];
          return (
            <li
              key={s.date}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                <CalendarIcon width={20} height={20} />
              </span>
              <div className="min-w-0 flex-1">
                {moved ? (
                  <>
                    <p className="font-semibold text-paper">{formatSessionDate(moved.toDate)}</p>
                    <p className="mt-0.5 text-xs text-emerald-300">
                      Moved from {formatSessionDate(s.date)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-paper">{formatSessionDate(s.date)}</p>
                    {req && (
                      <p className="mt-0.5 text-xs text-amber-300">
                        Reschedule requested → {formatSessionDate(req.toDate)}
                      </p>
                    )}
                  </>
                )}
              </div>
              {!moved && !req && (
                <button
                  type="button"
                  onClick={() => setOpenDate(s.date)}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Reschedule
                </button>
              )}
              {req && (
                <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  Pending
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {openSession && (
        <RescheduleModal
          sessionDate={openSession.date}
          fromDay={openSession.day}
          avail={avail}
          onClose={() => setOpenDate(null)}
          onSubmit={(toDay, note) => {
            const toDate = dateForDayInWeek(openSession.date, toDay);
            createReschedule({
              id: `rs-${dogId}-${openSession.date}`,
              dogId,
              dogName: session.dogName,
              ownerName: session.ownerName,
              sessionDate: openSession.date,
              fromDay: openSession.day,
              toDay,
              toDate,
              note: note.trim() || undefined,
              status: "pending",
              createdAt: new Date().toISOString(),
            });
            setOpenDate(null);
          }}
        />
      )}
    </>
  );
}

function RescheduleModal({
  sessionDate,
  fromDay,
  avail,
  onClose,
  onSubmit,
}: {
  sessionDate: string;
  fromDay: DayId;
  avail: DayAvailability[];
  onClose: () => void;
  onSubmit: (toDay: DayId, note: string) => void;
}) {
  const [toDay, setToDay] = useState<DayId | null>(null);
  const [note, setNote] = useState("");
  const options = avail.filter((a) => a.day !== fromDay);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Request a reschedule</p>
            <p className="text-xs text-paper-dim">{formatSessionDate(sessionDate)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="mb-2 text-sm font-medium text-paper/90">
            Move to a day with space this week
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
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
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
                      {formatSessionDate(dateForDayInWeek(sessionDate, a.day))}
                    </span>
                  </span>
                  <span className={`text-xs ${full ? "text-paper-dim" : "text-accent"}`}>
                    {full ? "Full" : `${a.spaces} space${a.spaces > 1 ? "s" : ""}`}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-sm font-medium text-paper/90">
            Reason <span className="text-paper-dim">(optional)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know?"
              className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <Button
            radius="xl"
            onClick={() => toDay && onSubmit(toDay, note)}
            disabled={!toDay}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> Request reschedule
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
