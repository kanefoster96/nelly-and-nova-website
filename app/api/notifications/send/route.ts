import { requestClient } from "@/lib/supabase/request";
import { BUSINESS_SENDER, checkNotification, notifyAccounts } from "@/lib/notifications/send";
import { NOTIFICATION_LINKS } from "@/lib/notifications/links";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Trainer: Send a notification (website /admin/notifications/new and the
 * app's Menu → Send a notification). To every owner, or the ones chosen:
 * a row each in `notifications` and an app push to each phone.
 *
 * Body: { title, body, audience: "everyone" | "chosen", recipientIds?, path? }
 */
export async function POST(request: Request) {
  const supabase = await requestClient(request);
  const { data: isTrainer } = await supabase.rpc("nn_is_admin");
  if (isTrainer !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  const input = await request.json().catch(() => null);
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  const problem = checkNotification(title, body);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const path = typeof input?.path === "string" ? input.path : "";
  if (!NOTIFICATION_LINKS.some((l) => l.value === path)) return Response.json({ error: "Choose where tapping it goes." }, { status: 400 });

  let recipientIds: string[];
  if (input?.audience === "everyone") {
    const { data, error } = await supabase.from("profiles").select("id").neq("role", "admin");
    if (error) return Response.json({ error: "Couldn't load the owners." }, { status: 500 });
    recipientIds = (data ?? []).map((p) => p.id as string);
  } else if (input?.audience === "chosen" && Array.isArray(input.recipientIds)) {
    recipientIds = (input.recipientIds as unknown[]).filter((id): id is string => typeof id === "string" && UUID_RE.test(id));
    if (recipientIds.length > 0) {
      // Only real owners' accounts.
      const { data } = await supabase.from("profiles").select("id").in("id", recipientIds).neq("role", "admin");
      recipientIds = (data ?? []).map((p) => p.id as string);
    }
  } else {
    return Response.json({ error: "Choose who gets it." }, { status: 400 });
  }
  if (recipientIds.length === 0) return Response.json({ error: "Nobody to send it to yet." }, { status: 400 });
  if (recipientIds.length > 2000) return Response.json({ error: "That's too many at once." }, { status: 400 });

  const result = await notifyAccounts(supabase, recipientIds, {
    title,
    body,
    path: path || undefined,
    kind: "announcement",
    sentByName: BUSINESS_SENDER,
  });
  if (result.error) return Response.json({ error: "Couldn't send that — please try again." }, { status: 500 });
  return Response.json({ ok: true, sent: result.saved, pushed: result.pushed });
}
