import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = {
  title: "Book a Free Meet & Greet",
  description:
    "Ask for a free meet & greet with Nelly & Nova — tell us about your dog and what you'd like help with, and we'll be in touch to arrange a day to meet.",
};

export default function BookPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-24">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm uppercase tracking-widest text-paper-dim">Free meet &amp; greet</p>
              <h1 className="display-heading mt-2 text-3xl uppercase text-paper sm:text-4xl">
                Meet us for free
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
                Four quick steps about your dog. No payment, no commitment — we&apos;ll be
                in touch to arrange a day to meet.
              </p>
            </div>

            <div className="mt-10">
              <BookingForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
