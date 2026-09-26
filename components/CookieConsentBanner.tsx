"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CONSENT_COOKIE_DAYS,
  CONSENT_COOKIE_NAME,
  CONSENT_DENIED,
  CONSENT_GRANTED,
  CONSENT_GRANTED_EVENT,
} from "@/lib/cookie-consent";

function getCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function setConsentCookie(value: string) {
  const expires = new Date(Date.now() + CONSENT_COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Held back a moment so the first thing a visitor meets is the page, not a
 * consent question. Kanvas waits 10s because a trial-offer banner shows
 * first; there's no promo banner here, so 3s is enough. Nothing tracks
 * during the wait.
 */
const SHOW_AFTER_MS = 3_000;

/**
 * Cookie consent card — the same layout as the Kanvas Academy site: a
 * floating card at the bottom with a title, one honest paragraph, and
 * Decline / Accept as two equal buttons. Decline is exactly as easy as
 * Accept (same size, same row), which is what makes the consent valid
 * under UK GDPR / PECR. Shown once until answered; "Cookie Settings" in
 * the footer lets people change their mind.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookie(CONSENT_COOKIE_NAME)) return;
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function accept() {
    setConsentCookie(CONSENT_GRANTED);
    window.dispatchEvent(new Event(CONSENT_GRANTED_EVENT));
    setVisible(false);
  }

  function decline() {
    setConsentCookie(CONSENT_DENIED);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-body"
      className="fixed inset-x-0 z-40 flex justify-center px-4 animate-fade-up"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl shadow-black/60">
        <p id="cookie-title" className="text-base font-semibold text-white">
          Cookie settings
        </p>
        <p id="cookie-body" className="mt-2 text-sm leading-relaxed text-neutral-300">
          We&apos;d be grateful if you accepted. Cookies help us get our ads to the
          right people — it&apos;s how we reach other local dog owners in Tynemouth,
          Backworth and around who haven&apos;t found us yet. You can read our cookie
          policy{" "}
          <Link href="/cookies" className="text-white underline underline-offset-2 hover:text-white/80">
            here
          </Link>
          .
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={decline}
            className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 active:bg-white/20"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-opacity hover:opacity-90 active:opacity-75"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
