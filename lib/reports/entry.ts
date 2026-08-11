/**
 * Coach-authored report card entry (admin side).
 * -----------------------------------------------
 * A coach fills one of these in for each dog on today's schedule. It has three
 * parts — summary of the day, three things they did well, homework for the week
 * — plus the coach's name and the date (applied automatically). It can be saved
 * as a draft and edited through the day; once complete it's marked "ready", and
 * when every dog's entry is ready they're sent to the owners as the report cards
 * they read, comment on and mark homework complete (lib/reports/types.ts).
 */
export type ReportEntryStatus = "todo" | "draft" | "ready" | "sent";

export type ReportEntry = {
  dogId: string;
  coach: string;
  date: string; // ISO — the session date (today)
  summary: string;
  wins: string[]; // three things they did well
  homework: string[]; // homework for the week
  status: ReportEntryStatus;
};

/** An empty entry stamped with the coach + date, ready to fill in. */
export function blankEntry(dogId: string, coach: string, date: string): ReportEntry {
  return {
    dogId,
    coach,
    date,
    summary: "",
    wins: ["", "", ""],
    homework: [""],
    status: "todo",
  };
}

/** Has the coach filled in enough to send? (summary + at least one win.) */
export function isComplete(entry: ReportEntry): boolean {
  return (
    entry.summary.trim().length > 0 &&
    entry.wins.some((w) => w.trim().length > 0)
  );
}

/**
 * Save a coach's entry (draft or ready).
 * TODO(backend): upsert into report_entries; when status flips to 'sent',
 * create the owner-facing report_cards row + a "new report card" notification.
 */
export async function saveReportEntry(entry: ReportEntry): Promise<void> {
  console.log(`[reports] entry for ${entry.dogId} → ${entry.status} (scaffold)`);
}
