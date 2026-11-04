import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notifyAccount } from "@/lib/notifications/send";
import { sendEmail } from "@/lib/email/resend";
import { reportCardPublished } from "@/lib/email/templates";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nelly-and-nova-website.vercel.app").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dayLabel(iso: string | null): string {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : new Date();
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
}

/**
 * A trainer sends report cards to their owners. Marks each draft published,
 * then tells the owner: an email (lib/email/templates.ts reportCardPublished)
 * and a notification with an app push ("📋 New report card for Nova",
 * opening that report card in the app). Only drafts move, so sending twice never notifies twice.
 *
 * Signed in by cookie (website) or a Bearer token (the app). Trainers only:
 * the trainer's own Supabase client does the update, so Row Level Security
 * (is_admin) applies too.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)) : [];
  if (ids.length === 0 || ids.length > 100) return Response.json({ error: "Invalid request." }, { status: 400 });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabase = bearer
    ? createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createClient();

  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  // Drafts only, so a card that's already gone isn't sent again.
  const { data: published, error } = await supabase
    .from("report_cards")
    .update({ status: "published", published_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "draft")
    .select("id, dog_id, title, summary, session_date");
  if (error) {
    console.error("reports/publish: update failed", error.message);
    return Response.json({ error: "Couldn't send the report cards. Please try again." }, { status: 500 });
  }

  let notified = 0;
  for (const card of published ?? []) {
    const { data: dog } = await supabase.from("dogs").select("name, account_id").eq("id", card.dog_id).maybeSingle();
    if (!dog?.account_id) continue;
    const { data: owner } = await supabase.from("profiles").select("email, owner_name").eq("id", dog.account_id).maybeSingle();
    const dogName = (dog.name as string) || "your dog";
    const title = (card.title as string | null)?.trim() || "Training session";
    const { count } = await supabase
      .from("report_card_items")
      .select("id", { count: "exact", head: true })
      .eq("report_card_id", card.id);
    const items = count ?? 0;

    const [{ pushed, saved }, emailed] = await Promise.all([
      notifyAccount(supabase, dog.account_id as string, {
        title: `📋 New report card for ${dogName}`,
        body: items > 0 ? `${title}. Your homework is ready to practise.` : `${title}. See how ${dogName} got on.`,
        // Opens the report itself in the app: its page (the trainer's notes
        // and the homework), or the Profile tab's latest report card when
        // there's no homework on it.
        path: items > 0 ? `/homework-detail/${card.id}` : "/dog",
      }),
      owner?.email
        ? sendEmail(
            reportCardPublished({
              name: (owner.owner_name as string | null) ?? "",
              email: owner.email as string,
              dogName,
              title,
              summary: ((card.summary as string | null) ?? "").slice(0, 600),
              dateLabel: dayLabel(card.session_date as string | null),
              homeworkCount: items,
              url: `${SITE_URL}/profile/reports`,
            })
          )
        : Promise.resolve(false),
    ]);
    if (pushed || saved || emailed) notified++;
    // And a report card in their chat (kind "report_card", once per card). Best-effort.
    await supabase.rpc("nn_chat_report_card", { p_card_id: card.id });
  }

  return Response.json({ ok: true, published: published?.length ?? 0, notified });
}
