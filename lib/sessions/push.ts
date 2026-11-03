import type { SupabaseClient } from "@supabase/supabase-js";
import { pushToAccount } from "@/lib/push/send";

/**
 * Session changes (cancellations, requests, decisions, payment failures)
 * write their notification rows in the database, in the same transaction
 * as the change (supabase/migrations/20261104050000_dog_profile.sql), and
 * hand back the new rows' ids. This sends the app push for each, once:
 * notification_pushes remembers which have gone.
 *
 * `admin` is the service-role client (it reads anyone's push token).
 * `sentBy`: only push rows this person sent in the last ten minutes (the
 * caller of app/api/sessions/push); null for the webhook and the cron,
 * whose rows have no sender.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pushNotices(admin: SupabaseClient, ids: unknown, sentBy: string | null): Promise<number> {
  const list = (Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 50);
  if (list.length === 0) return 0;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  let query = admin.from("notifications").select("id, recipient_id, title, body, action_href").in("id", list).gte("created_at", since);
  query = sentBy ? query.eq("sent_by", sentBy) : query.is("sent_by", null);
  const { data, error } = await query;
  if (error) {
    console.error("pushNotices: load failed", error.message);
    return 0;
  }
  let pushed = 0;
  for (const n of data ?? []) {
    // Claim it first, so two calls never push the same row twice.
    const { error: claimError } = await admin.from("notification_pushes").insert({ notification_id: n.id });
    if (claimError) continue;
    const ok = await pushToAccount(admin, n.recipient_id as string, {
      title: n.title as string,
      body: n.body as string,
      path: (n.action_href as string | null) ?? undefined,
    });
    if (ok) pushed++;
  }
  return pushed;
}
