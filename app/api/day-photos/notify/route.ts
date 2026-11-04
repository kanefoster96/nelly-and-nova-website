import { callerClient } from "@/lib/sessions/auth";
import { notifyAccount } from "@/lib/notifications/send";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

/**
 * A trainer has just added photos to a dog's day (the app's "Add photo" on
 * the dog's page, components/day-photos/add-day-photo.tsx): tell the owner,
 * "📸 New photos of Bella", at most once per dog per day. The first batch
 * of the day claims day_photo_notices (dog, date); later batches that day
 * add to the owner's Profile tab without another push. Trainers only.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const dogId = typeof body?.dogId === "string" ? body.dogId : "";
  if (!UUID.test(dogId)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await callerClient(request);
  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  const today = londonToday();
  const { count } = await supabase.from("day_photos").select("id", { count: "exact", head: true }).eq("dog_id", dogId).eq("taken_on", today);
  if (!count) return Response.json({ ok: true, notified: false });

  const { data: dog } = await supabase.from("dogs").select("name, account_id").eq("id", dogId).maybeSingle();
  if (!dog?.account_id) return Response.json({ ok: true, notified: false });

  // Once a day: only the first claim gets a row back.
  const { data: claimed, error } = await supabase
    .from("day_photo_notices")
    .upsert({ dog_id: dogId, on_date: today }, { onConflict: "dog_id,on_date", ignoreDuplicates: true })
    .select("dog_id");
  if (error) return Response.json({ error: "Couldn't send the notification." }, { status: 500 });
  if (!claimed?.length) return Response.json({ ok: true, notified: false, alreadySent: true });

  const name = (dog.name as string) || "your dog";
  const { saved, pushed } = await notifyAccount(supabase, dog.account_id as string, {
    title: `📸 New photos of ${name}`,
    body: `${count === 1 ? "A photo" : `${count} photos`} from ${name}'s day with us. Have a look on your Profile.`,
    path: "/dog",
    kind: "info",
  });
  if (!saved && !pushed) {
    await supabase.from("day_photo_notices").delete().eq("dog_id", dogId).eq("on_date", today);
    return Response.json({ error: "Couldn't notify the owner." }, { status: 502 });
  }
  return Response.json({ ok: true, notified: true, pushed });
}
