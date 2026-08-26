/**
 * Server-side helper: notify a member of something real (a new chat message,
 * a reschedule request accepted, a report card published) and, if their app
 * has push registered, buzz their phone too.
 * -----------------------------------------------------------------------
 * Always call this from a Server Action / Route Handler running as the
 * signed-in admin — it uses the request-scoped Supabase client (RLS via
 * cookies), not a service-role key. `notifications: insert admin only` and
 * `profiles: select own or admin` already let an admin insert/read for any
 * account, so no elevated credentials are needed here.
 *
 * Pushing is best-effort: if the account has no `push_token` yet (app never
 * opened / permission not granted), this silently no-ops after the in-app
 * notifications row is written — the bell/Realtime path still works.
 */
import { createClient } from "@/lib/supabase/server";

export type NotifyKind = "chat_message" | "reschedule_accepted" | "report_card_published";

export async function notifyMember(input: {
  accountId: string;
  kind: NotifyKind;
  title: string;
  body: string;
  sessionId?: string;
}): Promise<void> {
  const supabase = await createClient();

  await supabase.from("notifications").insert({
    recipient_id: input.accountId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    session_id: input.sessionId ?? null,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", input.accountId)
    .single();

  const pushToken = profile?.push_token;
  if (!pushToken) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title: input.title,
        body: input.body,
        sound: "default",
        data: { kind: input.kind },
      }),
    });
  } catch {
    // Best-effort — the in-app notification row above already landed.
  }
}
