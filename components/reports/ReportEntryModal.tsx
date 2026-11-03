"use client";

import { Button } from "@/components/ui/Button";
import { CloseIcon, CheckIcon, PlusIcon } from "@/components/ui/Icons";
import { isComplete, type EntryCategory } from "@/lib/reports/entry";
import { useLibrary, libraryCategories, drillsForCategoryName } from "@/lib/homework-library/store";

/** What the trainer fills in for one dog's report card. */
export type EntryForm = {
  summary: string;
  wins: string[];
  /** The trainer's "biggest strength" and "biggest area to improve" (shown on the owner's Profile). */
  strength?: string;
  toImprove?: string;
  homework: EntryCategory[];
};

export const blankEntryForm = (): EntryForm => ({
  summary: "",
  wins: ["", "", ""],
  strength: "",
  toImprove: "",
  homework: [{ name: "", drills: [{ name: "" }] }],
});

/**
 * A dog's report card, as the trainer writes it after a session: a summary,
 * three things they did well, and homework — categories with drills, picked
 * from the drill library (or typed). Used from the dashboard's today's dogs
 * and from Report cards (/admin/reports).
 */
export function ReportEntryModal({
  dog,
  coach,
  dateLabel,
  form,
  onChange,
  onSaveDraft,
  onMarkReady,
  onClose,
  busy = false,
  problem = null,
  readyLabel = "Mark ready",
}: {
  dog: { id: string; name: string; photo?: string | null };
  coach: string;
  dateLabel: string;
  form: EntryForm;
  onChange: (p: Partial<EntryForm>) => void;
  onSaveDraft: () => void;
  onMarkReady: () => void;
  onClose: () => void;
  /** Shown in the footer while saving, or when it couldn't. */
  busy?: boolean;
  problem?: string | null;
  /** The primary action's label ("Mark ready", or "Send to owner"). */
  readyLabel?: string;
}) {
  const library = useLibrary();
  const complete = isComplete({ dogId: dog.id, coach, date: "", ...form });
  const inputCls =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  // The card's title is the names of its homework categories.
  const titlePreview = form.homework.map((c) => c.name.trim()).filter(Boolean).join(" · ");
  const updateCat = (ci: number, patch: Partial<EntryCategory>) =>
    onChange({ homework: form.homework.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  // A drill picked from the library keeps a link to its page (and pillar).
  const setDrill = (ci: number, di: number, name: string) =>
    onChange({
      homework: form.homework.map((c, i) => {
        if (i !== ci) return c;
        const hit = drillsForCategoryName(library, c.name).find((d) => d.name.toLowerCase() === name.trim().toLowerCase());
        return { ...c, drills: c.drills.map((d, j) => (j === di ? { name, ref: hit?.id ?? null, pillar: hit?.pillarId ?? null } : d)) };
      }),
    });
  const addDrill = (ci: number) =>
    onChange({
      homework: form.homework.map((c, i) =>
        i === ci ? { ...c, drills: [...c.drills, { name: "" }] } : c
      ),
    });
  const removeDrill = (ci: number, di: number) =>
    onChange({
      homework: form.homework.map((c, i) =>
        i === ci ? { ...c, drills: c.drills.filter((_, j) => j !== di) } : c
      ),
    });
  const removeCat = (ci: number) =>
    onChange({ homework: form.homework.filter((_, j) => j !== ci) });
  const addCat = () =>
    onChange({ homework: [...form.homework, { name: "", drills: [{ name: "" }] }] });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
            {dog.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dog.photo} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">{dog.name}&apos;s report card</p>
            <p className="text-xs text-paper-dim">
              {coach} · {dateLabel}
            </p>
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

        <div className="grid gap-5 px-5 py-5">
          {/* Title — set automatically from the homework categories below. */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              Title
            </label>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm">
              {titlePreview ? (
                <span className="text-paper">{titlePreview}</span>
              ) : (
                <span className="text-paper-dim">Set from your homework categories below</span>
              )}
            </div>
          </div>

          {/* 1. Summary */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              1 · Summary of the day
            </label>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => onChange({ summary: e.target.value })}
              placeholder="How the day went…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* 2. Three things they did well */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              2 · Three things they did well
            </label>
            <div className="grid gap-2">
              {form.wins.map((w, i) => (
                <input
                  key={i}
                  value={w}
                  onChange={(e) => {
                    const wins = [...form.wins];
                    wins[i] = e.target.value;
                    onChange({ wins });
                  }}
                  placeholder={`Win ${i + 1}`}
                  className={inputCls}
                />
              ))}
            </div>
          </div>

          {/* Biggest strength / area to improve: the owner sees the latest on their dog's Profile. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-paper/90">Biggest strength</label>
              <input
                value={form.strength ?? ""}
                onChange={(e) => onChange({ strength: e.target.value })}
                placeholder="e.g. Loose-lead walking"
                maxLength={200}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-paper/90">Biggest area to improve</label>
              <input
                value={form.toImprove ?? ""}
                onChange={(e) => onChange({ toImprove: e.target.value })}
                placeholder="e.g. Settling in the crate"
                maxLength={200}
                className={inputCls}
              />
            </div>
          </div>

          {/* 3. Homework — categories, each with drills. The card is titled
              from the category names; unnamed drills save as "Drill 1", "Drill 2". */}
          <div>
            <label className="mb-1 block text-sm font-medium text-paper/90">
              3 · Homework
            </label>
            <p className="mb-2 text-xs text-paper-dim">
              Add a category (e.g. Luring, Marker words, Recall), then drills under it.
            </p>
            <datalist id="entry-lib-categories">
              {libraryCategories(library).map((c) => (
                <option key={c.dbId} value={c.name} />
              ))}
            </datalist>
            <div className="grid gap-3">
              {form.homework.map((cat, ci) => (
                <div key={ci} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2">
                    <input
                      value={cat.name}
                      onChange={(e) => updateCat(ci, { name: e.target.value })}
                      placeholder={`Category ${ci + 1} · e.g. Recall`}
                      list="entry-lib-categories"
                      className={`${inputCls} font-medium`}
                    />
                    {form.homework.length > 1 && (
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
                  <datalist id={`entry-lib-drills-${ci}`}>
                    {drillsForCategoryName(library, cat.name).map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                  <div className="mt-2 grid gap-2 border-l border-white/10 pl-3">
                    {cat.drills.map((d, di) => (
                      <div key={di} className="flex items-center gap-2">
                        <input
                          value={d.name}
                          onChange={(e) => setDrill(ci, di, e.target.value)}
                          placeholder={`Drill ${di + 1} · how to practise`}
                          list={`entry-lib-drills-${ci}`}
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              <PlusIcon width={16} height={16} /> Add category
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button variant="secondary" radius="xl" onClick={onSaveDraft} disabled={busy} className="disabled:opacity-50">
            Save draft
          </Button>
          <Button
            radius="xl"
            onClick={onMarkReady}
            disabled={!complete || busy}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> {busy ? "Saving…" : readyLabel}
          </Button>
          {problem && <span className="min-w-0 text-xs text-red-300">{problem}</span>}
        </div>
      </div>
    </div>
  );
}
