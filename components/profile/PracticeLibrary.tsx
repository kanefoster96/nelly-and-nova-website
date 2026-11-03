"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import { pillarProgress, pillarLevel, pillarLevels } from "@/config/skills";
import { useSkills, learntSet } from "@/lib/skills/store";
import { useReports } from "@/lib/reports/client";
import { practiceByPillar } from "@/lib/practice";
import { useLibrary, findLibraryDrill, findLibraryDrillByName } from "@/lib/homework-library/store";
import { DrillBlocks } from "./DrillPage";
import { CARD, EYEBROW, TITLE, INTRO, BACK, PILL } from "@/components/reports/styles";
import type { DrillBlock } from "@/config/homeworkLibrary";

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
  const { cards, loaded } = useReports();
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ name: string; level: number; blocks: DrillBlock[] } | null>(null);

  const learnt = learntSet(skills, dogId);
  const pillars = skills.pillars;

  const byPillar = useMemo(
    () => practiceByPillar(cards, dogId, library, pillars.map((p) => p.id)),
    [cards, dogId, library, pillars]
  );

  const pillar = pillars.find((p) => p.id === pillarId) ?? null;

  if (!session) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className="text-paper/80">Log in to see your practice library.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90">
          Log in
        </Link>
      </div>
    );
  }

  // --- A drill's full page -------------------------------------------------
  if (drill) {
    return (
      <div>
        <button type="button" onClick={() => setDrill(null)} className={BACK}>
          ← {pillar?.name ?? "Back"}
        </button>
        <p className={`mt-6 ${EYEBROW}`}>
          {pillar?.name} · Level {drill.level}
        </p>
        <h1 className={TITLE}>{drill.name}</h1>
        <div className="mt-6">
          <DrillBlocks blocks={drill.blocks} />
        </div>
      </div>
    );
  }

  // --- A pillar: the dog's skills so far, then the homework drills ---------
  if (pillar) {
    const drills = byPillar[pillar.id] ?? [];
    const done = pillar.drills.filter((d) => learnt.has(d.id));
    const next = pillar.drills.filter((d) => !learnt.has(d.id)).slice(0, 3);
    const level = pillarLevel(pillar, learnt);
    const levels = pillarLevels(pillar);
    return (
      <div>
        <button type="button" onClick={() => setPillarId(null)} className={BACK}>
          ← Practice
        </button>
        <p className={`mt-6 ${EYEBROW}`}>{session.dogName ?? "Your dog"}</p>
        <h1 className={TITLE}>{pillar.name}</h1>
        <p className={INTRO}>{pillar.blurb}</p>

        <section className={`${CARD} mt-6 p-5`}>
          <p className="text-base text-paper">
            ⭐ <span className="font-semibold">Level {level}</span>
            {levels.length > 1 && <span className="text-sm text-paper-dim"> · {levels.length} levels</span>}
          </p>
          <SkillsBar done={done.length} total={pillar.drills.length} />
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {done.map((s) => (
              <li key={s.id} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                ✓ {s.name}
              </li>
            ))}
            {next.map((s) => (
              <li key={s.id} className="rounded-full border border-white/10 px-2.5 py-1 text-paper-dim">
                {s.name}
              </li>
            ))}
          </ul>
        </section>

        <h2 className="mt-8 text-lg font-semibold text-paper">Homework to practise</h2>
        {drills.length === 0 ? (
          <p className={`${CARD} mt-3 px-6 py-8 text-center text-sm text-paper-dim`}>
            No homework here yet. Your trainer will add drills after your sessions.
          </p>
        ) : (
          <ul className={`${CARD} mt-3 divide-y divide-white/10`}>
            {drills.map((d) => (
              <li key={`${d.ref ?? d.name}`}>
                <button
                  type="button"
                  onClick={() =>
                    setDrill({
                      name: d.name,
                      level: d.level,
                      blocks: (findLibraryDrill(library, d.ref)?.drill ?? findLibraryDrillByName(library, d.name))?.blocks ?? [],
                    })
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-sm text-paper/90">{d.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`${PILL} bg-white/10 font-medium text-paper-dim`}>Level {d.level}</span>
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
      <p className={EYEBROW}>{session.dogName ?? "Your dog"}</p>
      <h1 className={TITLE}>Practice</h1>
      <p className={INTRO}>
        Your homework and skills between sessions. Practising helps your dog land each one faster and rise up the levels.
      </p>
      <div className="mt-6 space-y-3">
        {pillars.map((p) => {
          const { learnt: done, total } = pillarProgress(p, learnt);
          const count = byPillar[p.id]?.length ?? 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPillarId(p.id)}
              className={`${CARD} block w-full p-5 text-left transition-colors hover:border-white/25`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs uppercase tracking-widest text-paper-dim">{p.name}</span>
                <ArrowRightIcon width={16} height={16} className="text-paper-dim" />
              </div>
              <p className="mt-1 text-base text-paper">
                ⭐ <span className="font-semibold">Level {pillarLevel(p, learnt)}</span>
              </p>
              <SkillsBar done={done} total={total} />
              <p className="mt-2 text-xs text-paper-dim">
                {loaded ? `${count} drill${count === 1 ? "" : "s"} to practise` : "Loading homework…"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Skills · 3 of 5" with a green bar, as on Kanvas's Levels & Badges. */
export function SkillsBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-paper">Skills</span>
        <span className="text-paper-dim">
          {done} of {total}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
