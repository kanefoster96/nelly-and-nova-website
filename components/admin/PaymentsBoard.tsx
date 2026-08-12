"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  usePayments,
  getStatus,
  retryPayment,
  refundPayment,
} from "@/lib/payments/store";
import { PAYMENT_LABEL, type PaymentStatus } from "@/lib/payments/types";
import { money } from "@/lib/payments/pricing";
import { paymentHistory, type PaymentRecord } from "@/lib/payments/history";
import { useReschedules } from "@/lib/reschedule/store";
import type { DaySchedule } from "@/lib/schedule/types";

const CHIP: Record<PaymentStatus, string> = {
  paid: "bg-emerald-400/15 text-emerald-300",
  pending: "bg-amber-400/15 text-amber-300",
  failed: "bg-red-500/15 text-red-300",
  refunded: "bg-sky-400/15 text-sky-300",
  cancelled: "bg-white/10 text-paper-dim",
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Every payment taken, newest first, with retry (failed/unpaid) and refund
 * (full or partial) actions. `ownerName` scopes it to one member (used from the
 * contact page); omitted, it shows everyone.
 */
export function PaymentsBoard({
  week,
  todayISO,
  ownerName,
  compact,
}: {
  week: DaySchedule[];
  todayISO: string;
  ownerName?: string;
  compact?: boolean;
}) {
  const payments = usePayments();
  const reschedules = useReschedules();
  const { confirm, dialog } = useConfirm();
  const [refunding, setRefunding] = useState<PaymentRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const records = useMemo(() => {
    const all = paymentHistory(week, reschedules, todayISO);
    return ownerName ? all.filter((r) => r.ownerName === ownerName) : all;
  }, [week, reschedules, todayISO, ownerName]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  async function retry(r: PaymentRecord) {
    const ok = await confirm({
      title: "Retry this payment?",
      message: (
        <>
          Re-request {r.dogName}&apos;s payment from {r.ownerName} for{" "}
          <b className="text-paper">{shortDate(r.sessionDate)}</b>.
        </>
      ),
      amount: money(r.amount),
      amountNote: "via GoCardless",
      confirmLabel: "Retry payment",
    });
    if (!ok) return;
    retryPayment(r.dogId, r.sessionDate);
    flash(`Payment retried for ${r.dogName}.`);
  }

  const totalCollected = records
    .filter((r) => {
      const s = getStatus(payments, r.dogId, r.sessionDate);
      return s === "paid";
    })
    .reduce((n, r) => n + r.amount, 0);

  return (
    <div>
      {!compact && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <div>
            <p className="text-xs uppercase tracking-wide text-paper-dim">Payments</p>
            <p className="text-lg font-semibold text-paper">{records.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-paper-dim">Collected</p>
            <p className="text-lg font-semibold text-emerald-300">{money(totalCollected)}</p>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/[0.04] p-5 text-sm text-paper-dim ring-1 ring-white/10">
          No payments yet.
        </p>
      ) : (
        <ul className={`${compact ? "mt-3" : "mt-4"} space-y-2`}>
          {records.map((r) => {
            const status = getStatus(payments, r.dogId, r.sessionDate);
            const canRetry = status === "failed" || status === "pending";
            const canRefund = status === "paid";
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-paper">
                    {r.dogName}
                    {!ownerName && <span className="font-normal text-paper-dim"> · {r.ownerName}</span>}
                  </p>
                  <p className="truncate text-xs text-paper-dim">
                    {r.kind === "extra" ? `${r.service ?? "Extra session"} · ` : ""}
                    {shortDate(r.chargeDate)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-paper">{money(r.amount)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[status]}`}>
                  {PAYMENT_LABEL[status]}
                </span>
                {canRetry && (
                  <button
                    type="button"
                    onClick={() => retry(r)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                  >
                    Retry
                  </button>
                )}
                {canRefund && (
                  <button
                    type="button"
                    onClick={() => setRefunding(r)}
                    className="rounded-full border border-sky-400/40 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:border-sky-400/70"
                  >
                    Refund
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {toast && <p className="mt-3 text-sm font-medium text-emerald-300">{toast}</p>}

      {refunding && (
        <RefundModal
          record={refunding}
          onClose={() => setRefunding(null)}
          onRefunded={(msg) => {
            setRefunding(null);
            flash(msg);
          }}
        />
      )}
      {dialog}
    </div>
  );
}

function RefundModal({
  record,
  onClose,
  onRefunded,
}: {
  record: PaymentRecord;
  onClose: () => void;
  onRefunded: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState(String(record.amount));
  const [note, setNote] = useState("");

  const value = mode === "full" ? record.amount : Number(amount);
  const valid = value > 0 && value <= record.amount && Number.isFinite(value);

  function submit() {
    if (!valid) return;
    refundPayment(record.dogId, record.sessionDate, {
      amount: value,
      full: value === record.amount,
      note: note.trim() || undefined,
    });
    onRefunded(`Refunded ${money(value)} to ${record.ownerName}.`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-paper">Refund payment</p>
            <p className="truncate text-xs text-paper-dim">
              {record.dogName} · {record.ownerName} · {shortDate(record.chargeDate)}
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

        <div className="grid gap-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === "full"
                  ? "border-paper bg-white/10 text-paper"
                  : "border-white/15 text-paper-dim hover:border-white/35"
              }`}
            >
              Full · {money(record.amount)}
            </button>
            <button
              type="button"
              onClick={() => setMode("partial")}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === "partial"
                  ? "border-paper bg-white/10 text-paper"
                  : "border-white/15 text-paper-dim hover:border-white/35"
              }`}
            >
              Partial
            </button>
          </div>

          {mode === "partial" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-paper/90">
                Amount (£)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={record.amount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {!valid && (
                <p className="mt-1 text-xs text-red-400">
                  Enter an amount between £1 and {money(record.amount)}.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-paper/90">
              Reason <span className="text-paper-dim">(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Session cancelled — holiday"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-wide text-accent">Refunding</p>
            <p className="display-heading mt-1 text-2xl text-paper">{money(valid ? value : 0)}</p>
            <p className="mt-1 text-xs text-paper-dim">
              Sent back to {record.ownerName}&apos;s bank account via GoCardless.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <Button radius="xl" onClick={submit} disabled={!valid} className="disabled:opacity-50">
            <CheckIcon width={16} height={16} /> Send refund
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
