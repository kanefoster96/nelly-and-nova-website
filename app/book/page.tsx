import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookingForm } from "@/components/BookingForm";
import { booking } from "@/config/booking";

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
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Book a free meet &amp; greet
            </p>
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              Let&apos;s get started.
            </h1>
            <p className="mt-6 max-w-xl text-paper/80">{booking.copy.intro}</p>

            <div className="mt-10 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
              <BookingForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
