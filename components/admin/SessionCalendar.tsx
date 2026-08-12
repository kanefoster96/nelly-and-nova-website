"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { useReschedules, moveSession } from "@/lib/reschedule/store";
import {
  monthGrid,
  monthName,
  dogsForDate,
  spacesOnDate,
  dayIdFromISO,
  formatSessionDate,
  type DogOnDate,
} from "@/lib/schedule/sessions";
import { DAYS, dayLabel } from "@/lib/schedule/types";
import type { DayId, DaySchedule } from "@/lib/schedule/types";

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

export function SessionCalendar({ todayISO, week }: { todayISO: string; week: DaySchedule[] }) {
  const reschedules = useReschedules();
  const today = todayISO.slice(0, 10);
  const [view, setView] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [selected, setSelected] = useState(today);
  const [moving, setMoving] = useState<{ item: DogOnDate; fromDate: string } | null>(null);

  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);
  const openOn = (dayId: DayId) => (week.find((d) => d.day === dayId)?.capacity ?? 0) > 0;
  const dogs = dogsForDate(selected, week, reschedules);

  function step(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      {/* Month header */}
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

      {/* Weekday labels */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-paper-dim">
        {DAYS.map((d) => (
          <div key={d.id}>{d.short}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-1 space-y-1">
        {grid.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {wk.map((cell) => {
              const open = openOn(cell.dayId);
              const count = open ? dogsForDate(cell.iso, week, reschedules).length : 0;
              const isSelected = cell.iso === selected;
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={!open}
                  onClick={() => setSelected(cell.iso)}
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
                  {count > 0 && (
                    <span
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        isSelected ? "bg-accent-ink/70" : "bg-accent"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day's dogs */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-paper">{formatSessionDate(selected)}</p>
          <span className="text-xs text-paper-dim">
            {openOn(dayIdFromISO(selected))
              ? `${dogs.length} dog${dogs.length === 1 ? "" : "s"}`
              : "Closed"}
          </span>
        </div>

        {dogs.length === 0 ? (
          <p className="mt-3 text-sm text-paper-dim">
            {openOn(dayIdFromISO(selected)) ? "No dogs on this day." : "We don't run this day."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dogs.map((item) => (
              <li
                key={item.dog.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.dog.photo} alt="" className="h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">{item.dog.name}</p>
                  <p className="truncate text-xs text-paper-dim">{item.dog.ownerName}</p>
                </div>
                {item.movedInFrom && (
                  <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Moved in
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMoving({ item, fromDate: item.movedInFrom ?? selected })}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Move
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {moving && (
        <MoveModal
          dogName={moving.item.dog.name}
          fromDate={moving.fromDate}
          week={week}
          reschedules={reschedules}
          onClose={() => setMoving(null)}
          onMove={(toDate) => {
            moveSession({
              dogId: moving.item.dog.id,
              dogName: moving.item.dog.name,
              ownerName: moving.item.dog.ownerName,
              fromDate: moving.fromDate,
              fromDay: dayIdFromISO(moving.fromDate),
              toDate,
              toDay: dayIdFromISO(toDate),
            });
            setSelected(toDate);
            setMoving(null);
          }}
        />
      )}
    </div>
  );
}

function MoveModal({
  dogName,
  fromDate,
  week,
  reschedules,
  onClose,
  onMove,
}: {
  dogName: string;
  fromDate: string;
  week: DaySchedule[];
  reschedules: Parameters<typeof spacesOnDate>[2];
  onClose: () => void;
  onMove: (toDate: string) => void;
}) {
  const [target, setTarget] = useState("");
  const targetDay = target ? dayIdFromISO(target) : null;
  const open = targetDay ? (week.find((d) => d.day === targetDay)?.capacity ?? 0) > 0 : false;
  const spaces = target && open ? spacesOnDate(target, week, reschedules) : 0;
  const sameDay = target === fromDate;
  const valid = !!target && open && spaces > 0 && !sameDay;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Move {dogName}</p>
            <p className="text-xs text-paper-dim">From {formatSessionDate(fromDate)}</p>
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
          <label className="block text-sm font-medium text-paper/90">
            Move to
            <input
              type="date"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          {target && (
            <p className="mt-2 text-sm">
              {sameDay ? (
                <span className="text-paper-dim">That&apos;s the same day.</span>
              ) : !open ? (
                <span className="text-paper-dim">We don&apos;t run on {dayLabel(targetDay!)}.</span>
              ) : spaces > 0 ? (
                <span className="text-accent">
                  {dayLabel(targetDay!)} · {spaces} space{spaces === 1 ? "" : "s"} left
                </span>
              ) : (
                <span className="text-red-400">{dayLabel(targetDay!)} is full.</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <Button
            radius="xl"
            onClick={() => valid && onMove(target)}
            disabled={!valid}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> Move session
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
