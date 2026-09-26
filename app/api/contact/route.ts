import { site } from "@/config/site";
import { ownerAddress, sendEmail } from "@/lib/email/resend";
import { saveEnquiry } from "@/lib/records/server";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/**
 * Contact form. The enquiry is saved to Supabase (the trainer's onboarding
 * list, where a meet & greet can be booked from it) AND emailed to the team
 * when Resend is set up. Either one is enough to tell the visitor it worked;
 * only if both fail do we ask them to get in touch another way.
 */
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
  if (String(body.company ?? "").trim()) return Response.json({ ok: true });

  if (!name || !email || !message) {
    return Response.json({ error: "Please fill in your name, email and message." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const [stored, emailed] = await Promise.all([
    saveEnquiry({ kind: "contact", name, email, phone, message }),
    sendEmail({
      to: ownerAddress(),
      replyTo: email,
      subject: `New enquiry from ${name}`,
      text:
        `New enquiry from the ${site.name} website\n\n` +
        `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "—"}\n\nMessage:\n${message}\n\n` +
        `You can book a meet & greet from it in the trainer area → Onboarding.`,
      html:
        `<p>New enquiry from the ${escape(site.name)} website</p>` +
        `<p><b>Name:</b> ${escape(name)}<br/><b>Email:</b> ${escape(email)}<br/><b>Phone:</b> ${escape(phone || "—")}</p>` +
        `<p><b>Message:</b><br/>${escape(message).replace(/\n/g, "<br/>")}</p>` +
        `<p style="color:#888">You can book a meet &amp; greet from it in the trainer area → Onboarding.</p>`,
    }),
  ]);

  if (!stored && !emailed) {
    return Response.json(
      { error: "Sorry, we couldn't send your message just now. Please try again, or call or email us directly." },
      { status: 503 }
    );
  }
  return Response.json({ ok: true });
}
