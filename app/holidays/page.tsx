import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { ScheduledHolidays } from "@/components/holidays/ScheduledHolidays";
import { holidays, CONTACT_HREF } from "@/config/site";

export const metadata: Metadata = {
  title: "Holidays",
  description:
    "Planned closure dates for Nelly & Nova dog training, and how our membership value works.",
};

export default function HolidaysPage() {
  const { value, scheduled } = holidays;
  const [before, after] = value.savings.text.split(value.savings.highlight);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              {holidays.heading}
            </h1>
            <p className="mt-3 text-sm text-paper-dim">
              Last Updated: {holidays.updated}
            </p>
            <p className="mt-8 text-paper/80">{holidays.intro}</p>
            <div className="mt-8 h-px w-16 bg-white/30" />

            {/* Membership value */}
            <div className="mt-10">
              <h2 className="display-heading text-xl text-paper sm:text-2xl">
                {value.heading}
              </h2>
              <p className="mt-5 font-bold text-paper">{value.lead}</p>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  {value.pricingHeading}
                </p>
                <dl className="mt-3">
                  {value.pricing.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2"
                    >
                      <dt className="text-paper/80">{row.label}</dt>
                      <dd className="font-semibold text-paper">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="mt-6 text-paper/80">
                {before}
                <span className="font-semibold text-paper underline decoration-white/40 underline-offset-4">
                  {value.savings.highlight}
                </span>
                {after}
              </p>

              <div className="mt-6 space-y-4 text-paper/80">
                {value.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Scheduled holidays — static config + trainer-added closures */}
            <ScheduledHolidays
              heading={scheduled.heading}
              year={scheduled.year}
              configPeriods={scheduled.periods}
            />

            {/* CTA */}
            <div className="mt-12">
              <Button href={CONTACT_HREF} variant="secondary" radius="xl">
                Questions about dates? Contact us
                <ArrowRightIcon width={18} height={18} />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
