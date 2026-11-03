"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
  socialIcons,
} from "./ui/Icons";
import { areas, contact, socials } from "@/config/site";

/**
 * The contact page, laid out like Kanvas Academy's: a centred heading, the
 * ways to reach us as cards (areas we cover, WhatsApp, phone, email), then
 * "Send us a message", and a full "Message sent!" screen once it's gone.
 *
 * Kanvas has a studio, so its first card is a map with directions. Nelly &
 * Nova come to you, so that card lists the areas we cover instead.
 *
 * The form posts to /api/contact, which saves the enquiry to the trainer's
 * Onboarding list and emails it to the team.
 */

const cardClass = "rounded-3xl bg-white/[0.04] p-7";
const fieldClass =
  "w-full rounded-xl border border-transparent bg-white/[0.05] px-4 py-3 text-paper placeholder:text-paper-dim focus:border-white/30 focus:bg-white/[0.07] focus:outline-none";
const labelClass = "mb-2 block text-sm text-paper-dim";
const eyebrowClass = "text-xs font-semibold uppercase tracking-[0.3em] text-paper-dim";

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // When the form was first shown, for the server's too-fast-to-be-human check.
  const [startedAt] = useState(() => Date.now());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, startedAt }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
        <CheckCircleIcon width={56} height={56} className="text-paper" />
        <p className={`mt-8 ${eyebrowClass}`}>Contact</p>
        <h1 className="display-heading mt-3 text-3xl text-paper sm:text-4xl">Message sent!</h1>
        <p className="mt-4 text-paper/70">
          Thanks for getting in touch — we&apos;ll get back to you about your dog as soon as we can.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const phoneHref = `tel:${contact.phone.replace(/\s+/g, "")}`;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="text-center">
        <p className={eyebrowClass}>Contact</p>
        <h1 className="display-heading mt-3 text-4xl leading-[1.05] text-paper sm:text-[56px]">
          Get in touch. <span className="text-paper/60">We&apos;ll get back to you.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-paper/70">
          Got a question about your dog, or want to book a free meet &amp; greet? We come to you across
          Tynemouth, Backworth and the North East — send a message below and we&apos;ll get back to you.
        </p>
      </div>

      {/* Where we train (Kanvas shows its studio here) */}
      <div className={`mt-12 ${cardClass}`}>
        <div className="flex items-center gap-2">
          <MapPinIcon width={16} height={16} className="text-paper-dim" />
          <p className={eyebrowClass}>Areas we cover</p>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {areas.map((area) => (
            <li key={area} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-paper">
              {area}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-paper-dim">
          Not on the list? Ask us — we may still be able to help.
        </p>
      </div>

      {/* Ways to reach us */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: "WhatsApp", value: "Message us", href: contact.whatsapp, Icon: WhatsAppIcon, external: true },
          { label: "Phone", value: contact.phoneLabel, href: phoneHref, Icon: PhoneIcon, external: false },
          { label: "Email", value: contact.email, href: `mailto:${contact.email}`, Icon: MailIcon, external: false },
        ].map(({ label, value, href, Icon, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`group block transition-colors hover:bg-white/[0.07] ${cardClass}`}
          >
            <div className="flex items-center gap-2">
              <Icon width={16} height={16} className="text-paper-dim" />
              <p className={eyebrowClass}>{label}</p>
            </div>
            <p className="mt-2 break-words font-semibold text-paper">{value}</p>
          </a>
        ))}
      </div>

      {socials.length > 0 && (
        <div className="mt-4 flex justify-center gap-3">
          {socials.map((s) => {
            const Icon = socialIcons[s.icon];
            return (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="glass flex h-11 w-11 items-center justify-center rounded-full text-paper"
              >
                <Icon width={20} height={20} />
              </a>
            );
          })}
        </div>
      )}

      {/* The form */}
      <div className="mx-auto mt-14 max-w-lg">
        <h2 className="display-heading text-center text-2xl text-paper">Send us a message</h2>

        {error && (
          <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className={`relative mt-6 flex flex-col gap-4 p-6 sm:p-8 ${cardClass}`}>
          <div>
            <label htmlFor="name" className={labelClass}>Your name</label>
            <input id="name" name="name" required autoComplete="name" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Your email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Your phone <span className="text-paper-dim/70">(optional)</span>
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="message" className={labelClass}>Your question</label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              placeholder="Tell us about your dog and what you'd like help with…"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {/* Honeypot: hidden from people and screen readers, filled in by bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="company">Leave this empty</label>
            <input id="company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send Message"}
            {!submitting && <ArrowRightIcon width={16} height={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
