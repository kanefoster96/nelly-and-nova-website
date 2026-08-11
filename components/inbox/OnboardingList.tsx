"use client";

import { useState } from "react";
import Link from "next/link";
import { ONBOARDING_FLOW, stageIndex, nextStage } from "@/lib/inbox/onboarding";
import type { OnboardingEntry, OnboardingStage } from "@/lib/inbox/onboarding";
import { formatTime } from "@/lib/inbox/format";
import { MessageIcon, MailIcon, WhatsAppIcon, UserIcon } from "@/components/ui/Icons";

/**
 * Admin-only onboarding pipeline. Each card is a mini management surface: see
 * the stage, contact the customer (chat / email / WhatsApp / account), and
 * send or manage their GoCardless payment link — all without leaving the card.
 *
 * `onOpenChat` lets the parent (ChatCenter) jump to the Live Chat tab.
 * TODO(backend): the payment steps become real GoCardless mandate links that
 * only staff can send; the customer sets up the Direct Debit and contacts us.
 */
export function OnboardingList({
  initial,
  onOpenChat,
}: {
  initial: OnboardingEntry[];
  onOpenChat?: (entry: OnboardingEntry) => void;
}) {
  const [items, setItems] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initial.map((e) => [
        e.id,
        e.paymentLink ?? `https://pay.gocardless.com/setup/${e.id}`,
      ])
    )
  );
  const [flash, setFlash] = useState<Record<string, string>>({});

  function note(id: string, text: string) {
    setFlash((f) => ({ ...f, [id]: text }));
    window.setTimeout(
      () => setFlash((f) => ({ ...f, [id]: "" })),
      2000
    );
  }

  function advance(id: string, from: OnboardingStage) {
    const next = nextStage(from);
    if (!next) return;
    // TODO(backend): advanceOnboarding(id, from) — persist the stage change.
    setItems((list) =>
      list.map((e) => (e.id === id ? { ...e, stage: next } : e))
    );
  }

  function sendPayment(id: string) {
    // TODO(backend): create the GoCardless mandate + send it to the customer.
    setItems((list) =>
      list.map((e) =>
        e.id === id
          ? { ...e, stage: "payment-sent", paymentLink: drafts[id] }
          : e
      )
    );
    note(id, "Payment link sent");
  }

  async function copyLink(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      note(id, "Copied");
    } catch {
      note(id, "Copy failed");
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-paper-dim">No one in onboarding yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((entry) => {
        const idx = stageIndex(entry.stage);
        const step = ONBOARDING_FLOW[idx];
        const link = entry.paymentLink ?? drafts[entry.id];
        const waHref = entry.phone
          ? `https://wa.me/${entry.phone.replace(/\D/g, "").replace(/^0/, "44")}`
          : null;

        return (
          <li
            key={entry.id}
            className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
          >
            {/* Header */}
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

            {/* Contact row */}
            <div className="mt-3 flex flex-wrap gap-2">
              <ContactButton
                onClick={() => onOpenChat?.(entry)}
                icon={<MessageIcon width={15} height={15} />}
                label="Chat"
              />
              {entry.email && (
                <ContactLink
                  href={`mailto:${entry.email}`}
                  icon={<MailIcon width={15} height={15} />}
                  label="Email"
                />
              )}
              {waHref && (
                <ContactLink
                  href={waHref}
                  external
                  icon={<WhatsAppIcon width={15} height={15} />}
                  label="WhatsApp"
                />
              )}
              <ContactLink
                href="/profile"
                icon={<UserIcon width={15} height={15} />}
                label="Account"
              />
            </div>

            {/* Payment management — shown from the "send payment" step onwards */}
            {(entry.stage === "booked" ||
              entry.stage === "payment-sent") && (
              <div className="mt-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  {entry.stage === "booked"
                    ? "Send payment link"
                    : "Payment link sent"}
                </p>
                <p className="mt-1 text-xs text-paper-dim">
                  GoCardless Direct Debit — only staff can send. The customer
                  sets it up and contacts us.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={entry.stage === "booked" ? drafts[entry.id] : link}
                    readOnly={entry.stage !== "booked"}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [entry.id]: e.target.value }))
                    }
                    aria-label="GoCardless payment link"
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-paper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(entry.id, link)}
                    className="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-paper transition-colors hover:border-white/40"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Stage action + flash */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {step.action === null ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
                  Onboarded
                </span>
              ) : entry.stage === "booked" ? (
                <button
                  type="button"
                  onClick={() => sendPayment(entry.id)}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Send payment link
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => advance(entry.id, entry.stage)}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {step.action}
                </button>
              )}
              {flash[entry.id] && (
                <span className="text-xs font-medium text-accent">
                  {flash[entry.id]}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ContactButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {icon}
      {label}
    </button>
  );
}

function ContactLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {icon}
      {label}
    </Link>
  );
}
