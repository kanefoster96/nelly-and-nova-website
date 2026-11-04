import { sendEmail } from "@/lib/email/resend";
import { meetGreetBooked } from "@/lib/email/templates";
import { notifyAccount } from "@/lib/notifications/send";
import { firstName } from "@/lib/route/messages";
import { bookedMessage, clockTime, londonParts, longDay, type Booked } from "@/lib/schedule/booked-messages";
import { callerClient } from "@/lib/sessions/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const KINDS = ["one_to_one", "full_day_one_off", "full_day", "meet_greet"] as const;
type Kind = (typeof KINDS)[number];

/**
 * A trainer has booked an owner in from a day in the app (Add new dog, Add
 * a 1-1, Add a meet & greet): tell the owner, with a notification row and
 * a push that opens their Schedule ("📅 Meet & greet booked for Tue 10
 * Nov, 2:00pm"). The wording is in lib/schedule/booked-messages.ts.
 *
 * The app sends what it booked ({ kind, id }: a bookings row for a 1-1 or
 * a one-off, a placements row for a regular day, an enquiry for a meet &
 * greet); the date, time, dog and owner are read here, as the trainer.
 * For a meet & greet `email: true` also emails them the day and time (the
 * same email as the Onboarding page's), which reaches someone without an
 * account too; `notify: false` skips the app notification (just the email).
 *
 * Signed in by cookie (website) or a Bearer token (the app). Trainers only.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const kind = (KINDS as readonly string[]).includes(body?.kind) ? (body.kind as Kind) : null;
  const id = typeof body?.id === "string" ? body.id : "";
  const email = body?.email === true;
  const notify = body?.notify !== false;
  if (!kind || !UUID.test(id)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await callerClient(request);
  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  let accountId: string | null = null;
  let booked: Booked;
  let emailTo: { name: string; email: string; whenLabel: string; notes?: string } | null = null;

  if (kind === "one_to_one" || kind === "full_day_one_off") {
    const { data: b } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
    if (!b || b.cancelled_at) return Response.json({ error: "That booking isn't on the calendar." }, { status: 404 });
    accountId = (b.account_id as string | null) ?? null;
    const dog = await dogName(supabase, b.dog_id as string | null, b.holder_name as string | null);
    booked =
      kind === "one_to_one"
        ? { kind, date: String(b.on_date), time: (b.start_time as string | null) ?? null, minutes: (b.duration_min as number | null) ?? null, dog }
        : { kind, date: String(b.on_date), dog };
  } else if (kind === "full_day") {
    const { data: p } = await supabase.from("placements").select("*").eq("id", id).maybeSingle();
    if (!p) return Response.json({ error: "That place isn't on the calendar." }, { status: 404 });
    accountId = (p.account_id as string | null) ?? null;
    booked = { kind, date: String(p.start_on), cadence: p.cadence === "alternating" ? "alternating" : "weekly", dog: await dogName(supabase, p.dog_id as string | null, null) };
  } else {
    const { data: e } = await supabase.from("enquiries").select("*").eq("id", id).maybeSingle();
    if (!e?.meet_greet_at) return Response.json({ error: "That meet & greet isn't booked." }, { status: 404 });
    const at = londonParts(String(e.meet_greet_at));
    const dog = await dogName(supabase, (e.dog_id as string | null) ?? null, null, (e.dog_names as string | null) ?? null);
    const address = ((e.meet_greet_address as string | null) ?? "").trim() || null;
    booked = { kind, date: at.date, time: at.time, dog, address };
    accountId = (e.account_id as string | null) ?? null;
    const to = String(e.email ?? "").trim();
    if (!accountId && EMAIL_RE.test(to)) {
      const { data: profile } = await supabase.from("profiles").select("id").ilike("email", to).maybeSingle();
      accountId = (profile?.id as string | undefined) ?? null;
    }
    if (email && EMAIL_RE.test(to)) {
      const notes = [address ? `Where: ${address}` : null, ((e.meet_greet_notes as string | null) ?? "").trim() || null].filter(Boolean).join("\n\n");
      emailTo = { name: String(e.name ?? ""), email: to, whenLabel: `${longDay(at.date)} at ${clockTime(at.time)}`, notes: notes || undefined };
    }
  }

  let notified = false;
  if (accountId && notify) {
    const { data: owner } = await supabase.from("profiles").select("owner_name").eq("id", accountId).maybeSingle();
    const message = bookedMessage(booked, firstName(owner?.owner_name as string | null));
    const res = await notifyAccount(supabase, accountId, { ...message, path: "/schedule", kind: kind === "meet_greet" ? "meet_greet" : "info" });
    notified = res.saved || res.pushed;
  }
  const emailed = emailTo ? await sendEmail(meetGreetBooked(emailTo)) : false;
  return Response.json({ ok: true, notified, emailed, hasAccount: !!accountId });
}

/** The dog's name for the message: the dog on file, else the names on the booking or request. */
async function dogName(supabase: Awaited<ReturnType<typeof callerClient>>, dogId: string | null, holder: string | null, names: string | null = null): Promise<string> {
  if (dogId) {
    const { data } = await supabase.from("dogs").select("name").eq("id", dogId).maybeSingle();
    if (data?.name) return String(data.name);
  }
  const list = (names ?? "").trim();
  if (list) return list.replace(/, ([^,]*)$/, " & $1");
  // "Sam Taylor — Biscuit": the dog's after the dash.
  const fromHolder = (holder ?? "").split(/\s+[—-]\s+/)[1]?.trim();
  return fromHolder || "your dog";
}
