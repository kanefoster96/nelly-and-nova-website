import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = {
  title: "Book a Free Meet & Greet",
  description:
    "Book your free meet & greet with Nelly & Nova — tell us about you, your booking and your dog and we'll be in touch to arrange a visit.",
};

export default function BookPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-24">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            {/* Compact header so each step fits the screen — the form carries its
                own step heading. */}
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Book a free meet &amp; greet
            </p>
            <h1 className="display-heading mt-2 text-2xl text-paper sm:text-3xl">
              Let&apos;s get started.
            </h1>

            <div className="mt-6 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
              <BookingForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
