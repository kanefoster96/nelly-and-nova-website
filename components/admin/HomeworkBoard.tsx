"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/inbox/format";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkOverrides, saveCardHomework } from "@/lib/reports/homework";
import { HomeworkEditModal } from "@/components/reports/HomeworkEditor";
import { ACCOUNT_DOG_PROFILES } from "@/lib/dogs/account";
import type { ReportCard } from "@/lib/reports/types";
import type { DaySchedule } from "@/lib/schedule/types";

const byDateDesc = (a: ReportCard, b: ReportCard) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

/**
 * The trainer's Homework section — every dog's report cards, with the drills
 * editable in place. Saves to the shared homework-edits store, so a change here
 * shows on the owner's report card (and vice-versa).
 */
export function HomeworkBoard({
  cards: initial,
  week,
}: {
  cards: ReportCard[];
  week: DaySchedule[];
}) {
  const outbox = useOutboxCards();
  const overrides = useHomeworkOverrides();
  const [editing, setEditing] = useState<ReportCard | null>(null);

  // dogId → name/photo, from the live roster then the account sample dogs.
  const dogInfo = useMemo(() => {
    const map = new Map<string, { name: string; photo?: string }>();
    for (const d of week) for (const dog of d.dogs) map.set(dog.id, { name: dog.name, photo: dog.photo });
    for (const [id, p] of Object.entries(ACCOUNT_DOG_PROFILES)) {
      if (!map.has(id)) map.set(id, { name: p.name, photo: p.photo });
    }
    return map;
  }, [week]);

  // Merge sample + sent cards, apply any saved edit, group by dog.
  const groups = useMemo(() => {
    const byId = new Map<string, ReportCard>();
    for (const c of [...outbox, ...initial]) if (!byId.has(c.id)) byId.set(c.id, c);
    const cards = [...byId.values()].map((c) => ({
      ...c,
      homework: overrides[c.id] ?? c.homework,
    }));
    const byDog = new Map<string, ReportCard[]>();
    for (const c of cards) {
      const key = c.dogId ?? "unknown";
      byDog.set(key, [...(byDog.get(key) ?? []), c]);
    }
    return [...byDog.entries()].map(([dogId, list]) => ({
      dogId,
      name: dogInfo.get(dogId)?.name ?? "Dog",
      photo: dogInfo.get(dogId)?.photo,
      cards: list.sort(byDateDesc),
    }));
  }, [outbox, initial, overrides, dogInfo]);

  if (groups.length === 0) {
    return (
      <p className="mt-8 rounded-2xl bg-white/[0.04] p-5 text-sm text-paper-dim ring-1 ring-white/10">
        No report cards yet — homework appears here once you send cards.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {groups.map((g) => (
        <div key={g.dogId}>
          <div className="mb-2 flex items-center gap-2">
            {g.photo && (
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.photo} alt="" className="h-full w-full object-cover" />
              </span>
            )}
            <h2 className="text-sm font-semibold text-paper">{g.name}</h2>
          </div>
          <ul className="space-y-2">
            {g.cards.map((c) => {
              const drills = c.homework.reduce((n, cat) => n + cat.drills.length, 0);
              return (
                <li
                  key={c.id}
                  className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-paper">{c.focus}</p>
                      <p className="text-xs text-paper-dim">
                        {formatDate(c.date)} · {c.homework.length} categor
                        {c.homework.length === 1 ? "y" : "ies"} · {drills} drill
                        {drills === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                    >
                      Edit drills
                    </button>
                  </div>
                  {c.homework.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.homework.map((cat) => (
                        <span
                          key={cat.id}
                          className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-paper-dim"
                        >
                          {cat.name} · {cat.drills.length}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {editing && (
        <HomeworkEditModal
          title={`${editing.focus} · ${formatDate(editing.date)}`}
          initial={overrides[editing.id] ?? editing.homework}
          onSave={(cats) => saveCardHomework(editing.id, cats)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
