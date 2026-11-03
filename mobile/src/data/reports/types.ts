/**
 * Dog profile + report cards (training progress).
 * ------------------------------------------------
 * The account is centred on the dog. After each Full Day Training session the dog
 * gets a report card with homework the owner marks complete; owners can ask
 * questions about homework in a thread only they and staff can see.
 * Live in Supabase (same tables as the website's lib/reports/client.ts).
 */

/**
 * One drill — how to practise a specific skill. Unnamed drills save as
 * "Drill 1", "Drill 2"… Completion is tracked per report card over 3 days
 * (lib/reports/progress.ts), not per drill.
 */
export type HomeworkDrill = {
  id: string; // report_card_items.id
  name: string;
  /** The library drill it was picked from (opens /drill/[id]). */
  ref?: string | null;
  pillar?: string | null;
};

/**
 * Homework is grouped by category (e.g. "Luring", "Marker words", "Recall").
 * The report card is titled from its categories, and each category holds drills.
 */
export type HomeworkCategory = {
  id: string;
  name: string;
  drills: HomeworkDrill[];
};

/** A message on a report card. Visible only to the owner and staff. */
export type ReportComment = {
  id: string;
  author: "owner" | "staff";
  authorName: string;
  body: string;
  createdAt: string; // ISO
};

export type ReportCard = {
  id: string;
  /** Which dog this card belongs to — lets a multi-dog account filter per dog. */
  dogId?: string;
  dogName?: string;
  dogPhoto?: string | null;
  date: string; // ISO — the session date
  focus: string; // title — derived from the homework categories
  summary: string; // what they worked on
  wins: string[]; // what went well
  homework: HomeworkCategory[]; // categories, each with drills
  comments: ReportComment[];
  /** Unseen by the owner → shows as a notification with a badge. */
  isNew: boolean;
};

/** A single tracked skill (placeholder stats for now). */
export type Skill = { label: string; level: number; of: number };

export type TrainingPlan = {
  service: string; // "Full Day Training"
  day: string; // the day they train, e.g. "Thursdays"
  /** Structured recurring pattern — drives the upcoming-sessions list. */
  dayId: import("@/data/schedule/types").DayId;
  cadence: import("@/data/schedule/types").Cadence;
  weekParity?: "A" | "B";
  note?: string;
};

export type DogProfile = {
  name: string;
  photo: string;
  breed?: string;
  age: string;
  /** Number of training sessions completed. */
  sessions: number;
  /** Overall training level (rises as skills progress). */
  level: number;
  plan: TrainingPlan | null;
  skills: Skill[];
};

/** A member's published cards, plus the days each card's homework was practised. */
export type ReportBundle = { cards: ReportCard[]; progress: Record<string, string[]> };

/** One skill pillar with its skills, for a dog's Skills & levels. */
export type SkillItem = { id: string; name: string; level: number };
export type SkillPillar = { id: string; name: string; blurb: string; skills: SkillItem[] };
export type DogProgress = { dogId: string; pillars: SkillPillar[]; learnt: Record<string, string> };
