import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { appLinks, contact } from "@/config/site";

export const metadata: Metadata = {
  title: "Get the app",
  description: "Download the Nelly & Nova app: your dog's sessions, report cards, homework and a chat with us.",
};

/**
 * The link (and QR code) a trainer shares at the meet & greet, from the
 * app's onboarding page ("Invite to the app"). On an iPhone, once the app is
 * on the App Store (appLinks.appStoreUrl in config/site.ts), it goes straight
 * there. Until then it explains installing from TestFlight. Either way the
 * last step is logging in with the email they gave us.
 */
export default async function GetTheAppPage() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const iPhone = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  if (iPhone && appLinks.appStoreUrl) redirect(appLinks.appStoreUrl);

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : "")).replace(/\/$/, "");
  const here = `${origin}/app`;
  const onComputer = !iPhone && !android;

  const steps: { title: string; body: ReactNode }[] = appLinks.appStoreUrl
    ? [
        {
          title: "Download the app",
          body: (
            <a href={appLinks.appStoreUrl} className="underline underline-offset-4">
              Get Nelly &amp; Nova on the App Store
            </a>
          ),
        },
      ]
    : [
        {
          title: "Install TestFlight",
          body: (
            <>
              While the app is in testing it comes through TestFlight, Apple&apos;s own app for it.{" "}
              <a href={appLinks.testFlightAppUrl} className="underline underline-offset-4">
                Get TestFlight from the App Store
              </a>
              .
            </>
          ),
        },
        {
          title: "Join and install Nelly & Nova",
          body: appLinks.testFlightUrl ? (
            <>
              <a href={appLinks.testFlightUrl} className="underline underline-offset-4">
                Open our TestFlight invite
              </a>
              , tap Accept, then Install.
            </>
          ) : (
            <>
              We&apos;ll send you the invite link. Haven&apos;t had it?{" "}
              <a href={contact.whatsapp} className="underline underline-offset-4">
                Message us on WhatsApp
              </a>{" "}
              and we&apos;ll send it straight over.
            </>
          ),
        },
      ];
  steps.push({
    title: "Log in with your email",
    body: "Open the app and log in with the email address you gave us. The first time, we'll email you a button to choose your password.",
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-ink px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Nelly &amp; Nova</p>
      <h1 className="display-heading mt-3 text-4xl uppercase text-paper">Get the app</h1>
      <p className="mt-4 text-paper/70">
        Your dog&apos;s sessions, pick-up updates, report cards and homework, and a chat with us, all in one place.
      </p>

      {android && (
        <p className="mt-6 rounded-2xl border border-paper/10 bg-ink-soft p-4 text-sm text-paper-dim">
          The app is on iPhone for now. Until it&apos;s on Android, you can{" "}
          <Link href="/login" className="underline underline-offset-4">
            log in on our website
          </Link>{" "}
          with the email you gave us.
        </p>
      )}

      <ol className="mt-8 space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{i + 1}</span>
            <div>
              <p className="font-semibold text-paper">{s.title}</p>
              <p className="mt-1 text-sm text-paper-dim">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {appLinks.appStoreUrl && onComputer && (
        <a
          href={appLinks.appStoreUrl}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Open the App Store
        </a>
      )}

      {onComputer && origin && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-paper/10 bg-ink-soft p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG, nothing for next/image to optimise */}
          <img src={`/api/qr?data=${encodeURIComponent(here)}`} alt="QR code for this page" width={180} height={180} className="rounded-lg" />
          <p className="mt-4 text-sm text-paper-dim">On a computer? Scan this with your iPhone&apos;s camera to open this page there.</p>
        </div>
      )}

      <p className="mt-8 text-sm text-paper-dim">
        Stuck?{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Get in touch
        </Link>{" "}
        and we&apos;ll help.
      </p>
    </main>
  );
}
