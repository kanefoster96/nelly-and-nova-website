"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";
import {
  DAY_CAPACITY,
  chargeSession,
  dayCounts,
  decideRequest,
  hasMembership,
  isRegularKind,
  listRequests,
  listUnpaid,
  moveSession,
  requestDetail,
  requestTitle,
  setPaymentStatus,
  shortDay,
  type SessionRequest,
  type UnpaidSession,
} from "@/lib/sessions/client";
import { defaultSessionPrice, priceHint } from "@/lib/sessions/prices";
import type { DaySchedule } from "@/lib/schedule/types";

const BTN = "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-50";
const PRIMARY = `${BTN} bg-accent text-accent-ink`;
const OUTLINE = `${BTN} border border-white/20 text-paper hover:border-white/40`;
const QUIET = `${BTN} border border-white/10 text-paper/70 hover:text-paper`;
const INPUT =
  "rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-accent/20 text-accent",
  offered: "bg-amber-400/15 text-amber-300",
  confirmed: "bg-emerald-400/15 text-emerald-300",
  declined: "bg-white/10 text-paper-dim",
  withdrawn: "bg-white/10 text-paper-dim",
};

function londonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isWeekday(iso: string): boolean {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
}

/**
 * Trainers: owners' session requests, live from session_requests: a
 * replacement for a cancelled day, an extra Full Day or a 1-1, a new
 * regular day, or a switch. Accept books it; Suggest offers 1–3 other
 * dates for the owner to pick; Decline (with an optional note). A
 * confirmed one-off can be moved afterwards. Under them, sessions still to
 * be paid: Charge by Direct Debit (the amount is editable), Mark paid or
 * Waive. The owner hears about every decision (app push, notification
 * and a line in their chat). Used on /admin/requests and the trainer's
 * Messages. `week` is no longer needed (the day counts come from the
 * database) and is ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RescheduleRequests(_props: { week?: DaySchedule[] } = {}) {
  const [requests, setRequests] = useState<SessionRequest[] | null>(null);
  const [unpaid, setUnpaid] = useState<UnpaidSession[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Bumped after each decision to load again.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    const today = londonToday();
    Promise.all([listRequests(), listUnpaid(), dayCounts(today, addDays(today, 120))])
      .then(([r, u, c]) => {
        if (!live) return;
        setError(null);
        setRequests(r);
        setUnpaid(u);
        setCounts(c);
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : "Couldn't load the requests."));
    return () => {
      live = false;
    };
  }, [version]);

  const open = useMemo(() => (requests ?? []).filter((r) => r.status === "pending" || r.status === "offered"), [requests]);
  const recent = useMemo(() => (requests ?? []).filter((r) => r.status !== "pending" && r.status !== "offered").slice(0, 12), [requests]);

  if (!requests) {
    return <p className="text-sm text-paper-dim">{error ?? "Loading requests…"}</p>;
  }

  const after = (message: string) => {
    setDone(message);
    load();
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {done && <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{done}</p>}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
          Waiting for you {open.length > 0 && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-ink">{open.length}</span>}
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-paper-dim">No requests waiting.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id}>
                <OpenRequest request={r} counts={counts} onDone={after} onError={setError} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">
          Unpaid sessions {unpaid.length > 0 && <span className="ml-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] text-amber-300">{unpaid.length}</span>}
        </h2>
        {unpaid.length === 0 ? (
          <p className="text-sm text-paper-dim">Nothing to collect.</p>
        ) : (
          <ul className="space-y-2">
            {unpaid.map((s) => (
              <li key={s.id}>
                <UnpaidRow session={s} onDone={after} onError={setError} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim">Recent</h2>
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.id}>
                <RecentRequest request={r} onDone={after} onError={setError} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CountBadge({ date, counts }: { date: string | null; counts: Record<string, number> }) {
  if (!date || counts[date] === undefined) return null;
  const n = counts[date];
  const tone = n >= DAY_CAPACITY ? "text-red-300" : n === DAY_CAPACITY - 1 ? "text-amber-300" : "text-emerald-300";
  return (
    <span className={`text-xs font-semibold ${tone}`}>
      {n}/{DAY_CAPACITY}
    </span>
  );
}

function OpenRequest({
  request: r,
  counts,
  onDone,
  onError,
}: {
  request: SessionRequest;
  counts: Record<string, number>;
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "suggest" | "decline">("idle");
  const [dates, setDates] = useState<string[]>(["", "", ""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const min = addDays(londonToday(), 1);

  async function run(decision: "accept" | "suggest" | "decline") {
    const picked = dates.filter(Boolean);
    if (decision === "suggest") {
      if (picked.length === 0) return onError("Pick at least one date to suggest.");
      if (picked.some((d) => !isWeekday(d))) return onError("Suggest weekdays only (Monday to Friday).");
    }
    setBusy(true);
    try {
      await decideRequest(r.id, decision, decision === "suggest" ? picked : [], note.trim());
      onDone(
        decision === "accept"
          ? `Confirmed ${r.dogName}'s ${requestTitle(r).toLowerCase()}. ${r.ownerName ?? "The owner"} has been told.`
          : decision === "suggest"
            ? `Offered ${picked.map(shortDay).join(", ")} to ${r.ownerName ?? "the owner"}.`
            : `Declined. ${r.ownerName ?? "The owner"} has been told.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  const date = r.requestedDate;
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[r.status]}`}>{r.status}</span>
            <span className="text-xs text-paper-dim">{requestTitle(r)}</span>
          </div>
          <p className="mt-2 font-semibold text-paper">
            {r.dogName} · {r.ownerName ?? "Owner"}
          </p>
          <p className="mt-0.5 text-sm text-paper/80">
            {requestDetail(r)} {!isRegularKind(r.kind) && r.service === "full_day" && <CountBadge date={date} counts={counts} />}
          </p>
          {r.note && <p className="mt-1 whitespace-pre-wrap text-sm text-paper-dim">&ldquo;{r.note}&rdquo;</p>}
          {r.status === "offered" && <p className="mt-1 text-xs text-amber-300">Offered {r.offeredDates.map(shortDay).join(", ")} · waiting for the owner</p>}
        </div>
        <span className="shrink-0 text-xs text-paper-dim">{shortDay(r.createdAt)}</span>
      </div>

      {mode === "suggest" && (
        <div className="mt-3 grid gap-2">
          <p className="text-xs text-paper-dim">
            Offer up to three {isRegularKind(r.kind) ? "start dates (their weekday becomes the regular day)" : "dates"}. The owner taps one to book it.
          </p>
          <div className="flex flex-wrap gap-2">
            {dates.map((d, i) => (
              <span key={i} className="flex items-center gap-1">
                <input
                  type="date"
                  min={min}
                  value={d}
                  onChange={(e) => setDates((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  className={INPUT}
                />
                <CountBadge date={d || null} counts={counts} />
              </span>
            ))}
          </div>
        </div>
      )}
      {mode !== "idle" && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === "decline" ? "Reason (optional)" : "Note for the owner (optional)"}
          className={`${INPUT} mt-2 w-full`}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "idle" ? (
          <>
            {r.status === "pending" && (
              <button type="button" disabled={busy} onClick={() => run("accept")} className={PRIMARY}>
                <CheckIcon width={16} height={16} /> Accept
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => setMode("suggest")} className={OUTLINE}>
              Suggest
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("decline")} className={QUIET}>
              Decline
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => run(mode)} className={PRIMARY}>
              {busy ? "Saving…" : mode === "suggest" ? "Send suggestions" : "Decline request"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className={QUIET}>
              <CloseIcon width={14} height={14} /> Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RecentRequest({ request: r, onDone, onError }: { request: SessionRequest; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const canMove = r.status === "confirmed" && !!r.resultBookingId && !!r.confirmedDate && r.confirmedDate >= londonToday();

  async function move() {
    if (!to || !isWeekday(to)) return onError("Pick a weekday to move it to.");
    setBusy(true);
    try {
      await moveSession({ dogId: r.dogId, from: r.confirmedDate!, to, bookingId: r.resultBookingId });
      setMoving(false);
      onDone(`Moved ${r.dogName}'s session to ${shortDay(to)}. ${r.ownerName ?? "The owner"} has been told.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't move it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.02] px-4 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-paper/80">
          {r.dogName} · {requestTitle(r)} · {r.confirmedDate ? shortDay(r.confirmedDate) : requestDetail(r)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {canMove && !moving && (
            <button type="button" onClick={() => setMoving(true)} className="text-xs font-medium text-accent">
              Edit date
            </button>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
        </span>
      </div>
      {moving && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="date" min={londonToday()} value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
          <button type="button" disabled={busy} onClick={move} className={PRIMARY}>
            {busy ? "Moving…" : "Move"}
          </button>
          <button type="button" onClick={() => setMoving(false)} className={QUIET}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function UnpaidRow({ session: s, onDone, onError }: { session: UnpaidSession; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [member, setMember] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!s.accountId) return;
    let live = true;
    hasMembership(s.accountId).then((m) => {
      if (!live) return;
      setMember(m);
      setAmount((prev) => prev || ((s.amountPence ?? defaultSessionPrice(s.kind, m)) / 100).toFixed(2).replace(/\.00$/, ""));
    });
    return () => {
      live = false;
    };
  }, [s.accountId, s.amountPence, s.kind]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    try {
      onDone(await action());
    } catch (err) {
      onError(err instanceof Error ? err.message : "That didn't go through.");
    } finally {
      setBusy(null);
    }
  }

  const pence = Math.round(Number(amount) * 100);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-paper">
          {s.dogName ?? "Dog"} · {s.kind === "one_to_one" ? "1-1" : "Full Day"} · {shortDay(s.date)}
        </p>
        <p className="text-xs text-paper-dim">
          {s.ownerName ?? "Owner"}
          {s.notes ? ` · ${s.notes}` : ""} · {s.paymentStatus === "failed" ? <span className="text-red-300">Payment failed</span> : "Unpaid"}
          {member !== null && ` · ${priceHint(s.kind, member)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center rounded-xl border border-white/15 bg-white/[0.04] pl-3 text-sm text-paper">
          £
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-label="Amount in pounds"
            className="w-16 bg-transparent px-1 py-2 focus:outline-none"
          />
        </span>
        <button
          type="button"
          disabled={!!busy || !(pence >= 100)}
          onClick={() => run("charge", () => chargeSession(s.id, pence))}
          className={PRIMARY}
        >
          {busy === "charge" ? "Charging…" : `Charge £${amount || "?"}`}
        </button>
        <button type="button" disabled={!!busy} onClick={() => run("paid", async () => {
            await setPaymentStatus(s.id, "paid");
            return "Marked paid.";
          })} className={OUTLINE}>
          Mark paid
        </button>
        <button type="button" disabled={!!busy} onClick={() => run("waive", async () => {
            await setPaymentStatus(s.id, "waived");
            return "Waived.";
          })} className={QUIET}>
          Waive
        </button>
      </div>
    </div>
  );
}
