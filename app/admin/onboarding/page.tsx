import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { OnboardingBoard } from "@/components/admin/OnboardingBoard";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link href="/admin" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to dashboard
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Onboarding</h1>
            <p className="mt-3 text-paper/75">
              Every enquiry from the website — the contact form and the meet &amp; greet form. Book a
              meet &amp; greet from either, then move them through to onboarding.
            </p>
            <RequireAdmin>
              <OnboardingBoard />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
