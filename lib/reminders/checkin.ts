import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyAccount, type NotificationMessage } from "@/lib/notifications/send";
import { joinNames } from "@/lib/reminders/evening";

/**
 * The Online Training check-in reminder, on Sunday evenings (from the
 * evening cron, app/api/cron/evening): every online member who hasn't
 * checked in this week gets one push. It's optional, so it says so. Each
 * account is claimed once a week by nn_online_checkin_reminders_claim
 * (supabase/migrations/20261120000000_memberships_online.sql), so a second
 * run sends nothing. The wording lives here.
 */
export function checkinReminder(dogs: string[]): NotificationMessage {
  const who = joinNames(dogs);
  return {
    title: `🐾 How was ${who}'s week?`,
    body: "Tap how each drill went for this week's check-in. It takes under a minute, and it's optional.",
    path: "/checkin",
    kind: "info",
  };
}

/** Sunday in the UK? */
export function isLondonSunday(now = new Date()): boolean {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(now) === "Sun";
}

/** Claim this week's online members and send. `admin` is the service-role client. */
export async function sendCheckinReminders(admin: SupabaseClient): Promise<{ accounts: number; sent: number; error?: string }> {
  const { data, error } = await admin.rpc("nn_online_checkin_reminders_claim", { p_week: null });
  if (error) return { accounts: 0, sent: 0, error: error.message };
  const rows = (data ?? []) as { account_id: string; dog_names: string[] | null }[];
  let sent = 0;
  for (const r of rows) {
    const { saved, pushed } = await notifyAccount(admin, r.account_id, checkinReminder(r.dog_names ?? []));
    if (saved || pushed) sent++;
  }
  return { accounts: rows.length, sent };
}
