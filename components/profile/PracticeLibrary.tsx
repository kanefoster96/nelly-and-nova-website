"use client";

import { useEffect, useMemo, useState } from "react";
import { CloseIcon, ArrowRightIcon, StarIcon } from "@/components/ui/Icons";
import { SKILL_PILLARS, pillarProgress, pillarLevel } from "@/config/skills";
import { useSkills, learntSet } from "@/lib/skills/store";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkOverrides } from "@/lib/reports/homework";
import { practiceByPillar } from "@/lib/practice";
import type { ReportCard } from "@/lib/reports/types";

/**
 * "Practice" — the owner's library. Shows the three pillars with the dog's
 * level and progress; open one to see every drill they've been given as
 * homework, lowest level first, so they can practise between sessions.
 */
export function PracticeLibrary({ dogId }: { dogId?: string }) {
  const skills = useSkills();
  const outbox = useOutboxCards();
  const overrides = useHomeworkOverrides();
  const [open, setOpen] = useState(false);
  const [pillarId, setPillarId] = useState<string | null>(null);

  const learnt = learntSet(skills, dogId);

  const byPillar = useMemo(() => {
    const byId = new Map<string, ReportCard>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    const merged = [...byId.values()].map((c) => ({ ...c, homework: overrides[c.id] ?? c.homework }));
    return practiceByPillar(merged, dogId);
  }, [outbox, overrides, dogId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pillar = SKILL_PILLARS.find((p) => p.id === pillarId) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPillarId(null);
          setOpen(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-center text-sm font-semibold leading-tight text-paper transition-colors hover:border-white/35"
      >
        <StarIcon width={18} height={18} className="shrink-0" />
        Practice
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Practice library"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="display-heading text-xl text-paper">Practice</h2>
                <p className="mt-0.5 text-sm text-paper-dim">
                  Access your homework and skills between sessions — practising
                  helps your dog land each one faster and rise up the levels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {pillar ? (
                <PillarDrills
                  name={pillar.name}
                  drills={byPillar[pillar.id] ?? []}
                  onBack={() => setPillarId(null)}
                />
              ) : (
                <div className="space-y-2.5">
                  {SKILL_PILLARS.map((p) => {
                    const { learnt: done, total } = pillarProgress(p, learnt);
                    const count = byPillar[p.id]?.length ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPillarId(p.id)}
                        className="w-full rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex-1 font-semibold text-paper">{p.name}</span>
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                            Level {pillarLevel(p, learnt)}
                          </span>
                          <ArrowRightIcon width={16} height={16} className="text-paper-dim" />
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-paper-dim">
                          {count} drill{count === 1 ? "" : "s"} to practise
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A pillar's given drills, lowest level first. */
function PillarDrills({
  name,
  drills,
  onBack,
}: {
  name: string;
  drills: { name: string; level: number }[];
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-paper-dim transition-colors hover:text-accent"
      >
        <ArrowRightIcon width={16} height={16} className="rotate-180" /> All pillars
      </button>
      <h3 className="mt-3 display-heading text-xl text-paper">{name}</h3>

      {drills.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm text-paper-dim ring-1 ring-white/10">
          No homework here yet — your trainer will add drills after your sessions.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {drills.map((d, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/10"
            >
              <span className="flex items-start gap-2 text-sm text-paper/90">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {d.name}
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-paper-dim">
                Lvl {d.level}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
