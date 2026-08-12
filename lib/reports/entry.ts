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
import type { HomeworkCategory, ReportCard } from "./types";

export type ReportEntryStatus = "todo" | "draft" | "ready" | "sent";

/** A drill as the coach types it — blank name means it saves as "Drill N". */
export type EntryDrill = { name: string };
/** A homework category the coach adds, e.g. "Recall", with its drills. */
export type EntryCategory = { name: string; drills: EntryDrill[] };

export type ReportEntry = {
  dogId: string;
  coach: string;
  date: string; // ISO — the session date (today)
  summary: string;
  wins: string[]; // three things they did well
  homework: EntryCategory[]; // categories (the card is titled from these)
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
    homework: [{ name: "", drills: [{ name: "" }] }],
    status: "todo",
  };
}

/** The card's title — the names of its homework categories. */
export function entryTitle(entry: ReportEntry): string {
  const names = entry.homework.map((c) => c.name.trim()).filter(Boolean);
  return names.join(" · ");
}

/** Enough to send? A summary, a win, and at least one named category. */
export function isComplete(entry: ReportEntry): boolean {
  return (
    entry.summary.trim().length > 0 &&
    entry.wins.some((w) => w.trim().length > 0) &&
    entry.homework.some((c) => c.name.trim().length > 0)
  );
}

/**
 * Turn a completed coach entry into the owner-facing report card — the exact
 * shape the owner reads (lib/reports/types.ts). This is the transform the send
 * pipeline runs for each ready dog; the backend will do the same insert.
 */
export function entryToReportCard(entry: ReportEntry): ReportCard {
  const id = `sent-${entry.dogId}-${entry.date.slice(0, 10)}`;
  const wins = entry.wins.map((w) => w.trim()).filter(Boolean);
  // Keep only named categories; within each, every drill is kept — an unnamed
  // one saves as "Drill 1", "Drill 2"… in order.
  const homework: HomeworkCategory[] = entry.homework
    .filter((c) => c.name.trim())
    .map((c, ci) => ({
      id: `${id}-cat${ci}`,
      name: c.name.trim(),
      drills: c.drills.map((d, di) => ({
        id: `${id}-cat${ci}-d${di}`,
        name: d.name.trim() || `Drill ${di + 1}`,
        done: false,
      })),
    }));

  return {
    id,
    dogId: entry.dogId,
    date: entry.date,
    // Titled from the categories; fall back to the first win, then a default.
    focus: entryTitle(entry) || wins[0] || "Training session",
    summary: entry.summary.trim(),
    wins,
    homework,
    comments: [],
    isNew: true, // unseen by the owner → notifies them
  };
}

/**
 * Save a coach's entry (draft or ready).
 * TODO(backend): upsert into report_entries; when status flips to 'sent',
 * create the owner-facing report_cards row + a "new report card" notification.
 */
export async function saveReportEntry(entry: ReportEntry): Promise<void> {
  console.log(`[reports] entry for ${entry.dogId} → ${entry.status} (scaffold)`);
}
