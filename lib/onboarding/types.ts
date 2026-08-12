/**
 * Onboarding lifecycle — the connective tissue that ties a customer's booking,
 * account, waiver, payment and schedule slot together into one record.
 *
 * Flow: enquiry (booking form) → account created → slot held by a coach →
 * waiver signed by the customer → payment (GoCardless) set up → coach confirms,
 * which sets the training day + first start date and turns the held slot
 * permanent. `waiverSigned` and `paymentSet` are the two gates that must be true
 * before a placement can be confirmed.
 *
 * Keyed by dogId so the customer's dog, their waiver and the coach's schedule
 * slot all reference the same record (backend: the FK is the customer/dog id).
 */
import type { Cadence, DayId } from "@/lib/schedule/types";

export type OnboardingStatus = "in_progress" | "confirmed";

export type OnboardingRecord = {
  dogId: string;
  ownerName: string;
  email: string;
  dogName: string;
  day?: DayId; // assigned training day
  cadence?: Cadence;
  waiverSigned: boolean;
  paymentSet: boolean;
  startDate?: string; // ISO date — first session
  status: OnboardingStatus;
};

export function blankOnboarding(
  dogId: string,
  partial: Partial<OnboardingRecord> = {}
): OnboardingRecord {
  return {
    dogId,
    ownerName: "",
    email: "",
    dogName: "",
    waiverSigned: false,
    paymentSet: false,
    status: "in_progress",
    ...partial,
  };
}

/** Both gates done → a coach can confirm the placement. */
export function isReadyToConfirm(r: OnboardingRecord | undefined): boolean {
  return !!r && r.waiverSigned && r.paymentSet;
}

export function cadenceLabel(c?: Cadence): string {
  return c === "alternating" ? "alternating weeks" : "every week";
}
