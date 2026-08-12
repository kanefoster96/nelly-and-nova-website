"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/ui/Icons";
import { applyOverrides, holdSlot, useScheduleOverrides } from "@/lib/schedule/allocations";
import { addOneOff, useReschedules } from "@/lib/reschedule/store";
import { startRecord, confirmPlacement } from "@/lib/onboarding/store";
import { blankOnboarding, cadenceLabel } from "@/lib/onboarding/types";
import { dayIdFromISO, formatSessionDate, spacesOnDate } from "@/lib/schedule/sessions";
import { dayLabel } from "@/lib/schedule/types";
import type { Cadence, DaySchedule, ScheduledDog } from "@/lib/schedule/types";
import { ONBOARDING_FLOW, stageIndex, type OnboardingEntry } from "@/lib/inbox/onboarding";

type Placement = "hold" | "permanent" | "oneoff";

const PLACEMENTS: { id: Placement; label: string; desc: string }[] = [
  { id: "hold", label: "Temporary hold", desc: "Reserve their spot while onboarding finishes" },
  { id: "permanent", label: "Permanent space", desc: "A recurring member from the start date" },
  { id: "oneoff", label: "One-off", desc: "A single session on one date" },
];

function pickAvatar(name: string): string {
  const sum = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return `/placeholders/dog-avatar-${String((sum % 16) + 1).padStart(2, "0")}.svg`;
}

function stageLabel(stage: OnboardingEntry["stage"]): string {
  return ONBOARDING_FLOW.find((s) => s.id === stage)?.label ?? stage;
}

export function AddCustomer({
  customers,
  week,
}: {
  customers: OnboardingEntry[];
  week: DaySchedule[];
}) {
  const overrides = useScheduleOverrides();
  const reschedules = useReschedules();
  const merged = useMemo(() => applyOverrides(week, overrides), [week, overrides]);

  // Recent customers who've at least booked their meet & greet.
  const eligible = customers.filter((c) => stageIndex(c.stage) >= 1);

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>("hold");
  const [startDate, setStartDate] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [parity, setParity] = useState<"A" | "B">("A");
  const [done, setDone] = useState<string | null>(null);

  const customer = eligible.find((c) => c.id === customerId) ?? null;
  const day = startDate ? dayIdFromISO(startDate) : null;
  const daySched = day ? merged.find((d) => d.day === day) : null;
  const runs = !!daySched && daySched.capacity > 0;
  const spaces = !runs
    ? 0
    : placement === "oneoff"
      ? spacesOnDate(startDate, merged, reschedules)
      : Math.max(0, daySched!.capacity - daySched!.dogs.length);
  const valid = !!customer && !!startDate && runs && spaces > 0;

  function reset() {
    setCustomerId(null);
    setPlacement("hold");
    setStartDate("");
    setCadence("weekly");
    setParity("A");
  }

  function submit() {
    if (!valid || !customer || !day) return;
    const dogId = `cust-${customer.id}`;
    const cad: Cadence = placement === "oneoff" ? "weekly" : cadence;
    const dog: ScheduledDog = {
      id: dogId,
      name: customer.dogName,
      ownerName: customer.name,
      photo: pickAvatar(customer.dogName),
      cadence: cad,
      weekParity: placement !== "oneoff" && cad === "alternating" ? parity : undefined,
      status: placement === "permanent" ? "permanent" : "held",
      startDate: placement === "oneoff" ? undefined : startDate,
    };

    if (placement === "oneoff") {
      addOneOff({ dogId, dogName: customer.dogName, ownerName: customer.name, date: startDate, day });
    } else {
      holdSlot(day, dog);
      startRecord(
        blankOnboarding(dogId, {
          ownerName: customer.name,
          email: customer.email ?? "",
          dogName: customer.dogName,
          day,
          cadence: cad,
        })
      );
      if (placement === "permanent") {
        confirmPlacement(dogId, startDate);
        if (customer.email) {
          const startLabel = new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          });
          void fetch("/api/onboarding/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerName: customer.name,
              email: customer.email,
              dogName: customer.dogName,
              dayLabel: dayLabel(day),
              cadenceLabel: cadenceLabel(cad),
              startDateLabel: startLabel,
            }),
          });
        }
      }
    }

    setDone(
      `${customer.dogName} ${placement === "oneoff" ? "booked in for" : placement === "permanent" ? "added as a member from" : "held from"} ${formatSessionDate(startDate)}.`
    );
    reset();
    setOpen(false);
    window.setTimeout(() => setDone(null), 4000);
  }

  const input =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-accent text-accent-ink" : "border border-white/15 text-paper hover:border-white/40"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        <PlusIcon width={18} height={18} /> Add a customer to the schedule
      </button>
      {done && <p className="mt-2 text-center text-sm font-medium text-emerald-300">{done}</p>}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
            <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
              <p className="flex-1 font-semibold text-paper">Add a customer</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5">
              {/* 1. Customer */}
              <div>
                <p className="mb-2 text-sm font-medium text-paper/90">Choose a customer</p>
                {eligible.length === 0 ? (
                  <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-paper-dim">
                    No customers have completed a meet &amp; greet yet.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {eligible.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          customerId === c.id
                            ? "border-accent bg-accent/10"
                            : "border-white/15 hover:border-white/35"
                        }`}
                      >
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pickAvatar(c.dogName)} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-paper">
                            {c.dogName} · {c.name}
                          </span>
                          <span className="block truncate text-xs text-paper-dim">{c.service}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-paper/80">
                          {stageLabel(c.stage)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Placement type */}
              <div>
                <p className="mb-2 text-sm font-medium text-paper/90">Placement</p>
                <div className="grid gap-2">
                  {PLACEMENTS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlacement(p.id)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        placement === p.id ? "border-accent bg-accent/10" : "border-white/15 hover:border-white/35"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-paper">{p.label}</span>
                      <span className="block text-xs text-paper-dim">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Date + cadence */}
              <div>
                <label className="block text-sm font-medium text-paper/90">
                  {placement === "oneoff" ? "Session date" : "Start date"}
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`mt-1.5 ${input}`}
                  />
                </label>
                {startDate && (
                  <p className="mt-2 text-sm">
                    {!runs ? (
                      <span className="text-paper-dim">We don&apos;t run on {day ? dayLabel(day) : "that day"}.</span>
                    ) : spaces > 0 ? (
                      <span className="text-accent">
                        {dayLabel(day!)}
                        {placement !== "oneoff" ? "s" : ""} · {spaces} space{spaces === 1 ? "" : "s"} left
                      </span>
                    ) : (
                      <span className="text-red-400">{dayLabel(day!)} is full.</span>
                    )}
                  </p>
                )}

                {placement !== "oneoff" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-paper-dim">Cadence:</span>
                    <button type="button" className={pill(cadence === "weekly")} onClick={() => setCadence("weekly")}>
                      Weekly
                    </button>
                    <button
                      type="button"
                      className={pill(cadence === "alternating")}
                      onClick={() => setCadence("alternating")}
                    >
                      Alternating
                    </button>
                    {cadence === "alternating" && (
                      <>
                        <button type="button" className={pill(parity === "A")} onClick={() => setParity("A")}>
                          Week A
                        </button>
                        <button type="button" className={pill(parity === "B")} onClick={() => setParity("B")}>
                          Week B
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
              <Button radius="xl" onClick={submit} disabled={!valid} className="disabled:opacity-50">
                <CheckIcon width={16} height={16} />
                {placement === "permanent" ? "Add permanent spot" : placement === "oneoff" ? "Add one-off" : "Hold spot"}
              </Button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
