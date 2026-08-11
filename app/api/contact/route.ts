import { contact, site } from "@/config/site";
import { createRequest } from "@/lib/inbox/data";
import { contactToRequest } from "@/lib/inbox/mappers";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();
  // Honeypot — bots fill hidden fields; humans never see it.
  const honeypot = String(body.company ?? "").trim();

  if (honeypot) return Response.json({ ok: true });

  if (!name || !email || !message) {
    return Response.json(
      { error: "Please fill in your name, email and message." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  // Record the submission as an inbox request (scaffold no-op until a backend).
  await createRequest(contactToRequest(body));

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet — see .env.example for setup.
    return Response.json(
      { error: "The contact form isn’t connected to email yet." },
      { status: 503 }
    );
  }

  const to = process.env.CONTACT_TO_EMAIL || contact.email;
  const from =
    process.env.CONTACT_FROM_EMAIL || `${site.name} <onboarding@resend.dev>`;

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
        subject: `New enquiry from ${name}`,
        text:
          `New enquiry from the ${site.name} website\n\n` +
          `Name: ${name}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone || "—"}\n\n` +
          `Message:\n${message}\n`,
      }),
    });

    if (!res.ok) {
      console.error("Resend error", res.status, await res.text().catch(() => ""));
      return Response.json(
        {
          error:
            "Sorry, something went wrong sending your message. Please try again or email us directly.",
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Contact route error", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
