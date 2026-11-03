import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { contact } from "@/config/site";

export const metadata: Metadata = { title: "Your data", robots: { index: false, follow: false } };

/** Download everything we hold about you, or delete your account (ported from Kanvas Academy). */
export default function YourDataPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1 bg-ink">
        <section className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
          <Link href="/profile/account" className="text-sm text-paper-dim hover:text-paper">
            ← Back to your account
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Account</p>
          <h1 className="display-heading mt-2 text-3xl uppercase text-paper">Your data</h1>
          <div className="mt-8 grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-ink-soft p-6">
              <p className="font-semibold text-paper">Download a copy</p>
              <p className="mt-2 text-sm text-paper/70">
                Your account, your dogs&apos; records, consent &amp; waivers, training places, Direct Debit status and your
                chat with us, in one file.
              </p>
              <a href="/account/your-data/download" className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink">
                Download my data
              </a>
            </div>
            <div className="rounded-3xl border border-white/10 bg-ink-soft p-6">
              <p className="font-semibold text-paper">Delete your account</p>
              <p className="mt-2 text-sm text-paper/70">Close your account and remove your data for good.</p>
              <Link href="/account/delete" className="glass mt-5 inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold text-paper">
                Delete my account
              </Link>
            </div>
            <p className="text-sm text-paper-dim">
              Questions about your data? Email{" "}
              <a href={`mailto:${contact.email}`} className="underline">
                {contact.email}
              </a>
              . See our <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
