"use client";

/**
 * Severe-heat notice on the "Your next session" card. When the next session
 * falls on a trainer-marked heat day, this flags — in bold — that collection
 * and drop-off move earlier so the change is impossible to miss.
 */
import { useHeatDays, isHeatDay } from "@/lib/heat/store";
import { HEAT_COLLECTION, HEAT_DROPOFF } from "@/lib/heat/types";
import { formatSessionDate } from "@/lib/schedule/sessions";

export function HeatReminder({ sessionDate }: { sessionDate?: string }) {
  const heatDays = useHeatDays();
  if (!sessionDate || !isHeatDay(heatDays, sessionDate)) return null;

  return (
    <div className="mt-4 rounded-2xl bg-orange-500/10 p-4 ring-1 ring-orange-400/35">
      <p className="flex items-center gap-2 text-sm font-bold text-orange-200">
        <span className="text-xl leading-none" aria-hidden>🌡️</span>
        Extreme heat on {formatSessionDate(sessionDate)} — pick-up times changed
      </p>
      <p className="mt-2 text-base font-bold text-paper">
        {HEAT_COLLECTION} · {HEAT_DROPOFF}
      </p>
      <p className="mt-1 text-xs text-paper/70">
        We&apos;re walking early to keep everyone safe in the cool — normal times
        resume at your next session.
      </p>
    </div>
  );
}
