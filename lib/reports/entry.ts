/**
 * Coach-authored report card entry (admin side).
 * -----------------------------------------------
 * A coach fills one of these in for each dog on today's schedule. It has three
 * parts — summary of the day, three things they did well, homework for the week
 * — plus the coach's name and the date (applied automatically). It can be saved
 * as a draft and edited through the day; once complete it's marked "ready", and
 * when every dog's entry is ready they're sent to the owners as the report cards
 * they read, comment on and mark homework complete (lib/reports/types.ts).
 * Drafts are report_cards rows with status 'draft'.
 */
import { saveDraftCard } from "./client";

export type ReportEntryStatus = "todo" | "draft" | "ready" | "sent";

/** A drill as the coach types it — blank name means it saves as "Drill N".
 *  `ref`/`pillar` are set when it was picked from the drill library. */
export type EntryDrill = { name: string; ref?: string | null; pillar?: string | null };
/** A homework category the coach adds, e.g. "Recall", with its drills. */
export type EntryCategory = { name: string; drills: EntryDrill[] };

export type ReportEntry = {
  dogId: string;
  coach: string;
  date: string; // ISO — the session date (today)
  summary: string;
  wins: string[]; // three things they did well
  strength?: string; // biggest strength
  toImprove?: string; // biggest area to improve
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
export function isComplete<T extends Pick<ReportEntry, "summary" | "wins" | "homework">>(entry: T): boolean {
  return (
    entry.summary.trim().length > 0 &&
    entry.wins.some((w) => w.trim().length > 0) &&
    entry.homework.some((c) => c.name.trim().length > 0)
  );
}

/**
 * Save a coach's entry as a draft report card (status "draft" — owners can't
 * see it). Sending it to the owner is publishCards() in lib/reports/client.ts,
 * which also emails and notifies them. Returns the card id.
 */
export async function saveReportEntry(entry: ReportEntry, cardId?: string): Promise<string> {
  return saveDraftCard(
    {
      dogId: entry.dogId,
      sessionDate: entry.date.slice(0, 10),
      summary: entry.summary,
      wins: entry.wins,
      strength: entry.strength,
      toImprove: entry.toImprove,
      homework: entry.homework,
    },
    cardId
  );
}
