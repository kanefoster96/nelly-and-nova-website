"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { useReschedules, moveSession } from "@/lib/reschedule/store";
import { applyOverrides, useScheduleOverrides } from "@/lib/schedule/allocations";
import {
  dogsForDate,
  spaceOnDate,
  dayIdFromISO,
  formatSessionDate,
  type DogOnDate,
} from "@/lib/schedule/sessions";
import { dayLabel } from "@/lib/schedule/types";
import type { DaySchedule } from "@/lib/schedule/types";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CalendarMonth } from "./CalendarMonth";
import { DatePicker } from "./DatePicker";

export function SessionCalendar({ todayISO, week: baseWeek }: { todayISO: string; week: DaySchedule[] }) {
  const reschedules = useReschedules();
  const overrides = useScheduleOverrides();
  // Reflect allocations (held / permanent / released customers) on the calendar.
  const week = useMemo(() => applyOverrides(baseWeek, overrides), [baseWeek, overrides]);
  const [selected, setSelected] = useState(todayISO.slice(0, 10));
  const [moving, setMoving] = useState<{ item: DogOnDate; fromDate: string } | null>(null);
  const { confirm, dialog } = useConfirm();

  const openOn = (dayId: DaySchedule["day"]) => (week.find((d) => d.day === dayId)?.capacity ?? 0) > 0;
  const dogs = dogsForDate(selected, week, reschedules);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <CalendarMonth
        todayISO={todayISO}
        week={week}
        reschedules={reschedules}
        selected={selected}
        onSelect={setSelected}
      />

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
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
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
          todayISO={todayISO}
          onClose={() => setMoving(null)}
          onMove={async (toDate) => {
            const ok = await confirm({
              title: "Move this session?",
              message: (
                <>
                  Move <b className="text-paper">{moving.item.dog.name}</b> from{" "}
                  <b className="text-paper">{formatSessionDate(moving.fromDate)}</b> to{" "}
                  <b className="text-paper">{formatSessionDate(toDate)}</b>?
                </>
              ),
              confirmLabel: "Move session",
            });
            if (!ok) return;
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
      {dialog}
    </div>
  );
}

function MoveModal({
  dogName,
  fromDate,
  week,
  reschedules,
  todayISO,
  onClose,
  onMove,
}: {
  dogName: string;
  fromDate: string;
  week: DaySchedule[];
  reschedules: Parameters<typeof spaceOnDate>[2];
  todayISO: string;
  onClose: () => void;
  onMove: (toDate: string) => void;
}) {
  const [target, setTarget] = useState("");
  const targetDay = target ? dayIdFromISO(target) : null;
  const open = targetDay ? (week.find((d) => d.day === targetDay)?.capacity ?? 0) > 0 : false;
  const spaces = target && open ? spaceOnDate(target, week, reschedules, true) : 0;
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
          <p className="mb-1.5 text-sm font-medium text-paper/90">Move to</p>
          <DatePicker
            todayISO={todayISO}
            week={week}
            reschedules={reschedules}
            value={target}
            onChange={setTarget}
            minDate={todayISO.slice(0, 10)}
          />
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
