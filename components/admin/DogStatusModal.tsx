"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, ArrowRightIcon } from "@/components/ui/Icons";
import {
  SKILL_PILLARS,
  pillarProgress,
  pillarLevel,
  pillarLevels,
  type SkillItem,
} from "@/config/skills";
import { useSkills, learntSet, toggleSkill } from "@/lib/skills/store";
import {
  useSkillDrills,
  skillBlocks,
  addSkillBlock,
  updateSkillBlockText,
  moveSkillBlock,
  removeSkillBlock,
} from "@/lib/skill-drills/store";
import { DrillBlockEditor } from "./DrillBlockEditor";

/**
 * A dog's live skills status as a full page (opened from the today's-dogs list).
 * Each pillar shows its percentage and level; open one to tick skills off as the
 * dog learns them (which drives the level on the owner's profile). Every skill
 * also has an "Add to homework" pill that drops it into the report-card draft.
 */
export function DogStatusView({
  dogId,
  dogName,
  onAddToHomework,
  onBack,
}: {
  dogId: string;
  dogName: string;
  onAddToHomework: (pillar: string, drill: string) => void;
  onBack: () => void;
}) {
  const skills = useSkills();
  const learnt = learntSet(skills, dogId);
  const drillPages = useSkillDrills();
  const [openPillar, setOpenPillar] = useState<string | null>(SKILL_PILLARS[0]?.id ?? null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SkillItem | null>(null);

  // A skill's drill page — the "how to train this" content, shared across dogs.
  if (editing) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1.5 text-sm text-paper-dim transition-colors hover:text-accent"
        >
          <ArrowRightIcon width={16} height={16} className="rotate-180" /> {dogName}
        </button>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent">Drill page</p>
        <h1 className="display-heading text-2xl text-paper sm:text-3xl">{editing.name}</h1>
        <p className="mt-1 text-sm text-paper-dim">
          How to train this skill — owners see this page on their drill.
        </p>
        <DrillBlockEditor
          blocks={skillBlocks(drillPages, editing.id)}
          onAdd={(block) => addSkillBlock(editing.id, block)}
          onText={(blockId, text) => updateSkillBlockText(editing.id, blockId, text)}
          onMove={(blockId, dir) => moveSkillBlock(editing.id, blockId, dir)}
          onRemove={(blockId) => removeSkillBlock(editing.id, blockId)}
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-paper-dim transition-colors hover:text-accent"
      >
        <ArrowRightIcon width={16} height={16} className="rotate-180" /> Today&apos;s dogs
      </button>
      <h1 className="mt-3 display-heading text-2xl text-paper sm:text-3xl">{dogName}</h1>
      <p className="mt-1 text-sm text-paper-dim">
        Tick skills as they land · tap a skill to build its drill page
      </p>

      <div className="mt-5 space-y-2.5">
          {SKILL_PILLARS.map((pillar) => {
            const { learnt: done, total } = pillarProgress(pillar, learnt);
            const pct = total ? Math.round((done / total) * 100) : 0;
            const lvl = pillarLevel(pillar, learnt);
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
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    Level {lvl}
                  </span>
                  <span className="text-xs text-paper-dim">{pct}%</span>
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    className={`text-paper-dim transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-white/10 px-3 py-3">
                    {pillarLevels(pillar).map((level) => (
                      <div key={level}>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-paper-dim">
                          Level {level}
                        </p>
                        <div className="space-y-1">
                          {pillar.drills
                            .filter((d) => d.level === level)
                            .map((drill) => {
                              const on = learnt.has(drill.id);
                              const isAdded = added.has(drill.id);
                              const media = skillBlocks(drillPages, drill.id).length;
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
                                  <button
                                    type="button"
                                    onClick={() => setEditing(drill)}
                                    className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  >
                                    <span className="min-w-0 truncate text-sm text-paper/85 transition-colors group-hover:text-paper">
                                      {drill.name}
                                    </span>
                                    {media > 0 && (
                                      <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-paper-dim">
                                        {media}
                                      </span>
                                    )}
                                    <ArrowRightIcon
                                      width={13}
                                      height={13}
                                      className="shrink-0 text-paper-dim opacity-0 transition-opacity group-hover:opacity-100"
                                    />
                                  </button>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
