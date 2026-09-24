import type { DogProfile, ReportCard } from "./types";
import { sampleDog, sampleReportCards } from "./sample";

export type { DogProfile, HomeworkCategory, ReportCard } from "./types";

export async function getDogProfile(): Promise<DogProfile> {
  // TODO(backend): select from dogs where account_id = auth.uid().
  return sampleDog;
}

export async function getReportCards(): Promise<ReportCard[]> {
  // TODO(backend): select * from report_cards where dog_id = $1 order by date desc.
  return [...sampleReportCards].sort((a, b) => b.date.localeCompare(a.date));
}

/** Log a day's homework for a report card (one per day per card). */
export async function logHomeworkDay(reportId: string, date: string): Promise<void> {
  // TODO(backend): insert into homework_completions (report_id, date) — UNIQUE(report_id, date).
  void reportId;
  void date;
}
