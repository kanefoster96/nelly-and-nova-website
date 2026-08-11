/**
 * Onboarding pipeline for new customers (from a meet & greet / contact request).
 * Admin-only. Each entry advances through these stages:
 *
 *   new → booked → payment-sent → payment-done → onboarded
 *
 * (Days / schedule / registers come later.)
 */
export const ONBOARDING_FLOW = [
  { id: "new", label: "New request", action: "Set up meet & greet" },
  { id: "booked", label: "Meet & greet booked", action: "Send payment info" },
  { id: "payment-sent", label: "Payment info sent", action: "Mark payment set up" },
  { id: "payment-done", label: "Payment set up", action: "Confirm onboarding" },
  { id: "onboarded", label: "Onboarded", action: null },
] as const;

export type OnboardingStage = (typeof ONBOARDING_FLOW)[number]["id"];

export type OnboardingEntry = {
  id: string;
  name: string;
  dogName: string;
  service: string;
  email?: string;
  stage: OnboardingStage;
  createdAt: string; // ISO
};

export function stageIndex(stage: OnboardingStage): number {
  return ONBOARDING_FLOW.findIndex((s) => s.id === stage);
}

/** The stage after this one (or null if already onboarded). */
export function nextStage(stage: OnboardingStage): OnboardingStage | null {
  const i = stageIndex(stage);
  const next = ONBOARDING_FLOW[i + 1];
  return next ? next.id : null;
}
