"use client";

import { useState } from "react";
import { PlusIcon, CloseIcon, ArrowRightIcon, ChevronDownIcon } from "@/components/ui/Icons";
import { HOMEWORK_LIBRARY, type LibCategory, type LibPillar } from "@/config/homeworkLibrary";
import {
  useLibrary,
  categoryDrills,
  moveDrill,
  addLibraryDrill,
  removeLibraryDrill,
  MAX_LEVEL,
  type LibDrillState,
} from "@/lib/homework-library/store";

/**
 * The drill library: pillar cards → category cards → the drills as one ordered
 * list with a "Level N" title before each level's drills. Each drill is a card
 * the trainer moves up/down through the whole list (crossing a title moves it a
 * level), opens to read the full how-to, adds or removes.
 */
export function HomeworkLibrary() {
  const overlay = useLibrary();
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const pillar = HOMEWORK_LIBRARY.find((p) => p.id === pillarId) ?? null;
  const category = pillar?.categories.find((c) => c.id === categoryId) ?? null;

  const count = (p: LibPillar, c: LibCategory) => categoryDrills(overlay, p.id, c.id).length;

  // --- View 3: a category's drills — one list with level titles ------------
  if (pillar && category) {
    const drills = categoryDrills(overlay, pillar.id, category.id);
    const maxLevel = Math.max(2, ...drills.map((d) => d.level));
    const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
    const firstId = drills[0]?.id;
    const lastId = drills[drills.length - 1]?.id;

    return (
      <div className="mt-8">
        <BackButton label={pillar.name} onClick={() => setCategoryId(null)} />
        <h2 className="mt-3 display-heading text-2xl text-paper">{category.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">
          {pillar.name} · {drills.length} drills · move a card up or down to
          reorder it or cross into another level
        </p>

        <div className="mt-5 space-y-2">
          {levels.map((level) => {
            const levelDrills = drills.filter((d) => d.level === level);
            return (
              <div key={level}>
                <div className="flex items-center justify-between pb-1.5 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                    Level {level}
                  </h3>
                  <span className="text-xs text-paper-dim">
                    {levelDrills.length} drill{levelDrills.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {levelDrills.map((drill) => (
                    <DrillCard
                      key={drill.id}
                      drill={drill}
                      pillarId={pillar.id}
                      categoryId={category.id}
                      isFirst={drill.id === firstId}
                      isLast={drill.id === lastId}
                    />
                  ))}
                </div>

                <AddDrill pillarId={pillar.id} categoryId={category.id} level={level} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- View 2: a pillar's categories ---------------------------------------
  if (pillar) {
    return (
      <div className="mt-8">
        <BackButton label="All pillars" onClick={() => setPillarId(null)} />
        <h2 className="mt-3 display-heading text-2xl text-paper">{pillar.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">{pillar.blurb}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pillar.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-paper">{c.name}</span>
                <span className="block text-xs text-paper-dim">{count(pillar, c)} drills</span>
              </span>
              <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- View 1: the three pillars -------------------------------------------
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {HOMEWORK_LIBRARY.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setPillarId(p.id)}
          className="flex flex-col rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
        >
          <span className="text-lg font-semibold text-paper">{p.name}</span>
          <span className="mt-0.5 text-xs text-paper-dim">{p.blurb}</span>
          <span className="mt-4 flex items-center justify-between text-xs font-medium text-accent">
            {p.categories.length} categories
            <ArrowRightIcon width={16} height={16} />
          </span>
        </button>
      ))}
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-paper-dim transition-colors hover:text-accent"
    >
      <ArrowRightIcon width={16} height={16} className="rotate-180" /> {label}
    </button>
  );
}

/** One drill card — move up/down through the list, open the how-to, remove. */
function DrillCard({
  drill,
  pillarId,
  categoryId,
  isFirst,
  isLast,
}: {
  drill: LibDrillState;
  pillarId: string;
  categoryId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ctrl =
    "flex h-7 w-7 items-center justify-center rounded-lg text-paper-dim transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-paper-dim";
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10">
      <div className="flex items-center gap-2 p-2.5">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => moveDrill(pillarId, categoryId, drill.id, -1)}
            className={ctrl}
          >
            <ChevronDownIcon width={15} height={15} className="rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={isLast && drill.level >= MAX_LEVEL}
            onClick={() => moveDrill(pillarId, categoryId, drill.id, 1)}
            className={ctrl}
          >
            <ChevronDownIcon width={15} height={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper">
            {drill.name}
          </span>
          <ChevronDownIcon
            width={15}
            height={15}
            className={`shrink-0 text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        <button
          type="button"
          aria-label="Remove drill"
          onClick={() => removeLibraryDrill(pillarId, categoryId, drill.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-paper-dim transition-colors hover:bg-white/10 hover:text-paper"
        >
          <CloseIcon width={15} height={15} />
        </button>
      </div>

      {open && (
        <p className="border-t border-white/10 px-3.5 py-3 text-sm leading-relaxed text-paper/80">
          {drill.description || "No how-to added yet."}
        </p>
      )}
    </div>
  );
}

function AddDrill({
  pillarId,
  categoryId,
  level,
}: {
  pillarId: string;
  categoryId: string;
  level: number;
}) {
  const [name, setName] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    addLibraryDrill(pillarId, categoryId, level, name);
    setName("");
  }
  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Add a Level ${level} drill…`}
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <PlusIcon width={14} height={14} /> Add
      </button>
    </form>
  );
}
