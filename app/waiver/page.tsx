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
        <section className="bg-ink pb-24 pt-24">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm uppercase tracking-widest text-paper-dim">Dog registration</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                Final consent &amp; waiver
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
                Your progress saves as you go, so you can come back and finish later.
              </p>
            </div>
            <div className="mt-10">
              <WaiverForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
