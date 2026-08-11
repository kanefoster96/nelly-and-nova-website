"use client";

import { useState } from "react";
import { ONBOARDING_FLOW, stageIndex, nextStage } from "@/lib/inbox/onboarding";
import type { OnboardingEntry, OnboardingStage } from "@/lib/inbox/onboarding";
import { formatTime } from "@/lib/inbox/format";

/**
 * Admin-only onboarding pipeline. Each new customer (from a meet & greet /
 * contact request) advances through the stages in ONBOARDING_FLOW. The
 * "Send payment info" step will become a GoCardless mandate link that only
 * staff can send — the customer sets up the Direct Debit themselves and
 * contacts us, then we confirm the onboarding and the day they're on.
 */
export function OnboardingList({ initial }: { initial: OnboardingEntry[] }) {
  const [items, setItems] = useState(initial);

  function advance(id: string, from: OnboardingStage) {
    const next = nextStage(from);
    if (!next) return;
    // TODO(backend): advanceOnboarding(id, from) — persist the stage change.
    // The payment step will trigger a GoCardless mandate we send; the customer
    // completes it and contacts us before we confirm onboarding + their day.
    setItems((list) =>
      list.map((e) => (e.id === id ? { ...e, stage: next } : e))
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-paper-dim">No one in onboarding yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((entry) => {
        const idx = stageIndex(entry.stage);
        const step = ONBOARDING_FLOW[idx];
        const done = step.action === null;
        return (
          <li
            key={entry.id}
            className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-paper">
                  {entry.name}
                  <span className="text-paper-dim"> · {entry.dogName}</span>
                </p>
                <p className="mt-0.5 truncate text-sm text-paper/70">
                  {entry.service}
                </p>
              </div>
              <span className="shrink-0 text-xs text-paper-dim">
                {formatTime(entry.createdAt)}
              </span>
            </div>

            {/* Stage tracker */}
            <ol className="mt-4 flex items-center gap-1.5">
              {ONBOARDING_FLOW.map((s, i) => (
                <li key={s.id} className="flex flex-1 flex-col gap-1.5">
                  <span
                    className={`h-1.5 rounded-full ${
                      i <= idx ? "bg-accent" : "bg-white/15"
                    }`}
                  />
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-paper/70">
              {step.label}
            </p>

            {/* Payment step note */}
            {entry.stage === "booked" && (
              <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-paper-dim">
                We send a GoCardless Direct Debit link — only staff can send it.
                The customer sets up payment and contacts us.
              </p>
            )}
            {entry.stage === "payment-sent" && (
              <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-paper-dim">
                Waiting on the customer to set up their Direct Debit and get in
                touch. Mark it set up once confirmed.
              </p>
            )}

            {/* Advance action */}
            <div className="mt-4">
              {done ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
                  Onboarded
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => advance(entry.id, entry.stage)}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {step.action}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
