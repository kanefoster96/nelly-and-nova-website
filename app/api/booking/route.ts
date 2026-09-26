import { site } from "@/config/site";
import { findService, findBookingType, priceFor } from "@/config/booking";
import { saveEnquiry } from "@/lib/records/server";
import { sendEmail, ownerAddress } from "@/lib/email/resend";
import { bookingConfirmation, bookingOwnerNotification } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let d: Record<string, string> & { extraDogs?: unknown };
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot
  if (String(d.company ?? "").trim()) return Response.json({ ok: true });

  const firstName = String(d.firstName ?? "").trim();
  const lastName = String(d.lastName ?? "").trim();
  const email = String(d.email ?? "").trim();

  if (!firstName || !lastName || !email || !String(d.dogName ?? "").trim() || !d.service) {
    return Response.json({ error: "Some required details are missing." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const svc = findService(d.service);
  const bt = findBookingType(d.service, d.bookingType);
  const dogs = parseInt(d.dogs, 10) || 1;
  const price = priceFor(d.service, d.bookingType, dogs);

  const line = (k: string, v?: string) => `${k}: ${v && v.trim() ? v.trim() : "—"}`;

  // Additional dogs (each captured on its own step of the booking form).
  const extraDogs = Array.isArray(d.extraDogs)
    ? (d.extraDogs as Record<string, string>[])
    : [];
  const extraDogsText = extraDogs
    .map((dog, i) =>
      [
        "",
        `— DOG ${i + 2} —`,
        line("Name", dog.name),
        line("Breed", dog.breed),
        line("Gender", dog.gender),
        line("Age", dog.age),
        line("With other dogs", dog.withDogs),
        line("With other people", dog.withPeople),
        line("Needs help with", dog.needHelp),
        line("Allergies", dog.allergies),
        line("Lead / tools used", dog.tools),
        line("Trusts our guidance", dog.trust),
      ].join("\n")
    )
    .join("\n");

  const text = [
    `New meet & greet request from the ${site.name} website`,
    "",
    "— BOOKING —",
    line("Service", svc?.label),
    line("Booking type", bt?.label),
    line("Dogs", String(dogs)),
    line("Estimated price", price ? `£${price.total} per ${price.unit}` : undefined),
    "",
    "— CONTACT —",
    line("Name", `${firstName} ${lastName}`),
    line("Email", email),
    line("Phone", d.phone),
    line("Address", d.address),
    line("Found us via", d.findUs),
    "",
    extraDogs.length ? "— DOG 1 —" : "— DOG —",
    line("Name", d.dogName),
    line("Breed", d.breed),
    line("Gender", d.gender),
    line("Age", d.age),
    line("With other dogs", d.withDogs),
    line("With other people", d.withPeople),
    line("Needs help with", d.needHelp),
    line("Allergies", d.allergies),
    line("Lead / tools used", d.tools),
    line("Trusts our guidance", d.trust),
    ...(extraDogsText ? [extraDogsText] : []),
  ].join("\n");

  // Save to the trainer's onboarding list (Supabase) so the request is never
  // lost, even before email is set up.
  const { company: _honeypot, ...answers } = d;
  void _honeypot;
  const dogNames = [String(d.dogName ?? "").trim(), ...extraDogs.map((x) => String(x.name ?? "").trim())]
    .filter(Boolean)
    .join(", ");
  const stored = await saveEnquiry({
    kind: "booking",
    name: `${firstName} ${lastName}`,
    email,
    phone: String(d.phone ?? "").trim(),
    message: String(d.needHelp ?? "").trim(),
    service: [svc?.label, bt?.label].filter(Boolean).join(" · "),
    dogNames,
    details: { ...answers, estimatedPrice: price ? `£${price.total} per ${price.unit}` : null },
  });

  // Emails are best-effort — they never block the submission (the request
  // itself is the deliverable) and no-op without RESEND_API_KEY. See .env.example.
  // 1) Notify the team. 2) Confirm to the customer that we've got their request.
  const [ownerEmailed] = await Promise.all([
    sendEmail(
      bookingOwnerNotification({
        firstName,
        lastName,
        email,
        serviceLabel: svc?.label,
        detailsText: text,
        to: ownerAddress(),
      })
    ),
    sendEmail(
      bookingConfirmation({
        firstName,
        email,
        dogName: d.dogName,
        serviceLabel: svc?.label,
      })
    ),
  ]);

  // Saved or emailed is enough. If neither worked, say so rather than
  // pretending — the visitor can still call or email.
  if (!stored && !ownerEmailed) {
    return Response.json(
      { error: "Sorry, we couldn't send your request just now. Please try again, or call or email us directly." },
      { status: 503 }
    );
  }
  return Response.json({ ok: true });
}
