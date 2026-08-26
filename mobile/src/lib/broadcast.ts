/**
 * Community blast — a notification (in-app + push) to every member, with an
 * optional email fan-out. Notifications/push go client-side (same reasoning
 * as lib/adminNotify.ts); email has to go through the broadcast-email Edge
 * Function since sending it needs a Resend secret that can't ship in the app.
 */
import { supabase } from "@/lib/supabase";
import { notifyMember } from "@/lib/adminNotify";

export type BroadcastResult = {
  notifiedCount: number;
  email: { sent: number; failed: number; skipped: boolean } | null;
};

export async function sendBroadcast(input: {
  title: string;
  body: string;
  alsoEmail: boolean;
}): Promise<BroadcastResult> {
  const { data: members } = await supabase.from("profiles").select("id").eq("role", "member");

  await Promise.all(
    (members ?? []).map((m) =>
      notifyMember({ accountId: m.id, kind: "info", title: input.title, body: input.body })
    )
  );

  let email: BroadcastResult["email"] = null;
  if (input.alsoEmail) {
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-email", {
        body: { subject: input.title, body: input.body },
      });
      if (error) throw error;
      email = { sent: data?.sent ?? 0, failed: data?.failed ?? 0, skipped: !!data?.reason };
    } catch {
      email = { sent: 0, failed: 0, skipped: true };
    }
  }

  return { notifiedCount: members?.length ?? 0, email };
}
