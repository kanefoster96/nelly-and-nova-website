"use client";

import { Fragment } from "react";

/**
 * Numbered circles joined by lines that fill in as you advance — the same
 * progress indicator as the Kanvas Academy forms. Circles for steps you've
 * already done can be tapped to jump back to them.
 *
 * `current` is 0-based. Long wizards (7+ steps) get slightly smaller circles
 * so every step still fits across a phone screen.
 */
export function WizardProgress({
  steps,
  current,
  reachable = (i) => i < current,
  onJump,
}: {
  steps: string[];
  current: number;
  /** Whether a step can be jumped to (default: any earlier step). */
  reachable?: (index: number) => boolean;
  onJump?: (index: number) => void;
}) {
  const compact = steps.length > 6;
  const size = compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";

  return (
    <nav aria-label="Form progress">
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const canJump = !!onJump && !active && reachable(i);
          const circle = (
            <span
              className={`flex ${size} shrink-0 items-center justify-center rounded-full border font-medium transition-colors duration-300 ${
                done || active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-white/15 bg-ink text-paper-dim"
              } ${active ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-ink" : ""}`}
            >
              {i + 1}
            </span>
          );
          return (
            <Fragment key={`${label}-${i}`}>
              <li className="flex shrink-0" aria-current={active ? "step" : undefined}>
                {canJump ? (
                  <button
                    type="button"
                    onClick={() => onJump(i)}
                    aria-label={`Go back to step ${i + 1}: ${label}`}
                    className="rounded-full transition-opacity hover:opacity-80"
                  >
                    {circle}
                  </button>
                ) : (
                  <span aria-label={`Step ${i + 1}: ${label}${done ? " (done)" : ""}`}>{circle}</span>
                )}
              </li>
              {i !== steps.length - 1 && (
                <li aria-hidden="true" className={`${compact ? "mx-1" : "mx-1.5"} h-0.5 min-w-1 flex-1 overflow-hidden rounded-full bg-white/15`}>
                  <div className={`h-full bg-accent transition-all duration-500 ease-out ${i < current ? "w-full" : "w-0"}`} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Step 3 of 8" kicker, the step title, and the "Draft saved" note. */
export function WizardHeading({
  kicker,
  title,
  step,
  total,
  saved,
}: {
  kicker?: string;
  title: string;
  step: number;
  total: number;
  saved?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-paper-dim">
          {kicker ? `${kicker} · ` : ""}Step {step + 1} of {total}
        </p>
        <span
          aria-live="polite"
          className={`text-xs font-medium text-emerald-300 transition-opacity duration-300 ${saved ? "opacity-100" : "opacity-0"}`}
        >
          Draft saved ✓
        </span>
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">{title}</h2>
    </div>
  );
}

const primary =
  "rounded-full bg-accent px-8 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 active:opacity-75 disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-paper transition-colors hover:border-white/40 active:bg-white/10 disabled:opacity-40";

/** Back / Next (or the final submit) along the bottom of a step card. */
export function WizardNav({
  onBack,
  onNext,
  nextLabel = "Next",
  busy = false,
  busyLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} disabled={busy} className={secondary}>
          Back
        </button>
      ) : (
        <span />
      )}
      <button type="button" onClick={onNext} disabled={busy} className={primary}>
        {busy ? busyLabel ?? "Sending…" : nextLabel}
      </button>
    </div>
  );
}

/** "We saved your progress" banner with a Start over link. */
export function DraftRestored({ onStartOver }: { onStartOver: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-ink-soft px-4 py-3 text-sm">
      <p className="text-paper/80">We saved your progress — carry on where you left off.</p>
      <button type="button" onClick={onStartOver} className="font-medium text-paper underline underline-offset-2">
        Start over
      </button>
    </div>
  );
}

/** Wraps one step's fields in the Kanvas-style card. Keyed by step so it re-animates. */
export function StepCard({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 rounded-2xl border border-white/10 bg-ink-soft p-5 animate-fade-up sm:p-8">{children}</div>;
}
