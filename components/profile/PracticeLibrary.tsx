"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import { SKILL_PILLARS, pillarProgress, pillarLevel } from "@/config/skills";
import { useSkills, learntSet } from "@/lib/skills/store";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkOverrides } from "@/lib/reports/homework";
import { practiceByPillar } from "@/lib/practice";
import { useLibrary, libraryNameIndex, findLibraryDrillByName } from "@/lib/homework-library/store";
import { DrillBlocks } from "./DrillPage";
import type { DrillBlock } from "@/config/homeworkLibrary";
import type { ReportCard } from "@/lib/reports/types";

/**
 * "Practice" — the owner's library as a full page (/profile/practice). Shows the
 * three pillars with the dog's level and progress; open one to see the drills
 * given as homework (lowest level first); open a drill to read its full page.
 * Everything navigates in-page with a back link — no pop-ups.
 */
export function PracticeView() {
  const session = useSession();
  const dogId = session?.dogId;
  const skills = useSkills();
  const library = useLibrary();
  const outbox = useOutboxCards();
  const overrides = useHomeworkOverrides();
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ name: string; blocks: DrillBlock[] } | null>(null);

  const learnt = learntSet(skills, dogId);

  const byPillar = useMemo(() => {
    const byId = new Map<string, ReportCard>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    const merged = [...byId.values()].map((c) => ({ ...c, homework: overrides[c.id] ?? c.homework }));
    return practiceByPillar(merged, dogId, libraryNameIndex(library));
  }, [outbox, overrides, dogId, library]);

  const pillar = SKILL_PILLARS.find((p) => p.id === pillarId) ?? null;

  if (!session) {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <p className="text-paper/80">Log in to see your practice library.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Log in
        </Link>
      </div>
    );
  }

  // --- A drill's full page -------------------------------------------------
  if (drill) {
    return (
      <div>
        <BackButton label={pillar?.name ?? "Back"} onClick={() => setDrill(null)} />
        <h1 className="mt-3 display-heading text-2xl text-paper sm:text-3xl">{drill.name}</h1>
        <div className="mt-5">
          <DrillBlocks blocks={drill.blocks} />
        </div>
      </div>
    );
  }

  // --- A pillar's given drills ---------------------------------------------
  if (pillar) {
    const drills = byPillar[pillar.id] ?? [];
    return (
      <div>
        <BackButton label="All pillars" onClick={() => setPillarId(null)} />
        <h1 className="mt-3 display-heading text-2xl text-paper sm:text-3xl">{pillar.name}</h1>
        {drills.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/[0.04] p-4 text-sm text-paper-dim ring-1 ring-white/10">
            No homework here yet — your trainer will add drills after your sessions.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {drills.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    setDrill({ name: d.name, blocks: findLibraryDrillByName(library, d.name)?.blocks ?? [] })
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
                >
                  <span className="flex items-start gap-2 text-sm text-paper/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {d.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-paper-dim">
                      Lvl {d.level}
                    </span>
                    <ArrowRightIcon width={15} height={15} className="text-paper-dim" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // --- The three pillars ---------------------------------------------------
  return (
    <div>
      <h1 className="display-heading text-3xl text-paper sm:text-4xl">Practice</h1>
      <p className="mt-3 text-paper/75">
        Access your homework and skills between sessions — practising helps your
        dog land each one faster and rise up the levels.
      </p>
      <div className="mt-6 space-y-2.5">
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
