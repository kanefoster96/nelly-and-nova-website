import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import {
  WhatsAppIcon,
  PhoneIcon,
  socialIcons,
  ArrowRightIcon,
} from "@/components/ui/Icons";
import { contact, socials } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Nelly & Nova — send us a message, or reach us on WhatsApp, phone, Instagram or Facebook.",
};

const methods = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    sub: "Message us",
    href: contact.whatsapp,
    Icon: WhatsAppIcon,
    external: true,
  },
  {
    key: "phone",
    label: "Call us",
    sub: contact.phoneLabel,
    href: `tel:${contact.phone.replace(/\s+/g, "")}`,
    Icon: PhoneIcon,
    external: false,
  },
  ...socials.map((s) => ({
    key: s.icon,
    label: s.label,
    sub: "Follow us",
    href: s.href,
    Icon: socialIcons[s.icon],
    external: true,
  })),
];

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Get in touch
            </p>
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              Contact.
            </h1>
            <p className="mt-6 max-w-xl text-paper/80">
              Have a question or want to book a free meet &amp; greet? Send us a
              message and we&apos;ll get back to you, or reach us any of the ways
              below.
            </p>

            <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-12">
              {/* Form */}
              <ContactForm />

              {/* Other ways to reach us */}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-paper/60">
                  Prefer another way?
                </h2>
                <ul className="mt-4 space-y-3">
                  {methods.map((m) => (
                    <li key={m.key}>
                      <a
                        href={m.href}
                        {...(m.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition-colors hover:ring-accent/50"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-paper transition-colors group-hover:text-accent">
                          <m.Icon width={22} height={22} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-paper">
                            {m.label}
                          </span>
                          <span className="block truncate text-sm text-paper-dim">
                            {m.sub}
                          </span>
                        </span>
                        <ArrowRightIcon
                          width={18}
                          height={18}
                          className="ml-auto shrink-0 text-paper-dim transition-colors group-hover:text-accent"
                        />
                      </a>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-sm text-paper-dim">
                  Or email us at{" "}
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-paper underline underline-offset-2 hover:text-accent"
                  >
                    {contact.email}
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
