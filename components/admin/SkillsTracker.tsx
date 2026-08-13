"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/Icons";
import { SKILL_PILLARS, TOTAL_SKILLS, pillarProgress } from "@/config/skills";
import { useSkills, learntSet, toggleSkill } from "@/lib/skills/store";

/**
 * Trainer-only skills tracker for a dog. Each skill toggles between "learnt"
 * and "to learn" across the three pillars. Owners never see this — their
 * profile shows only the level out of the total per pillar.
 */
export function SkillsTracker({ dogId, dogName }: { dogId: string; dogName: string }) {
  const skills = useSkills();
  const learnt = learntSet(skills, dogId);
  const [open, setOpen] = useState(false);
  const doneTotal = SKILL_PILLARS.reduce(
    (n, p) => n + pillarProgress(p, learnt).learnt,
    0
  );

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-paper-dim">
          Training skills · {doneTotal}/{TOTAL_SKILLS} learnt
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`shrink-0 text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-paper-dim">
            Tap a skill to mark {dogName} as having learnt it. Only you can see
            and change these.
          </p>
          {SKILL_PILLARS.map((pillar) => {
            const { learnt: done, total } = pillarProgress(pillar, learnt);
            return (
              <div key={pillar.id}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-paper">{pillar.name}</span>
                  <span className="text-xs text-paper-dim">
                    {done}/{total}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pillar.drills.map((drill) => {
                    const on = learnt.has(drill.id);
                    return (
                      <button
                        key={drill.id}
                        type="button"
                        onClick={() => toggleSkill(dogId, drill.id)}
                        aria-pressed={on}
                        title={on ? "Learnt — tap to unset" : "To learn — tap to mark learnt"}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          on
                            ? "bg-accent text-accent-ink"
                            : "border border-white/15 text-paper-dim hover:border-white/40 hover:text-paper"
                        }`}
                      >
                        {on && <CheckIcon width={12} height={12} />}
                        {drill.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
