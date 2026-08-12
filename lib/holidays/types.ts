/**
 * Trainer holidays (business closures).
 * -------------------------------------
 * A holiday is a week (or a few days) the business is closed. When one is added
 * every active member "uses" one of their four annual holidays — even if they
 * train more than once that week or have more than one dog, a single closure
 * only ever counts as one holiday for that customer (the sessions are paid /
 * not refunded, per the terms). We cap the year at four so we can never
 * accidentally take a fifth.
 */
import type { DayId } from "@/lib/schedule/types";

export type Holiday = {
  id: string;
  start: string; // YYYY-MM-DD (inclusive) — first day away
  end: string; // YYYY-MM-DD (inclusive) — last day away
  reason?: string; // optional note, e.g. "Summer break"
  createdAt: string; // ISO
};

/** One member on the "spreadsheet" — deduped so two dogs / two days = one row. */
export type HolidayCustomer = {
  key: string; // email || ownerName — the identity a holiday is counted against
  ownerName: string;
  email?: string;
  dogNames: string[];
  days: DayId[]; // the weekday(s) they train
};

/** Weeks of holiday allowed per calendar year (stated in our terms). */
export const ANNUAL_HOLIDAY_ALLOWANCE = 4;
