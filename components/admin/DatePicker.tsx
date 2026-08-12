"use client";

import { useState } from "react";
import { CalendarIcon, ChevronDownIcon } from "@/components/ui/Icons";
import { formatSessionDate } from "@/lib/schedule/sessions";
import type { DaySchedule } from "@/lib/schedule/types";
import type { RescheduleRequest } from "@/lib/reschedule/types";
import { CalendarMonth } from "./CalendarMonth";

/**
 * A collapsed date field that opens our colour-coded calendar (green ≤3 /
 * orange 4–5 / red full) when clicked — used everywhere a session date is
 * picked, instead of the browser's native date input.
 */
export function DatePicker({
  todayISO,
  week,
  reschedules,
  value,
  onChange,
  minDate,
  placeholder = "Choose a date",
}: {
  todayISO: string;
  week: DaySchedule[];
  reschedules: RescheduleRequest[];
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-left text-sm transition-colors hover:border-white/35"
      >
        <CalendarIcon width={18} height={18} className="shrink-0 text-paper-dim" />
        <span className={`flex-1 ${value ? "text-paper" : "text-paper-dim"}`}>
          {value ? formatSessionDate(value) : placeholder}
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`shrink-0 text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl bg-black/20 p-3 ring-1 ring-white/5">
          <CalendarMonth
            todayISO={todayISO}
            week={week}
            reschedules={reschedules}
            selected={value}
            minDate={minDate}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
