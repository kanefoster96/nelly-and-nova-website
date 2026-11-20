import { sessionPrices } from "@/config/site";

export type SessionKind = "full_day" | "one_to_one";

/**
 * The default price of a one-off session, in pence (config/site.ts
 * sessionPrices): the member price for an account with a Full Day
 * membership, otherwise the standard price, for a Full Day and a 1-1 alike.
 * The trainer can always change the amount before charging.
 */
export function defaultSessionPrice(kind: SessionKind, hasMembership: boolean): number {
  if (kind === "one_to_one") return hasMembership ? sessionPrices.oneToOneMember : sessionPrices.oneToOne;
  return hasMembership ? sessionPrices.fullDayMember : sessionPrices.fullDay;
}

/** "£60 · member price", "£85", "£120", "£90 · member price". */
export function priceHint(kind: SessionKind, hasMembership: boolean): string {
  const pounds = formatPence(defaultSessionPrice(kind, hasMembership));
  return hasMembership ? `${pounds} · member price` : pounds;
}

export function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}
