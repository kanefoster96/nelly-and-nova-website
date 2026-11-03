import { site } from "@/config/site";
import { checkPostcode, meetGreetHelpLabels, meetGreetServiceLabel, meetGreet } from "@/config/booking";
import { saveEnquiry } from "@/lib/records/server";
import { sendEmail, ownerAddress } from "@/lib/email/resend";
import { bookingConfirmation, bookingOwnerNotification } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/**
 * Free meet & greet request from /book. Saved to the trainer's Onboarding
 * list (enquiries) and emailed to the team, with a "we'll be in touch" email
 * to the owner. Either saving or emailing the team is enough to say it worked.
 */
export async function POST(request: Request) {
  let d: Record<string, unknown>;
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: pretend it worked.
  if (clip(d.company, 200)) return Response.json({ ok: true });

  const firstName = clip(d.firstName, 80);
  const lastName = clip(d.lastName, 80);
  const email = clip(d.email, 254).toLowerCase();
  const phone = clip(d.phone, 40);
  const postcode = clip(d.postcode, 12).toUpperCase();
  const service = clip(d.service, 40);
  const dogs = (Array.isArray(d.dogs) ? d.dogs : [])
    .slice(0, 6)
    .map((x) => ({ name: clip((x as Record<string, unknown>)?.name, 80), breed: clip((x as Record<string, unknown>)?.breed, 80), age: clip((x as Record<string, unknown>)?.age, 40) }))
    .filter((x) => x.name);
  const validHelp = new Set(meetGreet.help.map((h) => h.value));
  const help = (Array.isArray(d.help) ? d.help : []).map((h) => String(h)).filter((h) => validHelp.has(h));
  const helpOther = clip(d.helpOther, 1000);

  if (!firstName || !lastName || !email || !phone || !postcode || dogs.length === 0 || !service) {
    return Response.json({ error: "Some details are missing — please go back and check each step." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const pc = checkPostcode(postcode);
  const coverage = pc.status === "covered" ? `Yes — ${pc.area}` : pc.status === "outside" ? `Not usually (${pc.outward}) — check` : "Couldn't tell — check";
  const serviceLabel = meetGreetServiceLabel(service);
  const helpLabels = meetGreetHelpLabels(help, helpOther);
  const dogNames = dogs.map((x) => x.name).join(", ");

  const line = (k: string, v?: string) => `${k}: ${v && v.trim() ? v.trim() : "—"}`;
  const text = [
    `New free meet & greet request from the ${site.name} website`,
    "",
    "— OWNER —",
    line("Name", `${firstName} ${lastName}`),
    line("Email", email),
    line("Phone", phone),
    line("Postcode", pc.formatted ?? postcode),
    line("In our area?", coverage),
    "",
    "— WHAT THEY'RE AFTER —",
    line("Interested in", serviceLabel),
    line("Help with", helpLabels.join(", ")),
    "",
    ...dogs.flatMap((x, i) => [dogs.length > 1 ? `— DOG ${i + 1} —` : "— DOG —", line("Name", x.name), line("Breed", x.breed), line("Age", x.age), ""]),
  ].join("\n");

  const stored = await saveEnquiry({
    kind: "booking",
    name: `${firstName} ${lastName}`,
    email,
    phone,
    message: helpLabels.join(", "),
    service: serviceLabel,
    dogNames,
    details: {
      firstName,
      lastName,
      postcode: pc.formatted ?? postcode,
      coverage: pc.status,
      area: pc.area ?? null,
      service,
      help,
      helpOther: helpOther || null,
      dogs,
    },
  });

  const [ownerEmailed] = await Promise.all([
    sendEmail(
      bookingOwnerNotification({ firstName, lastName, email, serviceLabel, detailsText: text, to: ownerAddress() })
    ),
    sendEmail(bookingConfirmation({ firstName, email, dogName: dogNames.replace(/, ([^,]*)$/, " & $1"), serviceLabel })),
  ]);

  if (!stored && !ownerEmailed) {
    return Response.json(
      { error: "Sorry, we couldn't send your request just now. Please try again, or call or email us directly." },
      { status: 503 }
    );
  }
  return Response.json({ ok: true });
}
