/**
 * Notify a member from the coach app — mirrors the website's
 * lib/push/notify.ts, but runs client-side here: RLS already lets an admin
 * insert a notifications row and read any profile's push_token
 * ("… or admin" on both policies), and Expo's push-send endpoint takes no
 * secret, so no edge function/service role is needed for this part (unlike
 * the email blast — see lib/broadcast.ts).
 */
import { supabase } from "@/lib/supabase";
import type { NotificationKind } from "@/lib/notifications";

export async function notifyMember(input: {
  accountId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  sessionId?: string;
}): Promise<void> {
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
