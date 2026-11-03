"use client";

/**
 * Which report cards the owner hasn't opened yet — report_cards.seen_at.
 * Drives the notification dot on the header avatar and the "New" badge on the
 * report-card button. Opening the report cards marks them seen (through the
 * mark_report_cards_seen function, as owners can't edit cards).
 */
import { useReports, markSeen } from "./client";

/** Mark report cards as seen so their badges clear. */
export function markReportsSeen(ids: string[]) {
  void markSeen(ids);
}

/** Number of unseen report cards — for one dog if `dogId` is given, else across the account. */
export function useUnseenReportCount(dogId?: string): number {
  const { cards } = useReports();
  return cards.filter((c) => c.isNew && (!dogId || c.dogId === dogId)).length;
}
