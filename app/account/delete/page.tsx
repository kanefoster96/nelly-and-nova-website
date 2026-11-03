import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { createClient } from "@/lib/supabase/server";
import { contact } from "@/config/site";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "Close your Nelly & Nova account and remove your data, including your dogs' records.",
};

/**
 * Account deletion on the web (ported from Kanvas Academy). The app has its
 * own button, but Google Play also wants a page people can reach in a
 * browser without the app, so this is both.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav />
      <main id="main" className="flex-1 bg-ink">
        <section className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
          <Link href="/profile/account" className="text-sm text-paper-dim hover:text-paper">
            ← Back to your account
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Account</p>
          <h1 className="display-heading mt-2 text-3xl uppercase text-paper">Delete your account</h1>

          {!user ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-ink-soft p-6 text-paper/75">
              <p>Log in with the email you use for Nelly &amp; Nova, then come back here.</p>
              <p className="mt-2 text-sm text-paper-dim">
                Can&apos;t log in? Email us at{" "}
                <a href={`mailto:${contact.email}`} className="underline">
                  {contact.email}
                </a>{" "}
                and we&apos;ll close it for you.
              </p>
              <Link href="/login?next=/account/delete" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink">
                Log in
              </Link>
            </div>
          ) : (
            <>
              {error && <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
              <div className="mt-8 rounded-3xl border border-white/10 bg-ink-soft p-6 text-sm">
                <p className="font-semibold text-paper">What this removes</p>
                <ul className="mt-3 grid gap-2 text-paper/70">
                  <li>• Your login and profile.</li>
                  <li>• Your dogs&apos; records — details, health and vet information, documents, consent &amp; waivers, report cards and homework.</li>
                  <li>• Your messages, community posts and comments, and your training places.</li>
                </ul>
                <p className="mt-6 font-semibold text-paper">Your Direct Debit</p>
                <p className="mt-2 text-paper/70">
                  Any Direct Debit set up with us is cancelled straight away, so nothing collects again. This can&apos;t be
                  undone — coming back later means starting again.
                </p>
                <p className="mt-6 font-semibold text-paper">What we keep</p>
                <p className="mt-2 text-paper/70">
                  Records of payments are kept by GoCardless for as long as tax and accounting law requires. Nothing else is kept.
                </p>
                <ConfirmDeleteButton />
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
