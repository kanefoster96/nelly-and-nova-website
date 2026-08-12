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
            {/* Compact header — the form's step heading is the main title, so the
                whole step fits on screen without scrolling. */}
            <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Final consent &amp; waiver
            </h1>
            <div className="mt-5">
              <WaiverForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
