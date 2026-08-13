"use client";

import { useEffect, useState } from "react";
import { CloseIcon, CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/ui/Icons";
import { SKILL_PILLARS, pillarProgress } from "@/config/skills";
import { useSkills, learntSet, toggleSkill } from "@/lib/skills/store";

/**
 * A dog's live skills status, opened from the today's-dogs list. Each pillar
 * shows its percentage; open one to tick skills off as the dog learns them
 * (which drives the level on the owner's profile). Every skill also has an
 * "Add to homework" pill that drops it straight into the report-card draft.
 */
export function DogStatusModal({
  dogId,
  dogName,
  onAddToHomework,
  onClose,
}: {
  dogId: string;
  dogName: string;
  onAddToHomework: (pillar: string, drill: string) => void;
  onClose: () => void;
}) {
  const skills = useSkills();
  const learnt = learntSet(skills, dogId);
  const [openPillar, setOpenPillar] = useState<string | null>(SKILL_PILLARS[0]?.id ?? null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${dogName} skills status`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="display-heading text-xl text-paper">{dogName}</h2>
            <p className="mt-0.5 text-sm text-paper-dim">
              Tick skills as they land · adds to their level
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {SKILL_PILLARS.map((pillar) => {
            const { learnt: done, total } = pillarProgress(pillar, learnt);
            const pct = total ? Math.round((done / total) * 100) : 0;
            const open = openPillar === pillar.id;
            return (
              <div key={pillar.id} className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => setOpenPillar(open ? null : pillar.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex-1 font-semibold text-paper">{pillar.name}</span>
                  <span className="text-sm font-bold text-accent">{pct}%</span>
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    className={`text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="space-y-1 border-t border-white/10 px-3 py-2.5">
                    {pillar.drills.map((drill) => {
                      const on = learnt.has(drill.id);
                      const isAdded = added.has(drill.id);
                      return (
                        <div key={drill.id} className="flex items-center gap-2.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggleSkill(dogId, drill.id)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                              on
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-white/25 text-transparent hover:border-white/50"
                            }`}
                          >
                            {on && <CheckIcon width={13} height={13} />}
                          </button>
                          <span className="min-w-0 flex-1 text-sm text-paper/85">{drill.name}</span>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              onAddToHomework(pillar.name, drill.name);
                              setAdded((s) => new Set(s).add(drill.id));
                            }}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              isAdded
                                ? "bg-accent/15 text-accent"
                                : "border border-white/15 text-paper-dim hover:border-white/40 hover:text-paper"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <CheckIcon width={12} height={12} /> Added
                              </>
                            ) : (
                              <>
                                <PlusIcon width={12} height={12} /> Homework
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
