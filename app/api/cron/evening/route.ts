import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { sendEveningReminders } from "@/lib/reminders/evening";
import { isLondonSunday, sendCheckinReminders } from "@/lib/reminders/checkin";

/**
 * Daily in the evening (vercel.json, "0 18 * * *"): the evening-before
 * reminders — "🐾 Bella's training tomorrow" with the pick-up window, and
 * 1-1s and meet & greets with their time (lib/reminders/evening.ts). Each
 * session's reminder goes once (owner_reminders_sent).
 *
 * On Sundays it also sends Online Training's weekly check-in reminder
 * ("🐾 How was Bella's week?", lib/reminders/checkin.ts), once per account
 * per week (online_checkin_reminders).
 *
 * Vercel's cron times are UTC. 18:00 UTC is 6pm in the UK in winter (GMT)
 * and 7pm in summer (BST, UTC+1): for 6pm all year, change it to
 * "0 17 * * *" when the clocks go forward and back again in October.
 * Vercel calls it with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!adminConfigured()) return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set" }, { status: 503 });
  const admin = createAdminClient();
  const result = await sendEveningReminders(admin);
  const checkins = isLondonSunday() ? await sendCheckinReminders(admin) : null;
  const error = result.error ?? checkins?.error;
  if (error) return Response.json({ ok: false, error, ...result, checkins }, { status: 500 });
  return Response.json({ ok: true, ...result, checkins });
}
