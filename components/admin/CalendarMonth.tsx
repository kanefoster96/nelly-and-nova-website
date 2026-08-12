"use client";

import { useState } from "react";
import { monthGrid, monthName, dogsForDate, dotColor } from "@/lib/schedule/sessions";
import { DAYS } from "@/lib/schedule/types";
import type { DaySchedule } from "@/lib/schedule/types";
import type { RescheduleRequest } from "@/lib/reschedule/types";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M12.5 5 7.5 10l5 5" : "M7.5 5l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Reusable month calendar with colour-coded fullness dots (green ≤3, orange
 * 4–5, red full). Used to browse days and as a date picker. Pass `week` already
 * merged with allocations.
 */
export function CalendarMonth({
  todayISO,
  week,
  reschedules,
  selected,
  onSelect,
  minDate,
}: {
  todayISO: string;
  week: DaySchedule[];
  reschedules: RescheduleRequest[];
  selected: string;
  onSelect: (iso: string) => void;
  /** Disable dates before this (YYYY-MM-DD). */
  minDate?: string;
}) {
  const today = todayISO.slice(0, 10);
  const seed = selected || today;
  const [view, setView] = useState(() => ({
    year: Number(seed.slice(0, 4)),
    month: Number(seed.slice(5, 7)) - 1,
  }));

  const grid = monthGrid(view.year, view.month);
  const openOn = (dayId: DaySchedule["day"]) =>
    (week.find((d) => d.day === dayId)?.capacity ?? 0) > 0;

  function step(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-paper/80 hover:bg-white/10 hover:text-paper"
        >
          <Chevron dir="left" />
        </button>
        <p className="font-semibold text-paper">{monthName(view.year, view.month)}</p>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-paper/80 hover:bg-white/10 hover:text-paper"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-paper-dim">
        {DAYS.map((d) => (
          <div key={d.id}>{d.short}</div>
        ))}
      </div>

      <div className="mt-1 space-y-1">
        {grid.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {wk.map((cell) => {
              const tooEarly = minDate ? cell.iso < minDate : false;
              const open = openOn(cell.dayId) && !tooEarly;
              const capacity = week.find((d) => d.day === cell.dayId)?.capacity ?? 0;
              const count = open ? dogsForDate(cell.iso, week, reschedules).length : 0;
              const color = dotColor(count, capacity);
              const dotClass =
                color === "red" ? "bg-red-500" : color === "orange" ? "bg-amber-400" : "bg-emerald-400";
              const isSelected = cell.iso === selected;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!open}
                  onClick={() => onSelect(cell.iso)}
                  className={`relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected
                      ? "bg-accent font-semibold text-accent-ink"
                      : !open
                        ? "text-paper-dim/40"
                        : cell.inMonth
                          ? "text-paper hover:bg-white/10"
                          : "text-paper-dim hover:bg-white/5"
                  } ${isToday && !isSelected ? "ring-1 ring-accent/60" : ""}`}
                >
                  {cell.day}
                  {color && (
                    <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-paper-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ≤3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 4–5
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> full
        </span>
      </div>
    </div>
  );
}
