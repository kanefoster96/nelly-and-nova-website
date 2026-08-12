/**
 * Dog profile + report cards (training progress).
 * ------------------------------------------------
 * The account is centred on the dog. After each Walk & Train session the dog
 * gets a report card with homework the owner marks complete; owners can ask
 * questions about homework in a thread only they and staff can see.
 */

/** One drill the owner ticks off. Unnamed drills save as "Drill 1", "Drill 2"… */
export type HomeworkDrill = {
  id: string;
  name: string;
  done: boolean;
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
  service: string; // "Walk & Train"
  day: string; // the day they train, e.g. "Thursdays"
  /** Structured recurring pattern — drives the upcoming-sessions list. */
  dayId: import("@/lib/schedule/types").DayId;
  cadence: import("@/lib/schedule/types").Cadence;
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
