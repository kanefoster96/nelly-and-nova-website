import { createClient } from "@/lib/supabase/server";

/**
 * "Download your data": everything we hold against the signed-in account,
 * as one JSON file (UK GDPR right of access). Read with their own session,
 * so Row Level Security means it can only ever contain their own records.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });

  const take = async (table: string, column = "account_id") => {
    const { data, error } = await supabase.from(table).select("*").eq(column, user.id);
    return error ? [] : data;
  };
  const { data: conversation } = await supabase.from("conversations").select("id").eq("account_id", user.id).maybeSingle();
  const { data: messages } = conversation
    ? await supabase.from("messages").select("created_at, sender_is_staff, sender_name, body, attachment_name").eq("conversation_id", conversation.id).order("created_at")
    : { data: [] };
  const { data: meetGreet } = await supabase.rpc("nn_my_meet_greet");

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdAt: user.created_at },
    profile: (await take("profiles", "id"))[0] ?? null,
    dogs: await take("dogs"),
    dogDocuments: await take("dog_documents"),
    waivers: await take("waivers"),
    trainingPlaces: await take("placements"),
    bookings: await take("bookings"),
    directDebits: (await take("payment_mandates")).map((m) => ({ status: m.status, createdAt: m.created_at })),
    meetGreetRequest: meetGreet ?? null,
    chat: messages ?? [],
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nelly-and-nova-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
