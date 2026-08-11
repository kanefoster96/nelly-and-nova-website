/**
 * Dog profile + report cards (training progress).
 * ------------------------------------------------
 * The account is centred on the dog. After each Walk & Train session the dog
 * gets a report card with homework the owner marks complete; owners can ask
 * questions about homework in a thread only they and staff can see.
 */

export type Homework = {
  id: string;
  title: string;
  detail?: string;
  done: boolean;
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
  date: string; // ISO — the session date
  focus: string; // headline, e.g. "Loose lead & recall"
  summary: string; // what they worked on
  wins: string[]; // what went well
  homework: Homework[];
  comments: ReportComment[];
  /** Unseen by the owner → shows as a notification with a badge. */
  isNew: boolean;
};

/** A single tracked skill (placeholder stats for now). */
export type Skill = { label: string; level: number; of: number };

export type TrainingPlan = {
  service: string; // "Walk & Train"
  day: string; // the day they train, e.g. "Thursdays"
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
