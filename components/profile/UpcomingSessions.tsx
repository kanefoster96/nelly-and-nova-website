"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarIcon, CloseIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import {
  upcomingSessions,
  formatSessionDate,
  dateForDayInWeek,
  nextDateForDay,
  bookableDays,
  spaceOnDate,
  type MemberDay,
} from "@/lib/schedule/sessions";
import { applyOverrides, useScheduleOverrides } from "@/lib/schedule/allocations";
import { describeChargeSchedule } from "@/lib/payments/schedule";
import { extraSessionPrice, money } from "@/lib/payments/pricing";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { RescheduleRequest } from "@/lib/reschedule/types";
import {
  createReschedule,
  useReschedules,
  exceptionsFor,
  pendingFor,
  suggestedFor,
  acceptSuggestion,
} from "@/lib/reschedule/store";
import type { Cadence, DayId, DaySchedule } from "@/lib/schedule/types";
import { useHolidays, holidayCoveringDate } from "@/lib/holidays/store";
import { formatRange } from "@/lib/holidays/dates";

type Plan = { dayId: DayId; cadence: Cadence; service: string; day: string };
const EXTRA_SERVICES = ["Walk & Train", "1-1 Training"];

export function UpcomingSessions({
  todayISO,
  plan,
  week,
}: {
  todayISO: string;
  plan: Plan;
  week: DaySchedule[];
}) {
  const session = useSession();
  const reschedules = useReschedules();
  const holidays = useHolidays();
  const overrides = useScheduleOverrides();
  const { confirm, dialog } = useConfirm();
  // Availability reflects live moves + allocations so a full day is never offered.
  const merged = useMemo(() => applyOverrides(week, overrides), [week, overrides]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [bookingExtra, setBookingExtra] = useState(false);
  const [fullNote, setFullNote] = useState<string | null>(null);
  const today = todayISO.slice(0, 10);

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
  const suggested = suggestedFor(reschedules, dogId);
  const myExtras = reschedules.filter((r) => r.dogId === dogId && r.kind === "extra");
  const openSession = sessions.find((s) => s.date === openDate) ?? null;

  // Re-check space at the moment of submitting — the day may have filled since
  // the picker rendered. (The backend enforces the 6-limit atomically too.)
  function guard(toDate: string): boolean {
    if (spaceOnDate(toDate, merged, reschedules, true) > 0) return true;
    setFullNote("Sorry — that day just filled up. Please pick another.");
    window.setTimeout(() => setFullNote(null), 4000);
    setOpenDate(null);
    setBookingExtra(false);
    return false;
  }

  async function acceptWithConfirm(r: RescheduleRequest) {
    const price = r.kind === "extra" ? extraSessionPrice(r.service ?? "") : 0;
    const ok = await confirm({
      title: "Accept this date?",
      message: (
        <>
          Confirm your session on <b className="text-paper">{formatSessionDate(r.toDate)}</b>.
        </>
      ),
      amount: price ? money(price) : undefined,
      amountNote: price ? "Charged via GoCardless" : undefined,
      confirmLabel: "Accept",
    });
    if (ok) acceptSuggestion(r.id);
  }

  function submitRequest(kind: "reschedule" | "extra", toDay: DayId, opts: { sessionDate: string; fromDay: DayId; toDate: string; note?: string; service?: string }) {
    createReschedule({
      id: `${kind === "extra" ? "ex" : "rs"}-${dogId}-${opts.toDate}`,
      kind,
      service: opts.service,
      dogId,
      dogName: session!.dogName,
      ownerName: session!.ownerName,
      sessionDate: opts.sessionDate,
      fromDay: opts.fromDay,
      toDay,
      toDate: opts.toDate,
      note: opts.note,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <>
      <p className="text-sm text-paper/70">
        {plan.service} · {plan.day} — your sessions for the next two months. Can&apos;t
        make one? Request a swap to another available day.
      </p>
      <p className="mt-2 rounded-xl bg-white/[0.03] px-4 py-2.5 text-xs text-paper-dim ring-1 ring-white/5">
        {describeChargeSchedule(plan.dayId, plan.cadence)} Rescheduling a session
        doesn&apos;t change this — only extra sessions are charged separately.
      </p>

      <button
        type="button"
        onClick={() => setBookingExtra(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-paper transition-colors hover:border-white/35"
      >
        <PlusIcon width={16} height={16} /> Book an extra session
      </button>

      {fullNote && (
        <p className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{fullNote}</p>
      )}

      {myExtras.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Extra sessions</p>
          <ul className="space-y-2">
            {myExtras.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-paper">
                    {r.service} · {formatSessionDate(r.toDate)}
                  </p>
                  {r.status === "suggested" && (
                    <p className="text-xs text-amber-300">We suggested this date</p>
                  )}
                </div>
                {r.status === "suggested" ? (
                  <button
                    type="button"
                    onClick={() => acceptWithConfirm(r)}
                    className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
                  >
                    Accept
                  </button>
                ) : (
                  <StatusChip status={r.status} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {sessions.map((s) => {
          const moved = approved[s.date];
          const req = pending[s.date];
          const sugg = suggested[s.date];
          // A closure on the effective session date means it isn't running.
          const holiday = holidayCoveringDate(holidays, moved ? moved.toDate : s.date);
          if (holiday) {
            return (
              <li
                key={s.date}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-paper-dim">
                  <CalendarIcon width={20} height={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-paper-dim line-through">
                    {formatSessionDate(s.date)}
                  </p>
                  <p className="mt-0.5 text-xs text-paper-dim">
                    No session — we&apos;re closed ({formatRange(holiday)})
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-paper-dim">
                  Holiday
                </span>
              </li>
            );
          }
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
                    <p className="mt-0.5 text-xs text-emerald-300">Moved from {formatSessionDate(s.date)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-paper">{formatSessionDate(s.date)}</p>
                    {req && (
                      <p className="mt-0.5 text-xs text-amber-300">
                        Reschedule requested → {formatSessionDate(req.toDate)}
                      </p>
                    )}
                    {sugg && (
                      <p className="mt-0.5 text-xs text-amber-300">
                        We suggested {formatSessionDate(sugg.toDate)}
                      </p>
                    )}
                  </>
                )}
              </div>
              {!moved && !req && !sugg && (
                <button
                  type="button"
                  onClick={() => setOpenDate(s.date)}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Reschedule
                </button>
              )}
              {sugg && (
                <button
                  type="button"
                  onClick={() => acceptWithConfirm(sugg)}
                  className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
                >
                  Accept
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
        <PickDayModal
          title="Request a reschedule"
          subtitle={formatSessionDate(openSession.date)}
          days={bookableDays(merged, reschedules, (day) => dateForDayInWeek(openSession.date, day), openSession.day)}
          withReason
          onClose={() => setOpenDate(null)}
          onSubmit={async (toDay, note) => {
            const toDate = dateForDayInWeek(openSession.date, toDay);
            if (!guard(toDate)) return;
            const ok = await confirm({
              title: "Request this change?",
              message: (
                <>
                  Move your session from <b className="text-paper">{formatSessionDate(openSession.date)}</b> to{" "}
                  <b className="text-paper">{formatSessionDate(toDate)}</b>? We&apos;ll confirm it with you — your
                  regular payment doesn&apos;t change.
                </>
              ),
              confirmLabel: "Send request",
            });
            if (!ok) return;
            submitRequest("reschedule", toDay, {
              sessionDate: openSession.date,
              fromDay: openSession.day,
              toDate,
              note,
            });
            setOpenDate(null);
          }}
        />
      )}

      {bookingExtra && (
        <ExtraModal
          days={bookableDays(merged, reschedules, (day) => nextDateForDay(today, day))}
          onClose={() => setBookingExtra(false)}
          onSubmit={async (service, toDay) => {
            const toDate = nextDateForDay(today, toDay);
            if (!guard(toDate)) return;
            const price = extraSessionPrice(service);
            const ok = await confirm({
              title: "Book this extra session?",
              message: (
                <>
                  An extra <b className="text-paper">{service}</b> on{" "}
                  <b className="text-paper">{formatSessionDate(toDate)}</b>.
                </>
              ),
              amount: money(price),
              amountNote: "Charged via GoCardless once we approve it",
              confirmLabel: "Request session",
            });
            if (!ok) return;
            submitRequest("extra", toDay, { sessionDate: toDate, fromDay: toDay, toDate, service });
            setBookingExtra(false);
          }}
        />
      )}

      {dialog}
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-300",
    approved: "bg-emerald-400/15 text-emerald-300",
    rejected: "bg-white/10 text-paper-dim",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status] ?? "bg-white/10 text-paper-dim"}`}>
      {status === "approved" ? "Confirmed" : status === "pending" ? "Pending" : "Declined"}
    </span>
  );
}

/** Pick an available day (member view — no dog counts shown). */
function PickDayModal({
  title,
  subtitle,
  days,
  withReason,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  days: MemberDay[];
  withReason?: boolean;
  onClose: () => void;
  onSubmit: (toDay: DayId, note: string) => void;
}) {
  const [toDay, setToDay] = useState<DayId | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">{title}</p>
            <p className="text-xs text-paper-dim">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="mb-2 text-sm font-medium text-paper/90">Choose an available day</p>
          {days.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-paper-dim">
              No days are available right now — message us and we&apos;ll sort it.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setToDay(d.day)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    toDay === d.day ? "border-accent bg-accent/10 text-paper" : "border-white/15 text-paper hover:border-white/35"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
          {withReason && (
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
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <Button radius="xl" onClick={() => toDay && onSubmit(toDay, note)} disabled={!toDay} className="disabled:opacity-50">
            <CheckIcon width={16} height={16} /> Send request
          </Button>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Book an extra session — pick the service then an available day. */
function ExtraModal({
  days,
  onClose,
  onSubmit,
}: {
  days: MemberDay[];
  onClose: () => void;
  onSubmit: (service: string, toDay: DayId) => void;
}) {
  const [service, setService] = useState(EXTRA_SERVICES[0]);
  const [toDay, setToDay] = useState<DayId | null>(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <p className="flex-1 font-semibold text-paper">Book an extra session</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <div className="grid gap-5 px-5 py-5">
          <div>
            <p className="mb-2 text-sm font-medium text-paper/90">Session type</p>
            <div className="grid grid-cols-2 gap-2">
              {EXTRA_SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setService(s)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    service === s ? "border-accent bg-accent/10 text-paper" : "border-white/15 text-paper hover:border-white/35"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-paper/90">Choose an available day</p>
            {days.length === 0 ? (
              <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-paper-dim">
                No days are available right now — message us and we&apos;ll sort it.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {days.map((d) => (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => setToDay(d.day)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      toDay === d.day ? "border-accent bg-accent/10 text-paper" : "border-white/15 text-paper hover:border-white/35"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-paper-dim">
            We&apos;ll confirm and charge for the extra session once approved.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <Button radius="xl" onClick={() => toDay && onSubmit(service, toDay)} disabled={!toDay} className="disabled:opacity-50">
            <CheckIcon width={16} height={16} /> Request session
          </Button>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
