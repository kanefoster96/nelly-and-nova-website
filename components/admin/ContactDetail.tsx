"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  MailIcon,
  MessageIcon,
  CalendarIcon,
  CloseIcon,
  CheckIcon,
} from "@/components/ui/Icons";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PaymentsBoard } from "./PaymentsBoard";
import {
  applyOverrides,
  useScheduleOverrides,
  reassignDay,
} from "@/lib/schedule/allocations";
import { spacesLeft, dayLabel, type DayId, type DaySchedule, type ScheduledDog } from "@/lib/schedule/types";
import { chargeDayLabel, describeChargeSchedule } from "@/lib/payments/schedule";
import { recurringPriceLabel } from "@/lib/payments/pricing";
import { saveDetails, useDogDetails } from "@/lib/dogs/details";
import { cancelMember, useCancellations } from "@/lib/members/cancellations";

export type ContactDog = ScheduledDog & { day: DayId };

export function ContactDetail({
  primaryId,
  ownerName,
  email,
  dogs,
  week,
  todayISO,
}: {
  primaryId: string;
  ownerName: string;
  email?: string;
  dogs: ContactDog[];
  week: DaySchedule[];
  todayISO: string;
}) {
  const overrides = useScheduleOverrides();
  const details = useDogDetails();
  const cancelled = useCancellations();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<ContactDog | null>(null);
  const [changingDay, setChangingDay] = useState<ContactDog | null>(null);

  const merged = useMemo(() => applyOverrides(week, overrides), [week, overrides]);
  // A dog's live day reflects any reassignment already made.
  const liveDay = (id: string, fallback: DayId): DayId =>
    (merged.find((d) => d.dogs.some((x) => x.id === id))?.day as DayId) ?? fallback;

  const isCancelled = cancelled.includes(primaryId);
  const photo = dogs[0]?.photo;

  async function cancel() {
    const ok = await confirm({
      title: `Cancel ${ownerName}'s membership?`,
      message: (
        <>
          This ends the place{dogs.length > 1 ? "s" : ""}, releases the schedule slot
          {dogs.length > 1 ? "s" : ""} and stops payments. This can&apos;t be undone here.
        </>
      ),
      danger: true,
      confirmLabel: "Cancel membership",
    });
    if (ok) cancelMember(primaryId);
  }

  return (
    <div>
      {/* Header */}
      <div className="mt-4 flex items-center gap-4">
        {photo && (
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="display-heading text-2xl text-paper sm:text-3xl">{ownerName}</h1>
          <p className="truncate text-sm text-paper-dim">
            {dogs.map((d) => d.name).join(", ")}
            {email ? ` · ${email}` : ""}
          </p>
        </div>
      </div>

      {isCancelled && (
        <p className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm text-paper-dim">
          This membership is cancelled.
        </p>
      )}

      {/* Quick contact actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/inbox?name=${encodeURIComponent(ownerName)}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-paper transition-colors hover:border-white/40"
        >
          <MessageIcon width={16} height={16} /> Open chat
        </Link>
        {email && (
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-paper transition-colors hover:border-white/40"
          >
            <MailIcon width={16} height={16} /> Send email
          </a>
        )}
      </div>

      {/* Plan + dog(s) */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Plan &amp; {dogs.length > 1 ? "dogs" : "dog"}
      </h2>
      <div className="mt-3 space-y-3">
        {dogs.map((dog) => {
          const d = liveDay(dog.id, dog.day);
          const ov = details[dog.id] ?? {};
          const breed = ov.breed;
          const age = ov.age;
          const name = ov.name ?? dog.name;
          return (
            <div key={dog.id} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-paper">{name}</p>
                  <p className="text-xs text-paper-dim">
                    {[breed, age].filter(Boolean).join(" · ") || "No breed / age on file"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    dog.status === "permanent"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {dog.status === "permanent" ? "Member" : "Holding"}
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Membership" value={recurringPriceLabel()} />
                <Row label="Training day" value={`${dayLabel(d)}s`} />
                <Row
                  label="Cadence"
                  value={dog.cadence === "alternating" ? "Alternating weeks" : "Every week"}
                />
                <Row label="Charge day" value={`${chargeDayLabel(d)}s (day before)`} />
                {dog.startDate && <Row label="Started" value={dog.startDate} />}
              </dl>
              <p className="mt-2 text-xs text-paper-dim">{describeChargeSchedule(d, dog.cadence)}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(dog)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => setChangingDay({ ...dog, day: d })}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Change day
                </button>
                <Link
                  href="/admin/schedule"
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                >
                  Move a session
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payments */}
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
        Payments
      </h2>
      <PaymentsBoard week={week} todayISO={todayISO} ownerName={ownerName} compact />

      {/* Danger */}
      {!isCancelled && (
        <div className="mt-10 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={cancel}
            className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:border-red-500/70"
          >
            Cancel membership
          </button>
        </div>
      )}

      {editing && (
        <EditDetailsModal
          dog={editing}
          ownerName={ownerName}
          current={details[editing.id] ?? {}}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      {changingDay && (
        <ChangeDayModal
          dog={changingDay}
          merged={merged}
          onClose={() => setChangingDay(null)}
          onChange={async (toDay) => {
            const ok = await confirm({
              title: "Change training day?",
              message: (
                <>
                  Move <b className="text-paper">{changingDay.name}</b> to{" "}
                  <b className="text-paper">{dayLabel(toDay)}s</b>. Their weekly charge moves to{" "}
                  <b className="text-paper">{chargeDayLabel(toDay)}s</b> (the day before).
                </>
              ),
              confirmLabel: "Change day",
            });
            if (!ok) return;
            reassignDay(changingDay.id, toDay);
            setChangingDay(null);
          }}
        />
      )}
      {dialog}
      <div className="mt-8">
        <Button href="/admin" variant="ghost" radius="xl">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-paper-dim">{label}</dt>
      <dd className="text-right font-medium text-paper">{value}</dd>
    </div>
  );
}

function EditDetailsModal({
  dog,
  ownerName,
  current,
  onClose,
  onSaved,
}: {
  dog: ContactDog;
  ownerName: string;
  current: { name?: string; owner?: string; breed?: string; age?: string; notes?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(current.name ?? dog.name);
  const [owner, setOwner] = useState(current.owner ?? ownerName);
  const [breed, setBreed] = useState(current.breed ?? "");
  const [age, setAge] = useState(current.age ?? "");
  const [notes, setNotes] = useState(current.notes ?? "");

  const input =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  function save() {
    saveDetails(dog.id, { name, owner, breed, age, notes });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <p className="flex-1 font-semibold text-paper">Edit details</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <Labelled label="Owner name">
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={input} />
          </Labelled>
          <Labelled label="Dog's name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </Labelled>
          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Breed">
              <input value={breed} onChange={(e) => setBreed(e.target.value)} className={input} />
            </Labelled>
            <Labelled label="Age">
              <input value={age} onChange={(e) => setAge(e.target.value)} className={input} placeholder="e.g. 2 yrs" />
            </Labelled>
          </div>
          <Labelled label="Notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${input} resize-y`}
              placeholder="Anything to note on their profile"
            />
          </Labelled>
        </div>
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button radius="xl" onClick={save}>
            <CheckIcon width={16} height={16} /> Save
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

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-paper/90">{label}</label>
      {children}
    </div>
  );
}

function ChangeDayModal({
  dog,
  merged,
  onClose,
  onChange,
}: {
  dog: ContactDog;
  merged: DaySchedule[];
  onClose: () => void;
  onChange: (toDay: DayId) => void;
}) {
  // Days the business runs, with space, excluding the dog's current day.
  const options = merged.filter(
    (d) => d.capacity > 0 && d.day !== dog.day && spacesLeft(d) > 0
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Change {dog.name}&apos;s day</p>
            <p className="text-xs text-paper-dim">Currently {dayLabel(dog.day)}s</p>
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
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-paper/90">
            <CalendarIcon width={16} height={16} /> Move to
          </p>
          {options.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-paper-dim">
              No other days have space right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {options.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => onChange(d.day)}
                  className="flex items-center justify-between rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-paper transition-colors hover:border-white/40"
                >
                  {dayLabel(d.day)}
                  <span className="text-xs text-paper-dim">{spacesLeft(d)} left</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
