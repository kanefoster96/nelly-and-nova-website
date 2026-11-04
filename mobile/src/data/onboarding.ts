import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * The owner's onboarding, live: what the website's /join checklist shows,
 * for the signed-in owner (nn_my_onboarding, supabase/migrations/
 * 20261104080000_owner_onboarding.sql). Asking also ties any open request
 * sent with this account's email to it, so an owner who downloads the app
 * at their meet & greet sees their checklist straight away.
 */

export type OnboardingEnquiry = {
  id: string;
  status: "new" | "meet_greet_booked" | "onboarding";
  service: string | null;
  firstName: string;
  name: string | null;
  email: string | null;
  dogNames: string | null;
  meetGreetAt: string | null;
  meetGreetNotes: string | null;
  onboardingStarted: boolean;
  trainingDay: string | null;
  trainingCadence: "weekly" | "alternating" | null;
  firstSessionOn: string | null;
};

export type OnboardingStatus = {
  enquiry: OnboardingEnquiry | null;
  /** none | link_sent | pending_submission | submitted | active | failed | cancelled | … */
  directDebit: string;
  billingRequestId: string | null;
  dogs: { id: string; name: string; registered: boolean }[];
};

/** Finished on GoCardless's page (the bank confirms it over a few days). */
export const DD_DONE = ["pending_submission", "submitted", "active"];
/** Didn't go through: a trainer sorts out a new one. */
export const DD_BAD = ["failed", "cancelled", "expired", "blocked", "consumed", "suspended_by_payer"];

export async function getMyOnboarding(): Promise<OnboardingStatus | null> {
  const { data, error } = await supabase.rpc("nn_my_onboarding");
  if (error) throw new Error(error.message);
  const s = data as OnboardingStatus | null;
  if (!s) return null;
  return { ...s, dogs: s.dogs ?? [] };
}

/**
 * Is there still something to set up? The Profile tab's checklist
 * (components/onboarding/onboarding-checklist.tsx) shows until the meet &
 * greet has happened, the Direct Debit is done, every dog is registered
 * and the training day is set; a dog still to register counts too. Owners
 * land on Profile after logging in until it's all done (app/index.tsx).
 */
export function setUpUnfinished(s: OnboardingStatus | null): boolean {
  if (!s) return false;
  if (s.dogs.some((d) => !d.registered)) return true;
  const e = s.enquiry;
  if (!e) return false;
  const met = e.status === "onboarding" || e.onboardingStarted;
  const allRegistered = s.dogs.length > 0 && s.dogs.every((d) => d.registered);
  return !(met && DD_DONE.includes(s.directDebit) && allRegistered && !!e.trainingDay);
}

/** "Rex, Bella" → "Rex & Bella". */
export function dogList(names: string | null | undefined, fallback = "your dog"): string {
  const n = (names ?? "").trim();
  return n ? n.replace(/, ([^,]*)$/, " & $1") : fallback;
}

/** "thursday" → "Thursdays". */
export function trainingDayLabel(day: string | null, cadence: string | null): string | null {
  if (!day) return null;
  const plural = `${day.charAt(0).toUpperCase()}${day.slice(1)}s`;
  return cadence === "alternating" ? `${plural}, every other week` : plural;
}

async function directDebitCall<T>(action: "open" | "refresh"): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(new URL("/api/onboarding/direct-debit", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch {
    throw new Error("Couldn't reach Nelly & Nova. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

/** GoCardless's secure page for their set-up, or done: true if it's already finished. */
export function openDirectDebit(): Promise<{ url?: string; done?: boolean; directDebit: string }> {
  return directDebitCall("open");
}

/** Ask GoCardless where it's got to (back from their page, or back in the app). */
export async function refreshDirectDebit(): Promise<string | null> {
  try {
    const r = await directDebitCall<{ directDebit: string }>("refresh");
    return r.directDebit;
  } catch {
    return null;
  }
}

/** Where GoCardless's page hands back to (app/direct-debit/done on the website). */
export const DIRECT_DEBIT_RETURN = "nellyandnova://dog";
