"use client";

/**
 * The "Scheduled Holidays" block on the public holidays page. Merges the static
 * config dates (rendered on the server for SEO) with any closures the trainer
 * has added from the dashboard (client-only store), so newly-added holidays
 * appear here automatically.
 */
import { useHolidays } from "@/lib/holidays/store";
import {
  type Period,
  isoToNum,
  daysInclusive,
  formatRange,
  affectedMonths,
  monthLabel,
} from "@/lib/holidays/dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ScheduledHolidays({
  heading,
  year,
  configPeriods,
}: {
  heading: string;
  year: string;
  configPeriods: Period[];
}) {
  const holidays = useHolidays();

  // Merge config + trainer-added, de-duplicate identical ranges, sort by start.
  const seen = new Set<string>();
  const periods: Period[] = [];
  for (const p of [...configPeriods, ...holidays.map((h) => ({ start: h.start, end: h.end }))]) {
    const key = `${p.start}_${p.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push(p);
  }
  periods.sort((a, b) => isoToNum(a.start) - isoToNum(b.start));

  const closedRanges = periods.map((p) => [isoToNum(p.start), isoToNum(p.end)] as const);
  const isClosed = (y: number, m: number, d: number) => {
    const n = y * 10000 + (m + 1) * 100 + d;
    return closedRanges.some(([a, b]) => n >= a && n <= b);
  };

  function MonthCalendar({ y, m }: { y: number; m: number }) {
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday-first
    const cells: (number | null)[] = [
      ...Array<null>(lead).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return (
      <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/5">
        <p className="display-heading text-lg text-paper">{monthLabel(y, m)}</p>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-paper-dim">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) =>
            d === null ? (
              <div key={i} />
            ) : (
              <div
                key={i}
                className={`flex h-9 items-center justify-center rounded-full text-sm ${
                  isClosed(y, m, d) ? "bg-paper font-semibold text-ink" : "text-paper/70"
                }`}
              >
                {d}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <h2 className="display-heading text-xl text-paper sm:text-2xl">{heading}</h2>
      <p className="mt-2 text-paper-dim">{year}</p>

      {/* Prominent date cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {periods.map((p, i) => (
          <div key={i} className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Closed</p>
            <p className="display-heading mt-3 text-2xl text-paper sm:text-3xl">{formatRange(p)}</p>
            <p className="mt-3 text-sm text-paper-dim">
              {daysInclusive(p)} days · no sessions or collections
            </p>
          </div>
        ))}
      </div>

      {/* Calendars */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {affectedMonths(periods).map((mm, i) => (
          <MonthCalendar key={i} y={mm.y} m={mm.m} />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-paper-dim">
        <span className="inline-block h-4 w-4 rounded-full bg-paper" />
        Unavailable
      </div>
    </div>
  );
}
