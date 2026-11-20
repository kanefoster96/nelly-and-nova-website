import { sessionPrices } from "@/config/site";

export type SessionKind = "full_day" | "one_to_one";

/**
 * The default price of a session, in pence (config/site.ts sessionPrices).
 * `hasMembership` is the answer for this kind: nn_has_membership(account,
 * kind) — a Full Day membership for a Full Day (£60, else £85), any
 * membership (Full Day, 1-1 or Online) for a 1-1 (£90, else £120). The
 * trainer can always change the amount before charging. The app has the
 * same in mobile/src/data/sessions.ts.
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
