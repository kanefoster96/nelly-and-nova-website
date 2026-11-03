"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pillarLevel, pillarLevels, accountLevel, type SkillItem } from "@/config/skills";
import { useSkills, learntSet, learntAt, setDogSkills } from "@/lib/skills/store";
import { useSkillDrills, skillBlocks, addSkillBlock, updateSkillBlockText, moveSkillBlock, removeSkillBlock } from "@/lib/skill-drills/store";
import { useReports } from "@/lib/reports/client";
import { dogCompletion } from "@/lib/reports/completion";
import { resetAtFor, resetDogHomework } from "@/lib/reports/reset";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getDog } from "@/lib/records/client";
import { DrillBlockEditor } from "@/components/admin/DrillBlockEditor";
import { SkillsBar } from "@/components/profile/PracticeLibrary";
import { CARD, PILL, PRIMARY, QUIET, SECTION, longDate } from "./styles";

/**
 * A dog's skills, levels and homework on their page — Kanvas's Levels &
 * Badges. Owners see each pillar's level, the skills ticked off so far and
 * the next few; trainers tick skills off (saved together), open a skill's
 * how-to page, and reset homework to 100%.
 */
export function DogProgress({ dogId, mode }: { dogId: string; mode: "owner" | "trainer" }) {
  const [dogName, setDogName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (mode !== "trainer") return;
    getDog(dogId)
      .then((d) => setDogName(d?.name))
      .catch(() => undefined);
  }, [dogId, mode]);
  return mode === "trainer" ? <TrainerProgress dogId={dogId} dogName={dogName} /> : <OwnerProgress dogId={dogId} />;
}

function useHomeworkPercent(dogId: string) {
  const { cards, progress, resets } = useReports();
  return useMemo(() => {
    const sent = cards.filter((c) => c.status !== "draft" && c.dogId === dogId);
    return { ...dogCompletion(sent, progress, dogId, resetAtFor(resets, dogId)), cards: sent.length };
  }, [cards, progress, resets, dogId]);
}

function OwnerProgress({ dogId }: { dogId: string }) {
  const skills = useSkills();
  const learnt = learntSet(skills, dogId);
  const homework = useHomeworkPercent(dogId);

  return (
    <section className={`${CARD} mt-8 p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-paper">Skills &amp; levels</h2>
        <span className="text-sm text-paper-dim">Level {accountLevel(learnt, skills.pillars)} overall</span>
      </div>
      {skills.pillars.map((p) => {
        const done = p.drills.filter((d) => learnt.has(d.id));
        const next = p.drills.filter((d) => !learnt.has(d.id)).slice(0, 3);
        return (
          <div key={p.id} className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-paper-dim">{p.name}</p>
            <p className="mt-1 text-base text-paper">
              ⭐ <span className="font-semibold">Level {pillarLevel(p, learnt)}</span>
              <span className="text-sm text-paper-dim"> · {p.blurb}</span>
            </p>
            <SkillsBar done={done.length} total={p.drills.length} />
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
          </div>
        );
      })}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
        <span className="text-paper">
          Homework <span className="text-paper-dim">· {homework.percent}% done</span>
        </span>
        <Link href="/profile/reports" className="text-paper-dim underline underline-offset-2 hover:text-paper">
          Report cards
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-paper-dim">Skills are assessed and ticked off by your trainer.</p>
    </section>
  );
}

function TrainerProgress({ dogId, dogName }: { dogId: string; dogName?: string }) {
  const skills = useSkills();
  const pages = useSkillDrills();
  const homework = useHomeworkPercent(dogId);
  const { confirm, dialog } = useConfirm();
  const saved = learntSet(skills, dogId);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [page, setPage] = useState<SkillItem | null>(null);

  const isOn = (id: string) => ticks[id] ?? saved.has(id);
  const changes = Object.fromEntries(Object.entries(ticks).filter(([id, on]) => on !== saved.has(id)));
  const dirty = Object.keys(changes).length > 0;
  const name = dogName || "this dog";

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await setDogSkills(dogId, changes);
      setTicks({});
      setMessage({ tone: "ok", text: "Saved. The owner sees the new levels on their profile." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: `Reset ${name}'s homework to 100%?`,
      message: <>Use this when they book a 1-1. Missed homework before now stops counting{homework.percent < 100 ? ` (it's ${homework.percent}% now)` : ""}.</>,
      confirmLabel: "Reset to 100%",
    });
    if (!ok) return;
    try {
      await resetDogHomework(dogId);
      setMessage({ tone: "ok", text: `${name}'s homework is back to 100%.` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't reset." });
    }
  }

  if (page) {
    return (
      <section className={`${CARD} mt-8 p-5`}>
        <button type="button" onClick={() => setPage(null)} className="text-sm text-paper-dim hover:text-paper">
          ← {dogName ? `${dogName}'s skills` : "Skills"}
        </button>
        <p className={`mt-4 ${SECTION}`}>How-to page</p>
        <h2 className="mt-1 text-xl font-semibold text-paper">{page.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">How to train this skill. It&apos;s the same page for every dog.</p>
        <DrillBlockEditor
          blocks={skillBlocks(pages, page.id)}
          onAdd={(block) => addSkillBlock(page.id, block)}
          onText={(blockId, text) => updateSkillBlockText(page.id, blockId, text)}
          onMove={(blockId, dir) => moveSkillBlock(page.id, blockId, dir)}
          onRemove={(blockId) => removeSkillBlock(page.id, blockId)}
        />
      </section>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-paper">Homework</h2>
          <span className={`${PILL} ${homework.percent >= 100 ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
            {homework.percent}%
          </span>
        </div>
        <p className="mt-1 text-sm text-paper-dim">
          {homework.cards === 0
            ? "No report cards sent yet."
            : `${homework.completed} of ${homework.total} report cards practised on 3 days.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/reports" className={QUIET}>
            Write a report card
          </Link>
          <button type="button" onClick={reset} className={QUIET}>
            Reset to 100%
          </button>
        </div>
      </section>

      {skills.pillars.map((p) => {
        const count = p.drills.filter((d) => isOn(d.id)).length;
        return (
          <section key={p.id} className={`${CARD} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-paper">{p.name}</h2>
              <span className={`${PILL} bg-accent/15 text-accent`}>Level {pillarLevel(p, new Set(p.drills.filter((d) => isOn(d.id)).map((d) => d.id)))}</span>
            </div>
            <p className="mt-1 text-sm text-paper-dim">
              Skills ({count} of {p.drills.length})
            </p>
            {pillarLevels(p).map((level) => (
              <div key={level} className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-paper-dim">Level {level}</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {p.drills
                    .filter((d) => d.level === level)
                    .map((s) => {
                      const at = learntAt(skills, dogId, s.id);
                      const media = skillBlocks(pages, s.id).length;
                      return (
                        <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]">
                          <input
                            type="checkbox"
                            checked={isOn(s.id)}
                            onChange={(e) => setTicks((t) => ({ ...t, [s.id]: e.target.checked }))}
                            className="h-4 w-4 accent-white"
                            aria-label={s.name}
                          />
                          <span className="flex-1 text-paper/90">{s.name}</span>
                          {at && saved.has(s.id) && <span className="text-xs text-paper-dim">{longDate(at)}</span>}
                          <button type="button" onClick={() => setPage(s)} className="text-xs text-paper-dim underline underline-offset-2 hover:text-paper">
                            {media > 0 ? "How-to" : "Add how-to"}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {message && <p className={`text-sm ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</p>}
      <button type="button" onClick={save} disabled={!dirty || saving} className={`${PRIMARY} self-start`}>
        {saving ? "Saving…" : "Save"}
      </button>
      {dialog}
    </div>
  );
}
