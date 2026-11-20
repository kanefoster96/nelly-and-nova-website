import { createClient as createSupabase } from "@supabase/supabase-js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Free 1-1 slots: GET /api/one-to-one/slots?from=YYYY-MM-DD&to=YYYY-MM-DD
 * (both optional; the next 6 weeks by default, at most 9). 1-1s run Monday
 * to Thursday, 12:00–13:00 and 13:00–14:00; a slot is taken by a 1-1
 * booking or a 1-1 membership that day. Only dates and times come back,
 * never who has the others (nn_one_to_one_slots, readable by anyone), so a
 * public page or the app can call it without signing in.
 *
 * { slots: [{ date: "2026-11-24", start: "12:00", end: "13:00" }, …] }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !ISO.test(from)) || (to && !ISO.test(to))) return Response.json({ error: "Dates are YYYY-MM-DD." }, { status: 400 });

  const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("nn_one_to_one_slots", { p_from: from || null, p_to: to || null });
  if (error) {
    console.error("one-to-one/slots:", error.message);
    return Response.json({ error: "Couldn't load the 1-1 times. Please try again." }, { status: 500 });
  }
  const slots = ((data ?? []) as { on_date: string; start_time: string }[]).map((r) => {
    const start = String(r.start_time).slice(0, 5);
    const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:${start.slice(3, 5)}`;
    return { date: String(r.on_date).slice(0, 10), start, end };
  });
  return Response.json({ slots }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
