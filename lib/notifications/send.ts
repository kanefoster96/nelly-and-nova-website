import type { SupabaseClient } from "@supabase/supabase-js";
import { pushToAccount } from "@/lib/push/send";

/**
 * One notification for one person: a row in `notifications` (their bell in
 * the app and Notifications on the website) and an app push to their phone,
 * like Kanvas's automated notices. See
 * supabase/migrations/20261104030000_notifications.sql.
 *
 * Call it with a trainer's Supabase client (Row Level Security lets trainers
 * insert) or the service-role client (the daily cron). Best-effort: never
 * throws.
 *
 * `path` is an app path ("/chat", "/schedule"); the website maps it to its
 * own page (lib/notifications/links.ts). Titles start with one emoji
 * ("📅 Your meet & greet is booked"); the message itself has none.
 */
export type NotificationKind =
  | "info"
  | "chat_message"
  | "announcement"
  | "onboarding"
  | "meet_greet"
  | "register_reminder";

export type NotificationMessage = {
  title: string;
  body: string;
  path?: string;
  kind?: NotificationKind;
  /** Who it's from, shown on the row. Defaults to the business. */
  sentByName?: string;
};

export const BUSINESS_SENDER = "Nelly & Nova";
export { checkNotification } from "./links";

function row(accountId: string, m: NotificationMessage) {
  return {
    recipient_id: accountId,
    kind: m.kind ?? "info",
    title: m.title.slice(0, 120),
    body: m.body.slice(0, 2000),
    action_href: m.path && m.path.startsWith("/") && !m.path.startsWith("//") ? m.path : null,
    sent_by_name: m.sentByName ?? BUSINESS_SENDER,
  };
}

export async function notifyAccount(
  supabase: SupabaseClient,
  accountId: string,
  message: NotificationMessage
): Promise<{ saved: boolean; pushed: boolean }> {
  let saved = false;
  try {
    const { error } = await supabase.from("notifications").insert(row(accountId, message));
    if (error) console.error("notifyAccount: insert failed", error.message);
    saved = !error;
  } catch (err) {
    console.error("notifyAccount: insert failed", err);
  }
  const pushed = await pushToAccount(supabase, accountId, { title: message.title, body: message.body, path: message.path });
  return { saved, pushed };
}

/** The same notification for several people: one insert, then a push each. */
export async function notifyAccounts(
  supabase: SupabaseClient,
  accountIds: string[],
  message: NotificationMessage
): Promise<{ saved: number; pushed: number; error?: string }> {
  const ids = [...new Set(accountIds)];
  if (ids.length === 0) return { saved: 0, pushed: 0 };
  const { error } = await supabase.from("notifications").insert(ids.map((id) => row(id, message)));
  if (error) {
    console.error("notifyAccounts: insert failed", error.message);
    return { saved: 0, pushed: 0, error: error.message };
  }
  const results = await Promise.allSettled(
    ids.map((id) => pushToAccount(supabase, id, { title: message.title, body: message.body, path: message.path }))
  );
  const pushed = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return { saved: ids.length, pushed };
}

/**
 * The same notification for every trainer (profiles.role = 'admin'): a row
 * each and a push each. Needs a client that can read every trainer's
 * profile: a trainer's own, or the service-role client.
 */
export async function notifyTrainers(
  supabase: SupabaseClient,
  message: NotificationMessage
): Promise<{ saved: number; pushed: number; error?: string }> {
  const { data, error } = await supabase.from("profiles").select("id").eq("role", "admin");
  if (error) {
    console.error("notifyTrainers: couldn't list trainers", error.message);
    return { saved: 0, pushed: 0, error: error.message };
  }
  return notifyAccounts(
    supabase,
    (data ?? []).map((r) => r.id as string),
    message
  );
}
