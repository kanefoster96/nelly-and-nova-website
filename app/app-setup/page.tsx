import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Open the app",
  robots: { index: false, follow: false },
  // The address carries a live ticket: don't hand it on to anywhere linked from here.
  referrer: "no-referrer",
};

const APP_SCHEME = "nellyandnova";

/**
 * Where the "Set up my account" / "Reset my password" email lands when it
 * doesn't open the app by itself (a computer, or an email app that opens
 * links in its own browser). The button hands the same address to the app
 * by its own scheme, which goes on to choosing a password. Nothing is used
 * up by opening this page; the ticket is only spent when the password is saved.
 */
export default async function AppSetupPage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string; a?: string }> }) {
  const { e = "", t = "", a = "" } = await searchParams;
  const appUrl = `${APP_SCHEME}://app-setup?${new URLSearchParams({ e, t, a })}`;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-ink px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Nelly &amp; Nova</p>
      <h1 className="display-heading mt-3 text-4xl uppercase text-paper">Open the app</h1>
      <p className="mt-4 text-paper/70">Tap below to carry on in the Nelly &amp; Nova app and choose your password.</p>
      <a
        href={appUrl}
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Open the App
      </a>
      <p className="mt-6 text-sm text-paper-dim">
        On a computer? Open the email on your phone instead. Haven&apos;t got the app yet?{" "}
        <Link href="/contact" className="underline underline-offset-4">
          Ask us for it
        </Link>
        .
      </p>
    </main>
  );
}
