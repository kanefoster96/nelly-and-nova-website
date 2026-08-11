"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { CheckCircleIcon } from "./ui/Icons";

type Status = "idle" | "submitting" | "success" | "error";

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "mb-2 block text-sm font-medium text-paper/90";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("success");
    } catch {
      setError("Couldn’t reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10"
      >
        <CheckCircleIcon width={40} height={40} className="mx-auto text-accent" />
        <h3 className="display-heading mt-4 text-2xl text-paper">
          Message sent
        </h3>
        <p className="mt-3 text-paper/70">
          Thanks for getting in touch — we&apos;ll get back to you as soon as we
          can.
        </p>
        <div className="mt-6">
          <Button variant="secondary" radius="xl" onClick={() => setStatus("idle")}>
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8"
    >
      {/* Honeypot (hidden from humans) */}
      <div className="hidden" aria-hidden="true">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input id="name" name="name" required autoComplete="name" className={fieldClass} placeholder="Your name" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className={fieldClass} placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone <span className="text-paper-dim">(optional)</span>
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={fieldClass} placeholder="07000 000000" />
          </div>
        </div>

        <div>
          <label htmlFor="message" className={labelClass}>
            How can we help?
          </label>
          <textarea id="message" name="message" required rows={5} className={`${fieldClass} resize-y`} placeholder="Tell us about your dog and what you'd like help with…" />
        </div>

        {status === "error" && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div>
          <Button
            size="lg"
            radius="xl"
            disabled={status === "submitting"}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Sending…" : "Send message"}
          </Button>
        </div>
      </div>
    </form>
  );
}
