"use client";

import { useState } from "react";
import { formatDate } from "@/lib/inbox/format";
import { createDraftReportCard, publishReportCard } from "@/lib/liveReports/actions";
import type { NewReportCardItem } from "@/lib/liveReports/actions";
import type { DraftReportCard } from "@/lib/liveReports/queries";
import type { RealMember } from "@/lib/admin/realMembers";

const EMPTY_ITEM: NewReportCardItem = { drillName: "", note: "" };

export function ReportCardsReal({
  members,
  initialDrafts,
}: {
  members: RealMember[];
  initialDrafts: DraftReportCard[];
}) {
  const dogs = members.flatMap((m) => m.dogs.map((d) => ({ ...d, ownerName: m.ownerName })));

  const [dogId, setDogId] = useState(dogs[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<NewReportCardItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState(initialDrafts);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<NewReportCardItem>) {
    setItems((its) => its.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function save() {
    if (!dogId) return;
    setSaving(true);
    setError(null);
    const { error } = await createDraftReportCard({ dogId, title, sessionDate, summary, items });
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    setTitle("");
    setSummary("");
    setItems([{ ...EMPTY_ITEM }]);
    // Refresh the drafts list to include what was just created.
    window.location.reload();
  }

  async function publish(id: string) {
    setPublishingId(id);
    const { error } = await publishReportCard(id);
    setPublishingId(null);
    if (!error) setDrafts((ds) => ds.filter((d) => d.id !== id));
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
        <h2 className="font-semibold text-paper">Create report card</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-paper-dim">
            Dog
            <select
              value={dogId}
              onChange={(e) => setDogId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-paper"
            >
              {dogs.map((d) => (
                <option key={d.id} value={d.id} className="bg-ink">
                  {d.name} ({d.ownerName})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-paper-dim">
            Session date
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-paper"
            />
          </label>
        </div>

        <label className="mt-3 block text-sm text-paper-dim">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Recall & loose-lead walking"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-paper placeholder:text-paper-dim/60"
          />
        </label>

        <label className="mt-3 block text-sm text-paper-dim">
          Summary
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-paper"
          />
        </label>

        <div className="mt-4 space-y-2">
          <p className="text-sm text-paper-dim">Homework</p>
          {items.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
              <input
                value={item.drillName}
                onChange={(e) => updateItem(i, { drillName: e.target.value })}
                placeholder="Drill name"
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-paper placeholder:text-paper-dim/60"
              />
              <input
                value={item.note}
                onChange={(e) => updateItem(i, { note: e.target.value })}
                placeholder="Note for the owner"
                className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-paper placeholder:text-paper-dim/60"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((its) => [...its, { ...EMPTY_ITEM }])}
            className="text-xs font-medium text-accent"
          >
            + Add another drill
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || !dogId}
          className="mt-4 rounded-full bg-paper px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as draft"}
        </button>
      </div>

      <div>
        <h2 className="font-semibold text-paper">Drafts — ready to publish</h2>
        {drafts.length === 0 ? (
          <p className="mt-3 text-sm text-paper-dim">No drafts waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-paper">
                    {d.dogName} <span className="font-normal text-paper-dim">· {d.title}</span>
                  </p>
                  <p className="text-xs text-paper-dim">
                    {d.ownerName} · {d.sessionDate ? formatDate(d.sessionDate) : "no date"} · {d.itemCount}{" "}
                    drill{d.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => publish(d.id)}
                  disabled={publishingId === d.id}
                  className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
                >
                  {publishingId === d.id ? "Publishing…" : "Publish"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
