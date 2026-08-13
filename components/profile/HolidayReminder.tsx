"use client";

/**
 * Member-facing holiday reminder shown on the dog profile. Surfaces the two
 * reminders in-app (the backend also sends them by email — see
 * lib/holidays/data.ts):
 *  - if their next session falls in a closure → "that session isn't on"
 *  - otherwise, if a closure starts within a week → "one week to go"
 * Renders nothing when no closure is near. Client-only (reads the holidays
 * store), so it never appears until after hydration.
 */
import { useHolidays, holidayCoveringDate } from "@/lib/holidays/store";
import { formatRange, isoToNum, addDaysISO } from "@/lib/holidays/dates";
import {
  upcomingSessions,
  dayIdFromISO,
  formatSessionDate,
} from "@/lib/schedule/sessions";
import type { Cadence, DayId } from "@/lib/schedule/types";

export function HolidayReminder({
  dayId,
  cadence,
  dogName,
}: {
  dayId?: DayId;
  cadence?: Cadence;
  dogName: string;
}) {
  const holidays = useHolidays();
  if (!dayId || !cadence || holidays.length === 0) return null;

  const todayISO = new Date().toISOString();
  const today = todayISO.slice(0, 10);

  // Their sessions from now (include today if today is their training day).
  const upcoming = upcomingSessions({ dayId, cadence }, todayISO, 1);
  const candidates =
    dayIdFromISO(today) === dayId ? [{ date: today, day: dayId }, ...upcoming] : upcoming;

  const covered = candidates.find((s) => holidayCoveringDate(holidays, s.date));
  if (covered) {
    const h = holidayCoveringDate(holidays, covered.date)!;
    return (
      <Banner emoji="🏖️">
        <span className="font-semibold text-paper">
          No session on {formatSessionDate(covered.date)}
        </span>{" "}
        — we&apos;re closed for our holiday ({formatRange(h)}). {dogName}&apos;s place is
        safe and picks up as normal the week after.
      </Banner>
    );
  }

  // Otherwise a heads-up if a closure starts within the next week.
  const soon = holidays.find((h) => {
    const n = isoToNum(h.start);
    return n >= isoToNum(today) && n <= isoToNum(addDaysISO(today, 7));
  });
  if (soon) {
    return (
      <Banner emoji="🗓️">
        <span className="font-semibold text-paper">One week to go</span> — we&apos;re
        closed {formatRange(soon)}. No sessions that week; everything resumes as normal
        afterwards.
      </Banner>
    );
  }

  return null;
}

function Banner({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <span className="text-2xl leading-none" aria-hidden>
        {emoji}
      </span>
      <p className="text-sm text-paper/85">{children}</p>
    </div>
  );
}
