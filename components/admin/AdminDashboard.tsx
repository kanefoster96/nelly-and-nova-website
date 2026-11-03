"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  ReportIcon,
  CalendarIcon,
  PawIcon,
  UserIcon,
  CheckIcon,
  CardIcon,
} from "@/components/ui/Icons";
import { useSession, useAuthStatus, signOut } from "@/lib/auth/session";
import { formatDate } from "@/lib/inbox/format";
import {
  isComplete,
  saveReportEntry,
  type ReportEntryStatus,
  type EntryCategory,
} from "@/lib/reports/entry";
import { publishCards } from "@/lib/reports/client";
import { ReportEntryModal } from "@/components/reports/ReportEntryModal";
import { usePayments, getStatus, retryPayment } from "@/lib/payments/store";
import { PAYMENT_LABEL, type PaymentStatus } from "@/lib/payments/types";
import { money, recurringPrice } from "@/lib/payments/pricing";
import { formatSessionDate } from "@/lib/schedule/sessions";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SessionCalendar } from "./SessionCalendar";
import { AddCustomer } from "./AddCustomer";
import { HolidayManager } from "./HolidayManager";
import { HeatDayManager } from "./HeatDayManager";
import { DogStatusView } from "./DogStatusModal";
import type { DaySchedule, ScheduledDog } from "@/lib/schedule/types";
import type { OnboardingEntry } from "@/lib/inbox/onboarding";

type Form = {
  summary: string;
  wins: string[];
  strength?: string;
  toImprove?: string;
  homework: EntryCategory[];
  status: ReportEntryStatus;
  /** The draft report_cards row, once saved. */
  cardId?: string;
};

const blankForm = (): Form => ({
  summary: "",
  wins: ["", "", ""],
  homework: [{ name: "", drills: [{ name: "" }] }],
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
  week,
  customers,
}: {
  todayLabel: string;
  todayISO: string;
  dogs: ScheduledDog[];
  week: DaySchedule[];
  customers: OnboardingEntry[];
}) {
  const session = useSession();
  const authStatus = useAuthStatus();
  const router = useRouter();
  const coach = session?.ownerName ?? "Trainer";

  function logout() {
    void signOut();
    router.push("/");
  }

  const [forms, setForms] = useState<Record<string, Form>>(() =>
    Object.fromEntries(dogs.map((d) => [d.id, blankForm()]))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [payToast, setPayToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const payments = usePayments();
  const todayDate = todayISO.slice(0, 10);
  const { confirm, dialog } = useConfirm();

  async function resendPayment(dog: ScheduledDog) {
    const price = recurringPrice();
    const ok = await confirm({
      title: "Re-request payment?",
      message: (
        <>
          Ask {dog.ownerName} to resubmit {dog.name}&apos;s session payment.
        </>
      ),
      amount: money(price.amount),
      amountNote: "via GoCardless",
      confirmLabel: "Send request",
    });
    if (!ok) return;
    retryPayment(dog.id, todayDate);
    if (dog.email) {
      void fetch("/api/payments/failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: dog.email,
          ownerName: dog.ownerName,
          dogName: dog.name,
          dateLabel: formatSessionDate(todayDate),
        }),
      });
    }
    setPayToast(`Payment request sent to ${dog.name}'s owner.`);
    window.setTimeout(() => setPayToast(null), 3000);
  }

  if (authStatus === "loading") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <p className="text-paper-dim">Loading…</p>
      </div>
    );
  }

  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Trainers only</h2>
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

  /** Drop a skill/drill straight into a dog's report-card draft homework,
   *  grouped under its pillar (from the Status panel's "Add to homework"). */
  function addDrillToDraft(id: string, category: string, drill: string) {
    setForms((f) => {
      const form = f[id] ?? blankForm();
      const hw = form.homework.map((c) => ({ ...c, drills: [...c.drills] }));
      const isBlankCat = (c: EntryCategory) =>
        !c.name.trim() && c.drills.every((d) => !d.name.trim());
      const idx = hw.findIndex((c) => c.name.trim().toLowerCase() === category.toLowerCase());
      if (idx === -1) {
        const blank = hw.findIndex(isBlankCat);
        const cat: EntryCategory = { name: category, drills: [{ name: drill }] };
        if (blank === -1) hw.push(cat);
        else hw[blank] = cat;
      } else {
        const cat = hw[idx];
        const dup = cat.drills.some((d) => d.name.trim().toLowerCase() === drill.toLowerCase());
        if (!dup) {
          const blankDrill = cat.drills.findIndex((d) => !d.name.trim());
          if (blankDrill === -1) cat.drills.push({ name: drill });
          else cat.drills[blankDrill] = { name: drill };
        }
      }
      const status: ReportEntryStatus = form.status === "todo" ? "draft" : form.status;
      return { ...f, [id]: { ...form, homework: hw, status } };
    });
  }

  /** Save the dog's card as a draft in Supabase (owners can't see drafts). */
  async function persist(id: string, status: ReportEntryStatus): Promise<boolean> {
    const form = forms[id];
    setBusy(true);
    setProblem(null);
    try {
      const cardId = await saveReportEntry({ dogId: id, coach, date: todayISO, ...form, status }, form.cardId);
      patch(id, { status, cardId });
      return true;
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't save the report card.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(id: string) {
    const form = forms[id];
    const status: ReportEntryStatus = isComplete({ dogId: id, coach, date: todayISO, ...form })
      ? form.status === "ready" ? "ready" : "draft"
      : "draft";
    if (await persist(id, status)) setOpenId(null);
  }

  async function markReady(id: string) {
    const form = forms[id];
    if (!isComplete({ dogId: id, coach, date: todayISO, ...form })) return;
    if (await persist(id, "ready")) setOpenId(null);
  }

  /** Send every ready card: published, and each owner emailed and notified. */
  async function sendAll() {
    const ids = dogs.map((d) => forms[d.id]).filter((f) => f?.status === "ready" && f.cardId).map((f) => f.cardId!);
    setBusy(true);
    setProblem(null);
    try {
      await publishCards(ids);
      setForms((f) =>
        Object.fromEntries(
          Object.entries(f).map(([k, v]) => [k, v.status === "ready" ? { ...v, status: "sent" as const } : v])
        )
      );
      setSent(true);
      window.setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send the report cards.");
    } finally {
      setBusy(false);
    }
  }

  // Skills status opens as a full page (not a pop-up); back returns here.
  if (statusId) {
    return (
      <DogStatusView
        dogId={statusId}
        dogName={dogs.find((d) => d.id === statusId)?.name ?? "Dog"}
        onAddToHomework={(pillar, drill) => addDrillToDraft(statusId, pillar, drill)}
        onBack={() => setStatusId(null)}
      />
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        Trainer dashboard
      </p>
      <h1 className="display-heading mt-2 text-3xl text-paper sm:text-4xl">
        Welcome, {coach}.
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
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.photo} alt="" className="h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-paper">{d.name}</p>
                    <p className="truncate text-xs text-paper-dim">{d.ownerName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <PaymentPill
                      status={getStatus(payments, d.id, todayDate)}
                      onResend={() => resendPayment(d)}
                    />
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusId(d.id)}
                    className="h-10 shrink-0 rounded-full bg-white/10 px-3 text-xs font-semibold text-paper transition-colors hover:bg-accent hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Status
                  </button>
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
            <Button radius="xl" onClick={sendAll} disabled={!allReady || busy} className="disabled:opacity-50">
              {busy ? "Sending…" : "Send all report cards"}
            </Button>
            {!allReady && (
              <span className="text-xs text-paper-dim">
                Ready every report card to send.
              </span>
            )}
            {sent && <span className="text-sm font-medium text-emerald-300">Sent to owners ✓</span>}
          </div>
        )}
        {problem && !openId && <p className="mt-2 text-sm text-red-300">{problem}</p>}
        {payToast && (
          <p className="mt-2 text-sm font-medium text-emerald-300">{payToast}</p>
        )}
      </section>

      {/* Add a customer to the schedule (hold / permanent / one-off) */}
      <section className="mt-8">
        <AddCustomer customers={customers} week={week} todayISO={todayISO} />
      </section>

      {/* Calendar — browse any day and move a dog's session as a one-off */}
      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Calendar
        </h2>
        <SessionCalendar todayISO={todayISO} week={week} />
      </section>

      {/* Holidays — add a closure, mark members, publish + notify */}
      <HolidayManager week={week} todayISO={todayISO} />

      <HeatDayManager week={week} todayISO={todayISO} />

      {/* Navigation cards */}
      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <NavCard
          href="/admin/requests"
          icon={<CalendarIcon width={22} height={22} />}
          title="Session requests"
          body="Replacement days, extra sessions and switches to accept, plus sessions to charge."
        />
        <NavCard
          href="/admin/onboarding"
          icon={<UserIcon width={22} height={22} />}
          title="Onboarding"
          body="New enquiries — book meet & greets."
        />
        <NavCard
          href="/admin/schedule"
          icon={<CalendarIcon width={22} height={22} />}
          title="Full schedule"
          body="Every day and the dogs booked in."
        />
        <NavCard
          href="/admin/dogs"
          icon={<PawIcon width={22} height={22} />}
          title="All dogs"
          body="Every dog's details, health, vet & documents."
        />
        <NavCard
          href="/admin/reports"
          icon={<ReportIcon width={22} height={22} />}
          title="Report cards"
          body="Write, send and look back at every dog's cards."
        />
        <NavCard
          href="/admin/homework"
          icon={<CheckIcon width={22} height={22} />}
          title="Drill library"
          body="The drills homework is picked from, with their how-to pages."
        />
        <NavCard
          href="/admin/members"
          icon={<UserIcon width={22} height={22} />}
          title="Members"
          body="Contacts, plans, payments & more."
        />
        <NavCard
          href="/admin/team"
          icon={<UserIcon width={22} height={22} />}
          title="Team"
          body="Trainers' display names, photos and access."
        />
        <NavCard
          href="/admin/payments"
          icon={<CardIcon width={22} height={22} />}
          title="Manage payments"
          body="Every payment taken — retry or refund."
        />
      </section>

      {/* Log out */}
      <div className="mt-8 flex justify-center">
        <Button variant="ghost" radius="xl" onClick={logout}>
          Log out
        </Button>
      </div>

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
          onClose={() => {
            setProblem(null);
            setOpenId(null);
          }}
          busy={busy}
          problem={problem}
        />
      )}
      {dialog}
    </div>
  );
}

const PAY_STYLE: Record<PaymentStatus, string> = {
  paid: "bg-emerald-400/15 text-emerald-300",
  pending: "bg-amber-400/15 text-amber-300",
  failed: "bg-red-500/15 text-red-300",
  refunded: "bg-sky-400/15 text-sky-300",
  cancelled: "bg-white/10 text-paper-dim",
};

/** Paid/unpaid/failed chip. Unpaid + failed are tappable to re-request payment. */
function PaymentPill({ status, onResend }: { status: PaymentStatus; onResend: () => void }) {
  const cls = `rounded-full px-2.5 py-1 text-xs font-semibold ${PAY_STYLE[status]}`;
  // Settled states (paid / refunded / cancelled) aren't chase-able.
  if (status === "paid" || status === "refunded" || status === "cancelled") {
    return <span className={cls}>{PAYMENT_LABEL[status]}</span>;
  }
  return (
    <button
      type="button"
      onClick={onResend}
      title="Send payment request"
      className={`${cls} inline-flex items-center gap-1 transition-opacity hover:opacity-80`}
    >
      {PAYMENT_LABEL[status]} · Chase
    </button>
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
