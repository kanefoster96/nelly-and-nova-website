/**
 * Prices for confirmation dialogs, derived from the booking config so the
 * numbers stay in one place.
 */
import { booking } from "@/config/booking";

export function money(n: number): string {
  return `£${n}`;
}

/** Per-session price for an extra booking of a service (single day / session). */
export function extraSessionPrice(serviceLabel: string): number {
  const svc = booking.services.find((s) => s.label === serviceLabel);
  if (!svc) return 0;
  const bt = svc.bookingTypes.find((b) => b.unit === "day" || b.unit === "session") ?? svc.bookingTypes[0];
  return bt.base;
}

/** Recurring price for a membership, e.g. { amount: 60, unit: "week" }. */
export function recurringPrice(serviceLabel = "Walk & Train"): { amount: number; unit: string } {
  const svc = booking.services.find((s) => s.label === serviceLabel);
  const bt = svc?.bookingTypes.find((b) => b.unit === "week") ?? svc?.bookingTypes[0];
  return bt ? { amount: bt.base, unit: bt.unit } : { amount: 0, unit: "week" };
}

export function recurringPriceLabel(serviceLabel = "Walk & Train"): string {
  const p = recurringPrice(serviceLabel);
  return `${money(p.amount)} per ${p.unit}`;
}
