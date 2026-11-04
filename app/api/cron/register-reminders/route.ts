import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { registerReminder } from "@/lib/email/templates";
import { notifyAccount } from "@/lib/notifications/send";
import { sweepCompletedHomeworkVideos } from "@/lib/homework/cleanup";
import { sweepOldDayPhotos } from "@/lib/day-photos/cleanup";

/**
 * Daily (vercel.json): owners in onboarding whose first session is coming up
 * and who haven't registered every dog yet get a reminder 7, 3 and 1 day(s)
 * before — email, plus an app notification if they have the app. Each
 * reminder goes once (enquiries.register_reminders_sent). Vercel calls it
 * with "Authorization: Bearer $CRON_SECRET".
 *
 * Also the daily safety sweep for homework videos: any homework that's
 * complete (3 of 3) but still has videos (the app's own clean-up call
 * didn't happen) has them deleted (lib/homework/cleanup.ts). And photos
 * from a dog's day older than 90 days are deleted (lib/day-photos/cleanup.ts).
 */
const REMIND_AT = [7, 3, 1];

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()); // YYYY-MM-DD
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T12:00:00Z`) - Date.parse(`${fromISO}T12:00:00Z`)) / 86_400_000);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!adminConfigured()) return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set" }, { status: 503 });

  const admin = createAdminClient();
  const videosRemoved = await sweepCompletedHomeworkVideos(admin).catch((err) => {
    console.error("register-reminders: homework video sweep failed", err);
    return 0;
  });
  const photosRemoved = await sweepOldDayPhotos(admin).catch((err) => {
    console.error("register-reminders: day photo sweep failed", err);
    return 0;
  });
  const today = londonToday();
  const { data: rows, error } = await admin
    .from("enquiries")
    .select("id, name, email, dog_names, account_id, onboarding_token, first_session_on, register_reminders_sent")
    .eq("status", "onboarding")
    .not("first_session_on", "is", null)
    .gte("first_session_on", today);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  let sent = 0;
  for (const e of rows ?? []) {
    const daysToGo = daysBetween(today, e.first_session_on as string);
    const due = REMIND_AT.filter((d) => d >= daysToGo);
    const already = (e.register_reminders_sent as number[]) ?? [];
    const step = due.find((d) => !already.includes(d) && d === Math.min(...due));
    if (step === undefined || daysToGo > 7) continue;

    // Everyone registered? Then nothing to remind.
    if (e.account_id) {
      const { data: dogs } = await admin.from("dogs").select("waiver_signed_at").eq("account_id", e.account_id);
      if ((dogs ?? []).length > 0 && (dogs ?? []).every((d) => d.waiver_signed_at)) continue;
    }

    const dogNames = String(e.dog_names ?? "").replace(/, ([^,]*)$/, " & $1");
    const joinUrl = `${origin}/join/${e.onboarding_token}`;
    const firstSessionLabel = new Date(`${e.first_session_on}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
    const emailed = await sendEmail(registerReminder({ name: e.name, email: e.email, dogNames, firstSessionLabel, daysToGo, joinUrl }));
    if (e.account_id) {
      await notifyAccount(admin, e.account_id as string, {
        kind: "register_reminder",
        title: `📝 Register ${dogNames || "your dog"}`,
        body: daysToGo <= 1 ? "Their first session is tomorrow — register them so we can collect them." : `Their first session is ${firstSessionLabel}. It only takes a few minutes.`,
        path: "/register",
      });
    }
    if (emailed) {
      sent++;
      await admin.from("enquiries").update({ register_reminders_sent: [...already, ...due] }).eq("id", e.id);
    }
  }
  return Response.json({ ok: true, checked: rows?.length ?? 0, sent, videosRemoved, photosRemoved });
}
