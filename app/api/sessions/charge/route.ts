import { callerClient } from "@/lib/sessions/auth";
import { createPayment, GoCardlessError, gocardlessConfigured } from "@/lib/gocardless/client";
import { defaultSessionPrice } from "@/lib/sessions/prices";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A trainer charges one session (a one-off Full Day, a replacement, an
 * extra day or a 1-1) to the owner's Direct Debit. Only ever runs from a
 * trainer tapping Charge: nothing calls it automatically.
 *
 * Body: { bookingId, amountPence? } — the amount defaults to the session
 * price (lib/sessions/prices.ts). Uses only a mandate this site saved in
 * payment_mandates for that account. The booking goes to "pending" with
 * the GoCardless payment id; the webhook marks it paid or failed.
 * Signed in by cookie (website) or a Bearer token (the app). Trainers only.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" && UUID.test(body.bookingId) ? body.bookingId : null;
  if (!bookingId) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await callerClient(request);
  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });
  if (!gocardlessConfigured()) return Response.json({ error: "GoCardless isn't connected yet." }, { status: 503 });

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, kind, on_date, account_id, dog_id, cancelled_at, payment_status, gc_payment_id, charged_at, dogs(name)")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) return Response.json({ error: "Session not found." }, { status: 404 });
  if (booking.cancelled_at) return Response.json({ error: "That session was cancelled." }, { status: 409 });
  if (booking.payment_status === "paid" || booking.payment_status === "pending") {
    return Response.json({ error: booking.payment_status === "paid" ? "That session is already paid." : "A payment for that session is already on its way." }, { status: 409 });
  }
  if (!booking.account_id) return Response.json({ error: "That session isn't linked to an owner's account." }, { status: 409 });

  const { data: mandate } = await supabase
    .from("payment_mandates")
    .select("mandate_id, status")
    .eq("account_id", booking.account_id)
    .not("mandate_id", "is", null)
    .in("status", ["pending_submission", "submitted", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mandate?.mandate_id) return Response.json({ error: "No Direct Debit set up for this owner." }, { status: 409 });

  const kind = booking.kind === "one_to_one" ? "one_to_one" : "full_day";
  let amountPence = Number(body?.amountPence);
  if (!Number.isFinite(amountPence) || amountPence <= 0) {
    const { data: member } = await supabase.rpc("nn_has_membership", { p_account_id: booking.account_id });
    amountPence = defaultSessionPrice(kind, member === true);
  }
  amountPence = Math.round(amountPence);
  if (amountPence < 100 || amountPence > 100000) return Response.json({ error: "Enter an amount between £1 and £1,000." }, { status: 400 });

  const dog = (Array.isArray(booking.dogs) ? booking.dogs[0] : booking.dogs) as { name?: string } | null;
  const day = new Date(`${booking.on_date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const description = `${kind === "one_to_one" ? "1-1" : "Full Day"} ${day}${dog?.name ? ` · ${dog.name}` : ""}`;

  try {
    const payment = await createPayment({
      mandateId: mandate.mandate_id as string,
      amountPence,
      description,
      bookingId,
      // A retry after a failed payment needs its own key.
      attempt: booking.payment_status === "failed" && booking.charged_at ? `r${Date.parse(booking.charged_at as string)}` : undefined,
    });
    const { error: saveError } = await supabase
      .from("bookings")
      .update({ payment_status: "pending", gc_payment_id: payment.id, amount_pence: amountPence, charged_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (saveError) console.error("sessions/charge: saved payment but not the booking", payment.id, saveError.message);
    return Response.json({ ok: true, paymentId: payment.id, amountPence, chargeDate: payment.charge_date ?? null });
  } catch (err) {
    const message = err instanceof GoCardlessError ? err.message : "Couldn't reach GoCardless. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
