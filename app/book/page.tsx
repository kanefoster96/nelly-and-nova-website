import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = {
  title: "Book a Free Meet & Greet",
  description:
    "Get started with Nelly & Nova — Full Day Training (with a free meet & greet), 1-1 or Online Training. Tell us about your dog and we'll be in touch.",
};

export default function BookPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-24">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm uppercase tracking-widest text-paper-dim">Get started</p>
              <h1 className="display-heading mt-2 text-3xl uppercase text-paper sm:text-4xl">
                Tell us about your dog
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
                Four quick steps. No payment, no commitment — we&apos;ll be in touch. Rather just
                ask a question?{" "}
                <a href="/contact" className="underline underline-offset-2 hover:text-paper">
                  Contact us
                </a>
                .
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
