import { contact, site } from "@/config/site";
import { findService, findBookingType, priceFor } from "@/config/booking";
import { createRequest } from "@/lib/inbox/data";
import { bookingToRequest } from "@/lib/inbox/mappers";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let d: Record<string, string>;
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
    "— DOG —",
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
  ].join("\n");

  // Accept the submission as an inbox request (scaffold no-op until a backend).
  await createRequest(bookingToRequest(d));

  // Best-effort owner notification by email — optional, never blocks the
  // submission (the request itself is the deliverable). Set RESEND_API_KEY
  // to receive these; see .env.example.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const to = process.env.CONTACT_TO_EMAIL || contact.email;
    const from = process.env.CONTACT_FROM_EMAIL || `${site.name} <onboarding@resend.dev>`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: `New booking request — ${firstName} ${lastName} (${svc?.label ?? "enquiry"})`,
          text,
        }),
      });
      if (!res.ok) {
        console.error("Resend error", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("Booking email error", err);
    }
  }

  return Response.json({ ok: true });
}
