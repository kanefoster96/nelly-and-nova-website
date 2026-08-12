import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WaiverForm } from "@/components/waiver/WaiverForm";

export const metadata: Metadata = {
  title: "Final Consent & Waiver",
  robots: { index: false, follow: false },
};

export default function WaiverPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Final consent &amp; waiver
            </p>
            <h1 className="display-heading mt-2 text-3xl text-paper sm:text-4xl">
              Complete your onboarding
            </h1>
            <p className="mt-3 max-w-xl text-paper/75">
              The last step before your dog starts. It saves as you go, so you can
              come back any time to finish.
            </p>
            <div className="mt-8">
              <WaiverForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
