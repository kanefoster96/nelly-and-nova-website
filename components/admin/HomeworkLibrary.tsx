"use client";

import { useState } from "react";
import { PlusIcon, CloseIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { HOMEWORK_LIBRARY, type LibCategory, type LibLevel } from "@/config/homeworkLibrary";
import {
  useLibraryOverlay,
  levelKey,
  mergeDrills,
  addDrill,
  removeDrill,
  type LibraryOverlay,
} from "@/lib/homework-library/store";

/**
 * The drill library, browsed the way training is built: three pillar cards →
 * category cards (with drill counts) → the drills split by level. Trainers add
 * and remove drills at each level.
 */
export function HomeworkLibrary() {
  const overlay = useLibraryOverlay();
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const pillar = HOMEWORK_LIBRARY.find((p) => p.id === pillarId) ?? null;
  const category = pillar?.categories.find((c) => c.id === categoryId) ?? null;

  const countFor = (pId: string, c: LibCategory) =>
    c.levels.reduce(
      (n, lvl) => n + mergeDrills(lvl.drills, levelKey(pId, c.id, lvl.level), overlay).length,
      0
    );

  // --- View 3: a category's drills, by level -------------------------------
  if (pillar && category) {
    return (
      <div className="mt-8">
        <BackButton
          label={pillar.name}
          onClick={() => setCategoryId(null)}
        />
        <h2 className="mt-3 display-heading text-2xl text-paper">{category.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">
          {pillar.name} · {countFor(pillar.id, category)} drills
        </p>

        <div className="mt-5 space-y-5">
          {category.levels.map((lvl) => (
            <LevelBlock
              key={lvl.level}
              lvl={lvl}
              lkey={levelKey(pillar.id, category.id, lvl.level)}
              overlay={overlay}
            />
          ))}
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
                <span className="block text-xs text-paper-dim">
                  {countFor(pillar.id, c)} drills · {c.levels.length} levels
                </span>
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

/** One level: its drills (add/remove), inside a category. */
function LevelBlock({
  lvl,
  lkey,
  overlay,
}: {
  lvl: LibLevel;
  lkey: string;
  overlay: LibraryOverlay;
}) {
  const [text, setText] = useState("");
  const drills = mergeDrills(lvl.drills, lkey, overlay);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addDrill(lkey, text);
    setText("");
  }

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Level {lvl.level}
        </h3>
        <span className="text-xs text-paper-dim">
          {drills.length} drill{drills.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {drills.map((d) => (
          <li
            key={d.id}
            className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-paper/85"
          >
            <span className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {d.name}
            </span>
            <button
              type="button"
              onClick={() => removeDrill(lkey, d.id)}
              aria-label="Remove drill"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-paper-dim hover:bg-white/10 hover:text-paper"
            >
              <CloseIcon width={14} height={14} />
            </button>
          </li>
        ))}
        {drills.length === 0 && (
          <li className="text-sm text-paper-dim">No drills yet — add one below.</li>
        )}
      </ul>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add a Level ${lvl.level} drill…`}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <PlusIcon width={14} height={14} /> Add
        </button>
      </form>
    </div>
  );
}
