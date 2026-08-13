"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseIcon, CheckIcon } from "@/components/ui/Icons";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "./DatePicker";
import type { DaySchedule } from "@/lib/schedule/types";
import { formatSessionDate } from "@/lib/schedule/sessions";
import { useHeatDays, addHeatDay, removeHeatDay, heatRecipients } from "@/lib/heat/store";
import { HEAT_COLLECTION, HEAT_DROPOFF } from "@/lib/heat/types";

/**
 * Severe heat days. On a too-hot day the trainer marks the date; collection and
 * drop-off shift earlier (6:00am / 2:00pm) to beat the midday heat, everyone
 * with a session that day is emailed, and their profile flags the change.
 */
export function HeatDayManager({
  week,
  todayISO,
}: {
  week: DaySchedule[];
  todayISO: string;
}) {
  const heatDays = useHeatDays();
  const today = todayISO.slice(0, 10);
  const { confirm, dialog } = useConfirm();

  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const recipients = useMemo(
    () => (date ? heatRecipients(week, date) : []),
    [week, date]
  );
  const withEmail = recipients.filter((r) => r.email);
  const alreadyMarked = date ? heatDays.some((h) => h.date === date) : false;

  async function mark() {
    if (!date || alreadyMarked) return;
    const ok = await confirm({
      title: "Mark as a heat day?",
      message: (
        <>
          Walk <b className="text-paper">{formatSessionDate(date)}</b> as a severe
          heat day — <b className="text-paper">{HEAT_COLLECTION}</b> and{" "}
          <b className="text-paper">{HEAT_DROPOFF}</b>. This emails{" "}
          <b className="text-paper">{withEmail.length}</b> owner
          {withEmail.length === 1 ? "" : "s"} with a session that day.
        </>
      ),
      confirmLabel: "Yes, mark hot day",
    });
    if (!ok) return;
    setBusy(true);

    addHeatDay({ date, createdAt: `${today}T00:00:00.000Z` }, recipients);
    void fetch("/api/heat/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: withEmail.map((r) => ({ email: r.email, ownerName: r.ownerName })),
        dateLabel: formatSessionDate(date),
        collectionLabel: HEAT_COLLECTION,
        dropoffLabel: HEAT_DROPOFF,
      }),
    });

    setToast(`Heat day set — ${withEmail.length} owner${withEmail.length === 1 ? "" : "s"} notified.`);
    setDate("");
    setBusy(false);
    window.setTimeout(() => setToast(null), 4000);
  }

  const upcoming = heatDays.filter((h) => h.date >= today);

  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Severe heat days
      </h2>

      <div className="mt-3 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
        <p className="text-sm text-paper/75">
          Too hot to walk in the midday sun? Mark the day and we&apos;ll walk
          early — <b className="text-paper">{HEAT_COLLECTION.toLowerCase()}</b> and{" "}
          <b className="text-paper">{HEAT_DROPOFF.toLowerCase()}</b>. Everyone with
          a session that day is emailed and it&apos;s flagged on their profile.
        </p>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-paper/90">Pick the hot day</p>
          <DatePicker
            todayISO={`${today}T00:00:00.000Z`}
            week={week}
            reschedules={[]}
            value={date}
            onChange={setDate}
            minDate={today}
            placeholder="Choose a date"
          />
        </div>

        {date && (
          <div className="mt-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
            {alreadyMarked ? (
              <p className="text-sm text-amber-300">
                {formatSessionDate(date)} is already a heat day.
              </p>
            ) : (
              <>
                <p className="text-sm text-paper">
                  <b>{formatSessionDate(date)}</b> · {recipients.length} owner
                  {recipients.length === 1 ? "" : "s"} with a session
                </p>
                <p className="mt-1 text-sm text-paper-dim">
                  Notifies {withEmail.length} · {HEAT_COLLECTION} · {HEAT_DROPOFF}
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button
            radius="xl"
            onClick={mark}
            disabled={!date || alreadyMarked || busy}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> Mark &amp; notify
          </Button>
        </div>

        {upcoming.length > 0 && (
          <ul className="mt-5 space-y-2">
            {upcoming.map((h) => (
              <li
                key={h.date}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-lg">
                  🌡️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-paper">
                    {formatSessionDate(h.date)}
                  </p>
                  <p className="truncate text-xs text-paper-dim">
                    {HEAT_COLLECTION} · {HEAT_DROPOFF}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Clear this heat day?",
                      message: (
                        <>
                          Put <b className="text-paper">{formatSessionDate(h.date)}</b> back
                          to the normal times?
                        </>
                      ),
                      confirmLabel: "Clear",
                      danger: true,
                    });
                    if (ok) removeHeatDay(h.date);
                  }}
                  aria-label="Clear heat day"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {toast && <p className="mt-3 text-sm font-medium text-emerald-300">{toast}</p>}
      </div>
      {dialog}
    </section>
  );
}
