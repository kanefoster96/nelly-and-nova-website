import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notifyAccount } from "@/lib/notifications/send";

/**
 * A trainer has just replied in someone's chat: let the owner know in the
 * app (and on their Notifications). Called by the website's and the app's
 * chat after a trainer sends.
 * Signed in by cookie (website) or a Bearer token (the app). Trainers only,
 * and only pushes the owner of that conversation.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  if (!/^[0-9a-f-]{36}$/.test(conversationId)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabase = bearer
    ? createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createClient();

  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  const { data: conv } = await supabase.from("conversations").select("account_id").eq("id", conversationId).maybeSingle();
  if (!conv?.account_id) return Response.json({ ok: true, pushed: false });

  const { data: last } = await supabase
    .from("messages")
    .select("body, sender_name, attachment_type")
    .eq("conversation_id", conversationId)
    .eq("sender_is_staff", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const preview = last?.body || (last?.attachment_type ? "Sent you a file" : "New message");
  // A row on their Notifications too, and the push.
  const { pushed } = await notifyAccount(supabase, conv.account_id as string, {
    title: `💬 ${last?.sender_name || "Nelly & Nova"}`,
    body: preview.length > 140 ? `${preview.slice(0, 137)}…` : preview,
    path: "/chat",
    kind: "chat_message",
    sentByName: last?.sender_name || undefined,
  });
  return Response.json({ ok: true, pushed });
}
