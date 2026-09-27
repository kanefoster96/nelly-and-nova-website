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
            <div className="text-center">
              <p className="text-sm uppercase tracking-widest text-paper-dim">Free meet &amp; greet</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                Let&apos;s get started
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
                A few questions about you and your dog. No payment, no commitment,
                and your answers save as you go.
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
