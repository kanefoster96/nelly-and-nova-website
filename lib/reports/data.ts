/**
 * Data-access seam for the dog profile + report cards.
 * ----------------------------------------------------
 * The ONE place to swap the scaffold's sample data for a real backend.
 * Intended backend (Supabase):
 *   - getDogProfile()        → select from `dogs` where owner = auth.uid()
 *   - getReportCards(dogId)  → select from `report_cards` order by date desc
 *   - setHomeworkDone(...)   → update `homework` set done = $bool
 *   - addReportComment(...)  → insert into `report_comments` (RLS: owner or staff)
 *   - markReportSeen(id)     → update `report_cards` set seen_at = now()
 *
 * Report comments are visible only to the owner and staff (RLS). A new report
 * card notifies the owner; an owner comment notifies staff.
 */
import type { DogProfile, ReportCard, ReportComment } from "./types";
import { sampleDog, sampleReportCards } from "./sample";

export async function getDogProfile(): Promise<DogProfile> {
  // TODO(backend): select * from dogs where owner_id = auth.uid() limit 1
  return sampleDog;
}

export async function getReportCards(): Promise<ReportCard[]> {
  // TODO(backend): select * from report_cards where dog_id = $1 order by date desc
  return sampleReportCards;
}

export async function setHomeworkDone(
  reportId: string,
  homeworkId: string,
  done: boolean
): Promise<void> {
  // TODO(backend): update homework set done = $3 where id = $2 and report_id = $1
  console.log(`[reports] homework ${homeworkId} on ${reportId} → ${done} (scaffold)`);
}

/** Log a day's homework completion for a report card (one per day per card). */
export async function logHomeworkDay(reportId: string, date: string): Promise<void> {
  // TODO(backend): insert into homework_completions (report_id, date) with a
  // UNIQUE(report_id, date) constraint so the one-per-day rule holds server-side.
  console.log(`[reports] homework day logged for ${reportId} on ${date} (scaffold)`);
}

/** Save an edited set of homework categories/drills for a report card. */
export async function saveHomework(
  reportId: string,
  categories: import("./types").HomeworkCategory[]
): Promise<void> {
  // TODO(backend): upsert homework_categories + drills for this report card,
  // preserving each drill's done state where its id is unchanged.
  const drills = categories.reduce((n, c) => n + c.drills.length, 0);
  console.log(`[reports] homework saved for ${reportId} — ${categories.length} categories, ${drills} drills (scaffold)`);
}

export async function addReportComment(
  reportId: string,
  comment: ReportComment
): Promise<void> {
  // TODO(backend): insert into report_comments (...); if comment.author = 'owner',
  // create a staff notification linking back to this report card.
  console.log(`[reports] comment on ${reportId} by ${comment.author} (scaffold)`);
}

export async function markReportSeen(reportId: string): Promise<void> {
  // TODO(backend): update report_cards set seen_at = now() where id = $1
  console.log(`[reports] report ${reportId} marked seen (scaffold)`);
}

/**
 * Send the day's report cards to owners (trainer dashboard → "Send all").
 * TODO(backend): insert each ReportCard into `report_cards` and create a
 * "new report card" notification per owner (delivered live over Realtime).
 * In the scaffold the dashboard also writes them to the client-side outbox
 * (lib/reports/outbox.ts) so the owner sees them straight away.
 */
export async function sendReportCards(cards: ReportCard[]): Promise<void> {
  console.log(`[reports] sending ${cards.length} report card(s) to owners (scaffold)`);
}
