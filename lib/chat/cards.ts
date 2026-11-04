/**
 * Cards in chat (supabase/migrations/20261104120000_chat_cards.sql): a line
 * the system writes — a session request, a cancellation, a day of homework,
 * a report card — carries `kind` and `meta`, and the thread shows it as a
 * card with buttons. A message without a kind (or one this version doesn't
 * know) shows its body as before. The app has the same in
 * mobile/src/data/inbox/cards.ts.
 */

export type RequestStatus = "pending" | "offered" | "confirmed" | "declined" | "withdrawn";

export type ChatCard =
  | {
      kind: "request";
      requestId: string;
      type: string;
      /** What just happened: created, accepted, suggested, declined, picked, withdrawn. */
      event: string;
      /** Its status when the line was written (the thread looks up the live one). */
      status: RequestStatus;
      dog: string | null;
      title: string;
      dates: string;
      note: string | null;
    }
  | { kind: "cancellation"; dog: string | null; count: number; when: string; from: string | null; to: string | null; reason: string | null }
  | { kind: "homework_day"; cardId: string; title: string; day: number; of: number; note: string | null; video: boolean; dog: string | null }
  | { kind: "report_card"; cardId: string; dogId: string | null; dog: string | null; date: string | null; title: string; homework: number };

type Meta = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const STATUSES: RequestStatus[] = ["pending", "offered", "confirmed", "declined", "withdrawn"];

export function toCard(kind: unknown, meta: unknown): ChatCard | undefined {
  if (typeof kind !== "string" || !meta || typeof meta !== "object") return undefined;
  const m = meta as Meta;
  if (kind === "request") {
    const requestId = str(m.request_id);
    if (!requestId) return undefined;
    return {
      kind,
      requestId,
      type: str(m.type) ?? "",
      event: str(m.event) ?? "",
      status: STATUSES.includes(m.status as RequestStatus) ? (m.status as RequestStatus) : "pending",
      dog: str(m.dog),
      title: str(m.title) ?? "Session request",
      dates: str(m.dates) ?? "",
      note: str(m.note),
    };
  }
  if (kind === "cancellation") {
    return { kind, dog: str(m.dog), count: num(m.count, 1), when: str(m.when) ?? "", from: str(m.from), to: str(m.to), reason: str(m.reason) };
  }
  if (kind === "homework_day") {
    const cardId = str(m.card_id);
    if (!cardId) return undefined;
    return { kind, cardId, title: str(m.title) ?? "Homework", day: num(m.day, 1), of: num(m.of, 3), note: str(m.note), video: m.video === true, dog: str(m.dog) };
  }
  if (kind === "report_card") {
    const cardId = str(m.card_id);
    if (!cardId) return undefined;
    return { kind, cardId, dogId: str(m.dog_id), dog: str(m.dog), date: str(m.date), title: str(m.title) ?? "Training session", homework: num(m.homework) };
  }
  return undefined;
}

// --- dates -------------------------------------------------------------------

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** "Thu 5 Nov" */
export function shortDay(iso: string | null): string {
  const d = iso ? parseDay(iso) : null;
  return d ? `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` : "";
}

/** "Thursday 5 November" */
export function longDay(iso: string | null): string {
  const d = iso ? parseDay(iso) : null;
  return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : "";
}

// --- quick replies -------------------------------------------------------------

/** "{day}" becomes the day of the owner's next session ("soon" when we don't know it). */
export const DAY_TOKEN = "{day}";

export const DEFAULT_QUICK_REPLIES = [
  "Thanks, see you {day}!",
  "Great work this week!",
  "We're running about 10 minutes late",
  "Can you send a short video?",
  "All sorted 👍",
];

/** "Thursday" this week, "Thursday 19 November" further off, "soon" without one. */
export function nextSessionWords(iso: string | null, now = new Date()): string {
  const d = iso ? parseDay(iso) : null;
  if (!d) return "soon";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 1) return "soon";
  return days <= 6 ? DAYS[d.getDay()] : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fillQuickReply(text: string, nextSession: string | null): string {
  return text.split(DAY_TOKEN).join(nextSessionWords(nextSession));
}
