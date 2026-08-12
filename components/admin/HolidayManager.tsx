"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CalendarIcon, CloseIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "./DatePicker";
import type { DaySchedule } from "@/lib/schedule/types";
import {
  useHolidays,
  addHoliday,
  removeHoliday,
  rosterCustomers,
  holidaysUsed,
} from "@/lib/holidays/store";
import { ANNUAL_HOLIDAY_ALLOWANCE, type HolidayCustomer } from "@/lib/holidays/types";
import { daysInclusive, formatRange, isoToNum, yearOf } from "@/lib/holidays/dates";

/**
 * Trainer holidays. Add a closure (choose the days away); it marks one holiday
 * used against every member (capped at four a year), publishes to the public
 * holidays page and emails everyone that week's sessions won't run.
 */
export function HolidayManager({
  week,
  todayISO,
}: {
  week: DaySchedule[];
  todayISO: string;
}) {
  const holidays = useHolidays();
  const customers = useMemo(() => rosterCustomers(week), [week]);
  const today = todayISO.slice(0, 10);
  const year = Number(today.slice(0, 4));
  const usedThisYear = holidaysUsed(holidays, year);
  const { confirm, dialog } = useConfirm();

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const yearHolidays = holidays.filter((h) => yearOf(h.start) === year);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Holidays
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            usedThisYear >= ANNUAL_HOLIDAY_ALLOWANCE
              ? "bg-red-500/15 text-red-300"
              : usedThisYear >= ANNUAL_HOLIDAY_ALLOWANCE - 1
                ? "bg-amber-400/15 text-amber-300"
                : "bg-white/10 text-paper-dim"
          }`}
        >
          {usedThisYear} of {ANNUAL_HOLIDAY_ALLOWANCE} weeks used · {year}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
        <p className="text-sm text-paper/75">
          Add the days you&apos;re away. It marks one holiday used for every
          member (two dogs or twice-a-week still counts as one), shows on the
          public holidays page, and emails everyone that week&apos;s sessions
          won&apos;t run.
        </p>

        <div className="mt-4">
          <Button radius="xl" onClick={() => setOpen(true)}>
            <PlusIcon width={16} height={16} /> Add holiday
          </Button>
        </div>

        {/* Scheduled closures */}
        {yearHolidays.length > 0 && (
          <ul className="mt-5 space-y-2">
            {yearHolidays.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                  <CalendarIcon width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-paper">
                    {formatRange(h)}
                  </p>
                  <p className="truncate text-xs text-paper-dim">
                    {daysInclusive(h)} days · no sessions
                    {h.reason ? ` · ${h.reason}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Remove this holiday?",
                      message: (
                        <>
                          Remove the closure for{" "}
                          <b className="text-paper">{formatRange(h)}</b>? Members
                          get this holiday back.
                        </>
                      ),
                      confirmLabel: "Remove",
                      danger: true,
                    });
                    if (ok) removeHoliday(h.id);
                  }}
                  aria-label="Remove holiday"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Customer holiday ledger */}
        {customers.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
              Holidays used per member · {year}
            </p>
            <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.04] text-xs uppercase tracking-wide text-paper-dim">
                    <th className="px-3 py-2 font-semibold">Member</th>
                    <th className="px-3 py-2 font-semibold">Dog(s)</th>
                    <th className="px-3 py-2 text-right font-semibold">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.key} className="border-t border-white/5">
                      <td className="px-3 py-2 text-paper">{c.ownerName}</td>
                      <td className="px-3 py-2 text-paper-dim">{c.dogNames.join(", ")}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            usedThisYear >= ANNUAL_HOLIDAY_ALLOWANCE
                              ? "bg-red-500/15 text-red-300"
                              : usedThisYear >= ANNUAL_HOLIDAY_ALLOWANCE - 1
                                ? "bg-amber-400/15 text-amber-300"
                                : "bg-emerald-400/15 text-emerald-300"
                          }`}
                        >
                          {usedThisYear} / {ANNUAL_HOLIDAY_ALLOWANCE}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {toast && <p className="mt-3 text-sm font-medium text-emerald-300">{toast}</p>}
      </div>

      {open && (
        <AddHolidayModal
          week={week}
          today={today}
          customers={customers}
          holidays={holidays}
          onClose={() => setOpen(false)}
          confirm={confirm}
          onAdded={(msg) => {
            setToast(msg);
            setOpen(false);
            window.setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
      {dialog}
    </section>
  );
}

function AddHolidayModal({
  week,
  today,
  customers,
  holidays,
  onClose,
  onAdded,
  confirm,
}: {
  week: DaySchedule[];
  today: string;
  customers: HolidayCustomer[];
  holidays: { start: string }[];
  onClose: () => void;
  onAdded: (msg: string) => void;
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const bothSet = !!start && !!end;
  const orderOk = bothSet && isoToNum(end) >= isoToNum(start);
  const period = orderOk ? { start, end } : null;

  // Allowance is checked against the year the holiday falls in.
  const holYear = start ? yearOf(start) : null;
  const usedInYear = holYear
    ? holidays.filter((h) => yearOf(h.start) === holYear).length
    : 0;
  const wouldExceed = holYear != null && usedInYear >= ANNUAL_HOLIDAY_ALLOWANCE;

  const withEmail = customers.filter((c) => c.email);
  const valid = !!period && !wouldExceed && !busy;

  async function submit() {
    if (!period) return;
    const ok = await confirm({
      title: "Add this holiday?",
      message: (
        <>
          Close for <b className="text-paper">{formatRange(period)}</b> (
          {daysInclusive(period)} days). This marks one holiday used for all{" "}
          <b className="text-paper">{customers.length}</b> members and emails{" "}
          <b className="text-paper">{withEmail.length}</b> that sessions
          won&apos;t run.
        </>
      ),
      confirmLabel: "Yes, add holiday",
    });
    if (!ok) return;
    setBusy(true);

    const holiday = {
      id: `hol-${start}-${end}`,
      start,
      end,
      reason: reason.trim() || undefined,
      createdAt: `${today}T00:00:00.000Z`,
    };
    addHoliday(holiday, customers);

    // Notify everyone their sessions won't run that week (best-effort).
    void fetch("/api/holidays/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: withEmail.map((c) => ({ email: c.email, ownerName: c.ownerName })),
        rangeLabel: formatRange(period),
        daysLabel: `${daysInclusive(period)} days`,
      }),
    });

    onAdded(`Holiday added — ${withEmail.length} members notified.`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Add a holiday</p>
            <p className="text-xs text-paper-dim">Choose the days you&apos;re away</p>
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

        <div className="grid gap-5 px-5 py-5">
          <div>
            <p className="mb-1.5 text-sm font-medium text-paper/90">First day away</p>
            <DatePicker
              todayISO={`${today}T00:00:00.000Z`}
              week={week}
              reschedules={[]}
              value={start}
              onChange={(iso) => {
                setStart(iso);
                if (end && isoToNum(end) < isoToNum(iso)) setEnd(iso);
              }}
              minDate={today}
              placeholder="Choose the first day"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-paper/90">Last day away</p>
            <DatePicker
              todayISO={`${today}T00:00:00.000Z`}
              week={week}
              reschedules={[]}
              value={end}
              onChange={setEnd}
              minDate={start || today}
              placeholder="Choose the last day"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              Reason <span className="text-paper-dim">(optional)</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Summer break"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Preview / guardrail */}
          {period && !wouldExceed && (
            <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <p className="text-sm text-paper">
                <b>{formatRange(period)}</b> · {daysInclusive(period)} days
              </p>
              <p className="mt-1 text-sm text-paper-dim">
                Marks 1 holiday used for {customers.length} member
                {customers.length === 1 ? "" : "s"} · emails {withEmail.length} owner
                {withEmail.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
          {bothSet && !orderOk && (
            <p className="text-sm text-red-400">The last day can&apos;t be before the first.</p>
          )}
          {wouldExceed && (
            <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/20">
              {holYear} already has {ANNUAL_HOLIDAY_ALLOWANCE} holiday weeks booked —
              that&apos;s the full annual allowance. Remove one first to add another.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button radius="xl" onClick={submit} disabled={!valid} className="disabled:opacity-50">
            <CheckIcon width={16} height={16} /> Add &amp; notify
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
