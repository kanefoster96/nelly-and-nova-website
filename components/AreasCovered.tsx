import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { areas, BOOKING_HREF } from "@/config/site";

export function AreasCovered() {
  return (
    <section id="areas" className="bg-ink-soft py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Where we work
            </p>
            <h2 className="display-heading text-4xl text-paper sm:text-5xl">
              Areas Covered
            </h2>
            <p className="mt-6 text-lg text-paper/80">
              We train across the North East coast and surrounding areas. Not
              sure if you&apos;re in range? Just ask.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.05}>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {areas.map((area) => (
              <li
                key={area}
                className="flex min-h-[56px] items-center rounded-2xl bg-ink-raised px-5 text-paper ring-1 ring-white/10 transition-colors hover:ring-accent/60"
              >
                <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span className="font-semibold">{area}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-10">
            <Button href={BOOKING_HREF} size="lg" variant="secondary">
              Check your area
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
