import type { SupabaseClient } from "@supabase/supabase-js";

import { fullDayTimes } from "@/config/site";
import { notifyAccount, type NotificationMessage } from "@/lib/notifications/send";

/**
 * The evening-before reminders (app/api/cron/evening): every owner with
 * something on tomorrow gets a notification and a push. Full Day Training
 * (regular places minus skips, and one-off days) says when we collect, 1-1s
 * and meet & greets say their time. Each session is claimed once by
 * nn_owner_reminders_claim (supabase/migrations/20261104110000_owner_flow.sql),
 * so a second run the same day sends nothing. The wording lives here.
 */
export type ReminderRow = {
  kind: "full_day" | "one_to_one" | "meet_greet";
  ref_id: string;
  account_id: string;
  dog_id: string | null;
  dog_name: string | null;
  start_time: string | null; // "10:30:00"
  owner_name: string | null;
};

const CANCEL_LINE = "Need to cancel? You can do it in the app up to today.";

/** "Bella", "Bella & Rex", "Bella, Rex & Nova". */
export function joinNames(names: string[]): string {
  const n = [...new Set(names.map((x) => x.trim()).filter(Boolean))];
  if (n.length <= 1) return n[0] ?? "your dog";
  return `${n.slice(0, -1).join(", ")} & ${n[n.length - 1]}`;
}

/** "10:30:00" → "10:30am", "15:00" → "3:00pm". */
export function clockTime(t: string | null): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]}${h < 12 ? "am" : "pm"}`;
}

export function fullDayReminder(dogs: string[]): NotificationMessage {
  const who = joinNames(dogs);
  return {
    title: `🐾 ${who}'s training tomorrow`,
    body: `We'll collect ${who} ${fullDayTimes.collect}. ${CANCEL_LINE}`,
    path: "/schedule",
    kind: "info",
  };
}

export function oneToOneReminder(dog: string, time: string | null): NotificationMessage {
  const at = clockTime(time);
  return {
    title: `🐾 ${dog}'s 1-1 tomorrow`,
    body: `${at ? `See you at ${at} for ${dog}'s 1-1.` : `See you tomorrow for ${dog}'s 1-1.`} ${CANCEL_LINE}`,
    path: "/schedule",
    kind: "info",
  };
}

export function meetGreetReminder(dogNames: string | null, time: string | null): NotificationMessage {
  const who = joinNames((dogNames ?? "").split(","));
  const at = clockTime(time);
  return {
    title: "🤝 Your meet & greet is tomorrow",
    body: `We're looking forward to meeting ${who}${at ? ` at ${at}` : ""}. Need to change the time? Just message us in the app.`,
    path: "/dog",
    kind: "meet_greet",
  };
}

/** What goes to each owner: one Full Day message for all their dogs, one per 1-1 and meet & greet. */
export function remindersFor(rows: ReminderRow[]): { accountId: string; message: NotificationMessage }[] {
  const out: { accountId: string; message: NotificationMessage }[] = [];
  const fullDay = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.account_id) continue;
    if (r.kind === "full_day") fullDay.set(r.account_id, [...(fullDay.get(r.account_id) ?? []), r.dog_name ?? ""]);
    else if (r.kind === "one_to_one") out.push({ accountId: r.account_id, message: oneToOneReminder(r.dog_name || "your dog", r.start_time) });
    else out.push({ accountId: r.account_id, message: meetGreetReminder(r.dog_name, r.start_time) });
  }
  for (const [accountId, dogs] of fullDay) out.unshift({ accountId, message: fullDayReminder(dogs) });
  return out;
}

/** Tomorrow's date in the UK (YYYY-MM-DD). */
export function londonTomorrow(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Claim tomorrow's sessions and send. `admin` is the service-role client. */
export async function sendEveningReminders(admin: SupabaseClient, onDate = londonTomorrow()): Promise<{ sessions: number; sent: number; error?: string }> {
  const { data, error } = await admin.rpc("nn_owner_reminders_claim", { p_on: onDate });
  if (error) return { sessions: 0, sent: 0, error: error.message };
  const rows = (data ?? []) as ReminderRow[];
  let sent = 0;
  for (const { accountId, message } of remindersFor(rows)) {
    const { saved, pushed } = await notifyAccount(admin, accountId, message);
    if (saved || pushed) sent++;
  }
  return { sessions: rows.length, sent };
}
