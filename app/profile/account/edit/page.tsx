import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AccountDetailsForm } from "@/components/account/AccountDetailsForm";

export const metadata: Metadata = {
  title: "Edit details",
  robots: { index: false, follow: false },
};

export default function EditAccountPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <Link href="/profile/account" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to account
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Account</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-paper">Edit details</h1>
            <div className="mt-8">
              <AccountDetailsForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
