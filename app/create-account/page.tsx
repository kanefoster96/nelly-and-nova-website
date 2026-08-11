import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { CheckCircleIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default function CreateAccountPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-paper/80">
              <CheckCircleIcon width={20} height={20} className="shrink-0 text-accent" />
              Request sent — we&apos;ve got your details.
            </div>

            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Almost done
            </p>
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              Create your account.
            </h1>
            <p className="mt-6 text-paper/80">
              Create an account to track your booking, chat with us directly and
              get updates on your dog&apos;s progress.
            </p>

            <div className="mt-8">
              <Suspense fallback={null}>
                <SignupForm />
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
