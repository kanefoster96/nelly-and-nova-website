"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";
import { saveDetails, useDogDetails } from "@/lib/dogs/details";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkProgress } from "@/lib/reports/progress";
import { useHomeworkResets, resetAtFor, resetDogHomework } from "@/lib/reports/reset";
import { dogCompletion } from "@/lib/reports/completion";

export type DogRow = {
  id: string;
  name: string;
  owner: string;
  photo: string;
  day: string; // training day label (read-only, from the schedule)
};

type Editable = DogRow & { breed: string; age: string; notes: string };

export function DogsList({ dogs }: { dogs: DogRow[] }) {
  const overrides = useDogDetails();
  const rows = useMemo<Editable[]>(
    () =>
      dogs.map((d) => {
        const o = overrides[d.id] ?? {};
        return {
          ...d,
          name: o.name ?? d.name,
          owner: o.owner ?? d.owner,
          breed: o.breed ?? "",
          age: o.age ?? "",
          notes: o.notes ?? "",
        };
      }),
    [dogs, overrides]
  );

  const [editId, setEditId] = useState<string | null>(null);
  const editing = rows.find((r) => r.id === editId) ?? null;

  // Homework completion per dog, for the "reset to 100%" control.
  const outbox = useOutboxCards();
  const progress = useHomeworkProgress();
  const resets = useHomeworkResets();
  const { confirm, dialog } = useConfirm();
  const cards = useMemo(() => {
    const byId = new Map<string, (typeof sampleReportCards)[number]>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    return [...byId.values()];
  }, [outbox]);

  async function resetHomework(d: Editable, percent: number) {
    const ok = await confirm({
      title: `Reset ${d.name}'s homework to 100%?`,
      message: (
        <>
          Use this when {d.owner} books a 1-1 — it clears any missed homework
          {percent < 100 ? ` (currently ${percent}%)` : ""} so their completion
          starts fresh at 100%.
        </>
      ),
      confirmLabel: "Reset to 100%",
    });
    if (ok) resetDogHomework(d.id);
  }

  return (
    <>
      <ul className="mt-8 space-y-2">
        {rows.map((d) => {
          const { percent } = dogCompletion(cards, progress, d.id, resetAtFor(resets, d.id));
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10"
            >
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.photo} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-paper">{d.name}</p>
                <p className="truncate text-xs text-paper-dim">
                  {d.owner} · {d.day}
                  {d.breed && <span> · {d.breed}</span>}
                  {d.age && <span> · {d.age}</span>}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  percent >= 100
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-amber-400/15 text-amber-300"
                }`}
                title="Homework completed (all time)"
              >
                HW {percent}%
              </span>
              <button
                type="button"
                onClick={() => resetHomework(d, percent)}
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
              >
                Reset 100%
              </button>
              <button
                type="button"
                onClick={() => setEditId(d.id)}
                className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditDogModal
          dog={editing}
          onClose={() => setEditId(null)}
          onSave={(patch) => {
            saveDetails(editing.id, patch);
            setEditId(null);
          }}
        />
      )}
      {dialog}
    </>
  );
}

function EditDogModal({
  dog,
  onClose,
  onSave,
}: {
  dog: Editable;
  onClose: () => void;
  onSave: (patch: { name: string; owner: string; breed: string; age: string; notes: string }) => void;
}) {
  const [name, setName] = useState(dog.name);
  const [owner, setOwner] = useState(dog.owner);
  const [breed, setBreed] = useState(dog.breed);
  const [age, setAge] = useState(dog.age);
  const [notes, setNotes] = useState(dog.notes);

  const input =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dog.photo} alt="" className="h-full w-full object-cover" />
          </span>
          <p className="flex-1 font-semibold text-paper">Edit {dog.name}</p>
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
          <Labeled label="Dog's name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </Labeled>
          <Labeled label="Owner's name">
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={input} />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Breed">
              <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Labrador" className={input} />
            </Labeled>
            <Labeled label="Age">
              <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 2 yrs" className={input} />
            </Labeled>
          </div>
          <Labeled label="Notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the team should know…"
              className={`${input} resize-y`}
            />
          </Labeled>
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button
            radius="xl"
            onClick={() => onSave({ name: name.trim(), owner: owner.trim(), breed: breed.trim(), age: age.trim(), notes: notes.trim() })}
            disabled={!name.trim() || !owner.trim()}
            className="disabled:opacity-50"
          >
            Save changes
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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-paper/90">{label}</span>
      {children}
    </label>
  );
}
