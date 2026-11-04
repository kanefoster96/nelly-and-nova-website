import type { Metadata } from "next";
import Link from "next/link";
import { refreshFromBillingRequest } from "@/lib/gocardless/record";
import { BackToApp } from "./BackToApp";

export const metadata: Metadata = {
  title: "Direct Debit",
  robots: { index: false, follow: false },
};

const APP_URL = "nellyandnova://dog?dd=done";

/**
 * Where GoCardless sends an owner who set up their Direct Debit from the
 * app (app/api/onboarding/direct-debit). It checks with GoCardless straight
 * away, so their checklist is right the moment they're back, then hands
 * them back to the app by its own scheme. In the app's sign-in sheet that
 * closes the sheet by itself; in a browser it's the button.
 * `left=1`: they closed GoCardless's page without finishing.
 */
export default async function DirectDebitDonePage({ searchParams }: { searchParams: Promise<{ br?: string; left?: string }> }) {
  const { br = "", left } = await searchParams;
  const finished = !left;
  // Only ever a GoCardless set-up id; nn_gc_record only updates set-ups the site created.
  if (finished && /^BRQ[0-9A-Z]{6,40}$/.test(br)) await refreshFromBillingRequest(br);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-ink px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Nelly &amp; Nova</p>
      <h1 className="display-heading mt-3 text-4xl uppercase text-paper">{finished ? "All done" : "No problem"}</h1>
      <p className="mt-4 text-paper/70">
        {finished
          ? "Your Direct Debit is set up. Your bank confirms it over the next few working days, and nothing is taken until we've agreed your price and dates with you. Go back to the app to carry on."
          : "Nothing has been set up. You can come back to it from your checklist in the app whenever you're ready."}
      </p>
      <BackToApp href={APP_URL} />
      <p className="mt-6 text-sm text-paper-dim">
        Not using the app?{" "}
        <Link href="/profile" className="underline underline-offset-4">
          Go to your profile
        </Link>
        .
      </p>
    </main>
  );
}
