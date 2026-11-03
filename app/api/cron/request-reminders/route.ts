import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { pushNotices } from "@/lib/sessions/push";

/**
 * Daily (vercel.json): any session request a trainer hasn't answered in 24
 * hours gets a reminder for every trainer (a notification row and a push),
 * at most once a day each (session_requests.reminded_at, set by
 * nn_request_reminders). Vercel calls it with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!adminConfigured()) return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set" }, { status: 503 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("nn_request_reminders");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const pushed = await pushNotices(admin, data, null);
  return Response.json({ ok: true, reminders: Array.isArray(data) ? data.length : 0, pushed });
}
