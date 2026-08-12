"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/ui/Icons";
import {
  applyOverrides,
  confirmSlot,
  holdSlot,
  releaseSlot,
  setOnboarding,
  useScheduleOverrides,
} from "@/lib/schedule/allocations";
import { dayLabel, spacesLeft } from "@/lib/schedule/types";
import type { Cadence, DayId, DaySchedule, ScheduledDog } from "@/lib/schedule/types";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Deterministic placeholder avatar for a newly-allocated dog. */
function pickAvatar(name: string): string {
  const sum = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return `/placeholders/dog-avatar-${String((sum % 16) + 1).padStart(2, "0")}.svg`;
}

type FormState = { name: string; owner: string; cadence: Cadence; parity: "A" | "B" };
const blankForm: FormState = { name: "", owner: "", cadence: "weekly", parity: "A" };

export function ScheduleBoard({ week }: { week: DaySchedule[] }) {
  const ov = useScheduleOverrides();
  const merged = useMemo(() => applyOverrides(week, ov), [week, ov]);

  const [allocatingDay, setAllocatingDay] = useState<DayId | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function openAllocate(day: DayId) {
    setForm(blankForm);
    setConfirmingId(null);
    setAllocatingDay(day);
  }

  function submitHold(day: DayId) {
    const name = form.name.trim();
    const owner = form.owner.trim();
    if (!name || !owner) return;
    const dog: ScheduledDog = {
      id: `held-${day}-${slug(name)}`,
      name,
      ownerName: owner,
      photo: pickAvatar(name),
      cadence: form.cadence,
      weekParity: form.cadence === "alternating" ? form.parity : undefined,
      status: "held",
    };
    holdSlot(day, dog);
    setAllocatingDay(null);
    setForm(blankForm);
  }

  return (
    <div className="mt-8 space-y-4">
      {merged
        .filter((d) => d.capacity > 0)
        .map((d) => {
          const left = spacesLeft(d);
          return (
            <div
              key={d.day}
              className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-paper">{dayLabel(d.day)}</h2>
                <span
                  className={`text-xs font-medium ${left === 0 ? "text-paper-dim" : "text-accent"}`}
                >
                  {left === 0 ? "Full" : `${left} space${left > 1 ? "s" : ""} left`}
                  <span className="text-paper-dim"> · {d.dogs.length}/{d.capacity}</span>
                </span>
              </div>

              {d.dogs.length === 0 ? (
                <p className="mt-3 text-sm text-paper-dim">No dogs yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {d.dogs.map((dog) => {
                    const onb = ov.onboarding[dog.id] ?? { payment: false, waiver: false };
                    const canConfirm = onb.payment && onb.waiver;
                    return (
                      <li
                        key={dog.id}
                        className="rounded-xl bg-white/[0.03] p-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={dog.photo} alt="" className="h-full w-full object-cover" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-paper">{dog.name}</p>
                            <p className="truncate text-xs text-paper-dim">{dog.ownerName}</p>
                          </div>

                          {dog.cadence === "alternating" && (
                            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper-dim">
                              Alt {dog.weekParity}
                            </span>
                          )}

                          {dog.status === "held" ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmingId(confirmingId === dog.id ? null : dog.id)
                                }
                                className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
                              >
                                Held · confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => releaseSlot(dog.id)}
                                aria-label={`Release ${dog.name}'s slot`}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                              >
                                <CloseIcon width={15} height={15} />
                              </button>
                            </div>
                          ) : (
                            <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                              Member
                            </span>
                          )}
                        </div>

                        {/* Confirm panel — payment + waiver gate the permanent slot */}
                        {confirmingId === dog.id && dog.status === "held" && (
                          <div className="mt-2.5 rounded-lg bg-black/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                              Onboarding
                            </p>
                            <div className="mt-2 space-y-1.5">
                              <ChecklistRow
                                label="Payment set up"
                                checked={onb.payment}
                                onToggle={() => setOnboarding(dog.id, { payment: !onb.payment })}
                              />
                              <ChecklistRow
                                label="Waiver signed"
                                checked={onb.waiver}
                                onToggle={() => setOnboarding(dog.id, { waiver: !onb.waiver })}
                              />
                            </div>
                            <Button
                              radius="xl"
                              onClick={() => {
                                confirmSlot(dog.id);
                                setConfirmingId(null);
                              }}
                              disabled={!canConfirm}
                              className="mt-3 w-full justify-center text-sm disabled:opacity-50"
                            >
                              <CheckIcon width={15} height={15} /> Confirm &amp; make permanent
                            </Button>
                            {!canConfirm && (
                              <p className="mt-1.5 text-center text-[11px] text-paper-dim">
                                Payment and waiver required.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Allocate a slot */}
              {allocatingDay === d.day ? (
                <AllocateForm
                  form={form}
                  onChange={(p) => setForm((f) => ({ ...f, ...p }))}
                  onSubmit={() => submitHold(d.day)}
                  onCancel={() => setAllocatingDay(null)}
                />
              ) : (
                left > 0 && (
                  <button
                    type="button"
                    onClick={() => openAllocate(d.day)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-medium text-paper transition-colors hover:border-white/40"
                  >
                    <PlusIcon width={15} height={15} /> Allocate a slot
                  </button>
                )
              )}
            </div>
          );
        })}
    </div>
  );
}

function ChecklistRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex w-full items-center gap-2.5 text-left text-sm text-paper/85"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          checked ? "border-accent bg-accent text-accent-ink" : "border-white/30"
        }`}
      >
        {checked && <CheckIcon width={13} height={13} />}
      </span>
      {label}
    </button>
  );
}

function AllocateForm({
  form,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  onChange: (p: Partial<FormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const input =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-accent text-accent-ink" : "border border-white/15 text-paper hover:border-white/40"
    }`;
  const ready = form.name.trim() && form.owner.trim();

  return (
    <div className="mt-3 rounded-xl bg-black/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Hold a slot
      </p>
      <div className="mt-3 grid gap-2">
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Dog's name"
          className={input}
        />
        <input
          value={form.owner}
          onChange={(e) => onChange({ owner: e.target.value })}
          placeholder="Owner's name"
          className={input}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-paper-dim">Cadence:</span>
        <button type="button" className={pill(form.cadence === "weekly")} onClick={() => onChange({ cadence: "weekly" })}>
          Weekly
        </button>
        <button
          type="button"
          className={pill(form.cadence === "alternating")}
          onClick={() => onChange({ cadence: "alternating" })}
        >
          Alternating
        </button>
        {form.cadence === "alternating" && (
          <>
            <button type="button" className={pill(form.parity === "A")} onClick={() => onChange({ parity: "A" })}>
              Week A
            </button>
            <button type="button" className={pill(form.parity === "B")} onClick={() => onChange({ parity: "B" })}>
              Week B
            </button>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button radius="xl" onClick={onSubmit} disabled={!ready} className="text-sm disabled:opacity-50">
          Hold slot
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
