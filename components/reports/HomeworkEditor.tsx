"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import type { HomeworkCategory, HomeworkDrill } from "@/lib/reports/types";
import { DRILL_LIBRARY, drillsForCategory } from "@/config/drills";

const newDrill = (): HomeworkDrill => ({ id: crypto.randomUUID(), name: "" });
const newCat = (): HomeworkCategory => ({ id: crypto.randomUUID(), name: "", drills: [newDrill()] });

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Edit a report card's homework — categories and their drills. Preserves each
 * drill's id so ids stay stable across an edit; new drills get a fresh id and
 * blank names save as "Drill N". The card is titled from the category names,
 * previewed live. A category can be picked from the drill library, or typed.
 */
export function HomeworkEditModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: HomeworkCategory[];
  onSave: (categories: HomeworkCategory[]) => void;
  onClose: () => void;
}) {
  const [cats, setCats] = useState<HomeworkCategory[]>(
    initial.length ? initial : [newCat()]
  );

  const titlePreview = cats.map((c) => c.name.trim()).filter(Boolean).join(" · ");
  const canSave = cats.some((c) => c.name.trim());

  const patchCat = (ci: number, patch: Partial<HomeworkCategory>) =>
    setCats((cs) => cs.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setDrillName = (ci: number, di: number, name: string) =>
    setCats((cs) =>
      cs.map((c, i) =>
        i === ci ? { ...c, drills: c.drills.map((d, j) => (j === di ? { ...d, name } : d)) } : c
      )
    );
  const addDrill = (ci: number) =>
    setCats((cs) => cs.map((c, i) => (i === ci ? { ...c, drills: [...c.drills, newDrill()] } : c)));
  const removeDrill = (ci: number, di: number) =>
    setCats((cs) =>
      cs.map((c, i) => (i === ci ? { ...c, drills: c.drills.filter((_, j) => j !== di) } : c))
    );
  const removeCat = (ci: number) => setCats((cs) => cs.filter((_, i) => i !== ci));
  const addCat = () => setCats((cs) => [...cs, newCat()]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Edit homework</p>
            <p className="truncate text-xs text-paper-dim">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        {/* Library options — pick a category / drill, or type a custom one. */}
        <datalist id="hw-lib-categories">
          {DRILL_LIBRARY.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>

        <div className="grid gap-4 px-5 py-5">
          <div>
            <p className="mb-1.5 text-sm font-medium text-paper/90">Title</p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm">
              {titlePreview ? (
                <span className="text-paper">{titlePreview}</span>
              ) : (
                <span className="text-paper-dim">Set from your categories below</span>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            {cats.map((cat, ci) => (
              <div key={cat.id} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-2">
                  <input
                    value={cat.name}
                    onChange={(e) => patchCat(ci, { name: e.target.value })}
                    placeholder={`Category ${ci + 1} · e.g. Recall`}
                    list="hw-lib-categories"
                    className={`${inputCls} font-medium`}
                  />
                  {cats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCat(ci)}
                      aria-label="Remove category"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                    >
                      <CloseIcon width={16} height={16} />
                    </button>
                  )}
                </div>
                <datalist id={`hw-lib-drills-${cat.id}`}>
                  {drillsForCategory(cat.name).map((d, k) => (
                    <option key={k} value={d} />
                  ))}
                </datalist>
                <div className="mt-2 grid gap-2 border-l border-white/10 pl-3">
                  {cat.drills.map((d, di) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <input
                        value={d.name}
                        onChange={(e) => setDrillName(ci, di, e.target.value)}
                        placeholder={`Drill ${di + 1} · how to practise`}
                        list={`hw-lib-drills-${cat.id}`}
                        className={inputCls}
                      />
                      {cat.drills.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDrill(ci, di)}
                          aria-label="Remove drill"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                        >
                          <CloseIcon width={14} height={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addDrill(ci)}
                    className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-accent"
                  >
                    <PlusIcon width={14} height={14} /> Add drill
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCat}
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent"
          >
            <PlusIcon width={16} height={16} /> Add category
          </button>
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button
            radius="xl"
            onClick={() => {
              onSave(cats);
              onClose();
            }}
            disabled={!canSave}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> Save homework
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
