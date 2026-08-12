"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  ReportIcon,
  CalendarIcon,
  PawIcon,
  UserIcon,
  CloseIcon,
  CheckIcon,
  PlusIcon,
} from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/inbox/format";
import {
  entryToReportCard,
  isComplete,
  saveReportEntry,
  type ReportEntryStatus,
} from "@/lib/reports/entry";
import { sendReportCards } from "@/lib/reports/data";
import { sendToOutbox } from "@/lib/reports/outbox";
import type { ScheduledDog } from "@/lib/schedule/types";

type Form = {
  focus: string;
  summary: string;
  wins: string[];
  homework: string[];
  status: ReportEntryStatus;
};

const blankForm = (): Form => ({
  focus: "",
  summary: "",
  wins: ["", "", ""],
  homework: [""],
  status: "todo",
});

const STATUS_STYLE: Record<ReportEntryStatus, string> = {
  todo: "bg-white/10 text-paper-dim",
  draft: "bg-amber-400/15 text-amber-300",
  ready: "bg-accent/20 text-accent",
  sent: "bg-emerald-400/15 text-emerald-300",
};
const STATUS_LABEL: Record<ReportEntryStatus, string> = {
  todo: "To do",
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
};

export function AdminDashboard({
  todayLabel,
  todayISO,
  dogs,
}: {
  todayLabel: string;
  todayISO: string;
  dogs: ScheduledDog[];
}) {
  const session = useSession();
  const coach = session?.ownerName ?? "Coach";

  const [forms, setForms] = useState<Record<string, Form>>(() =>
    Object.fromEntries(dogs.map((d) => [d.id, blankForm()]))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Coaches only</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          This dashboard is for the Nelly &amp; Nova team.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }

  const openDog = dogs.find((d) => d.id === openId) ?? null;
  const readyCount = dogs.filter((d) => forms[d.id]?.status === "ready" || forms[d.id]?.status === "sent").length;
  const allReady = dogs.length > 0 && readyCount === dogs.length;

  function patch(id: string, p: Partial<Form>) {
    setForms((f) => ({ ...f, [id]: { ...f[id], ...p } }));
  }

  function saveDraft(id: string) {
    const form = forms[id];
    const status: ReportEntryStatus = isComplete({
      dogId: id, coach, date: todayISO, ...form,
    })
      ? form.status === "ready" ? "ready" : "draft"
      : "draft";
    patch(id, { status });
    void saveReportEntry({ dogId: id, coach, date: todayISO, ...form, status });
    setOpenId(null);
  }

  function markReady(id: string) {
    const form = forms[id];
    if (!isComplete({ dogId: id, coach, date: todayISO, ...form })) return;
    patch(id, { status: "ready" });
    void saveReportEntry({ dogId: id, coach, date: todayISO, ...form, status: "ready" });
    setOpenId(null);
  }

  function sendAll() {
    // Turn every ready entry into an owner-facing report card and send it.
    const cards = dogs
      .filter((d) => forms[d.id]?.status === "ready" || forms[d.id]?.status === "sent")
      .map((d) => entryToReportCard({ dogId: d.id, coach, date: todayISO, ...forms[d.id] }));
    void sendReportCards(cards); // backend seam (insert + notify) — TODO
    sendToOutbox(cards); // scaffold: surface to owners + light their badge now
    setForms((f) =>
      Object.fromEntries(
        Object.entries(f).map(([k, v]) => [k, { ...v, status: "sent" as const }])
      )
    );
    setSent(true);
    window.setTimeout(() => setSent(false), 2500);
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        Coach dashboard
      </p>
      <h1 className="display-heading mt-2 text-3xl text-paper sm:text-4xl">
        Welcome, coach {coach}.
      </h1>
      <p className="mt-2 text-paper/70">
        {todayLabel} · {formatDate(todayISO)}
      </p>

      {/* Today's dogs */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Today&apos;s dogs
          </h2>
          <span className="text-xs text-paper-dim">
            {readyCount}/{dogs.length} ready
          </span>
        </div>

        {dogs.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-white/[0.04] p-5 text-sm text-paper-dim ring-1 ring-white/10">
            No dogs scheduled today.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dogs.map((d) => {
              const status = forms[d.id]?.status ?? "todo";
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10"
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.photo} alt="" className="h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-paper">{d.name}</p>
                    <p className="truncate text-xs text-paper-dim">{d.ownerName}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenId(d.id)}
                    aria-label={`Report card for ${d.name}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-accent hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <ReportIcon width={18} height={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {dogs.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <Button radius="xl" onClick={sendAll} disabled={!allReady} className="disabled:opacity-50">
              Send all report cards
            </Button>
            {!allReady && (
              <span className="text-xs text-paper-dim">
                Ready every report card to send.
              </span>
            )}
            {sent && <span className="text-sm font-medium text-emerald-300">Sent to owners ✓</span>}
          </div>
        )}
      </section>

      {/* Navigation cards */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <NavCard
          href="/admin/schedule"
          icon={<CalendarIcon width={22} height={22} />}
          title="Full schedule"
          body="Every day and the dogs booked in."
        />
        <NavCard
          href="/admin/dogs"
          icon={<PawIcon width={22} height={22} />}
          title="All dog profiles"
          body="View and edit dog information."
        />
        <NavCard
          href="/admin/reports"
          icon={<ReportIcon width={22} height={22} />}
          title="Recent report cards"
          body="The latest cards across all dogs."
        />
        <NavCard
          href="/admin/members"
          icon={<UserIcon width={22} height={22} />}
          title="Members"
          body="Manage or cancel a member's account."
        />
      </section>

      {/* Report entry modal */}
      {openDog && (
        <ReportEntryModal
          dog={openDog}
          coach={coach}
          dateLabel={formatDate(todayISO)}
          form={forms[openDog.id]}
          onChange={(p) => patch(openDog.id, p)}
          onSaveDraft={() => saveDraft(openDog.id)}
          onMarkReady={() => markReady(openDog.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-colors hover:ring-white/25"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-paper">{title}</span>
        <span className="mt-0.5 block text-sm text-paper/70">{body}</span>
      </span>
    </Link>
  );
}

function ReportEntryModal({
  dog,
  coach,
  dateLabel,
  form,
  onChange,
  onSaveDraft,
  onMarkReady,
  onClose,
}: {
  dog: ScheduledDog;
  coach: string;
  dateLabel: string;
  form: Form;
  onChange: (p: Partial<Form>) => void;
  onSaveDraft: () => void;
  onMarkReady: () => void;
  onClose: () => void;
}) {
  const complete = isComplete({ dogId: dog.id, coach, date: "", ...form });
  const inputCls =
    "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center gap-3 border-b border-white/10 bg-ink px-5 py-4">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dog.photo} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">{dog.name}&apos;s report card</p>
            <p className="text-xs text-paper-dim">
              Coach {coach} · {dateLabel}
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
          {/* Headline — the card title the owner sees. */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              Headline
            </label>
            <input
              value={form.focus}
              onChange={(e) => onChange({ focus: e.target.value })}
              placeholder="e.g. Loose lead &amp; recall"
              className={inputCls}
            />
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
              className={`${inputCls} resize-y`}
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

          {/* 3. Homework */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              3 · Homework for the week
            </label>
            <div className="grid gap-2">
              {form.homework.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={h}
                    onChange={(e) => {
                      const homework = [...form.homework];
                      homework[i] = e.target.value;
                      onChange({ homework });
                    }}
                    placeholder={`Homework ${i + 1}`}
                    className={inputCls}
                  />
                  {form.homework.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ homework: form.homework.filter((_, j) => j !== i) })
                      }
                      aria-label="Remove homework"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper-dim hover:text-paper"
                    >
                      <CloseIcon width={16} height={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange({ homework: [...form.homework, ""] })}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              <PlusIcon width={16} height={16} /> Add homework
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-white/10 bg-ink px-5 py-4">
          <Button variant="secondary" radius="xl" onClick={onSaveDraft}>
            Save draft
          </Button>
          <Button
            radius="xl"
            onClick={onMarkReady}
            disabled={!complete}
            className="disabled:opacity-50"
          >
            <CheckIcon width={16} height={16} /> Mark ready
          </Button>
        </div>
      </div>
    </div>
  );
}
