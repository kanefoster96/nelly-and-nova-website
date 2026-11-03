import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { OverlayCard } from "./ui/OverlayCard";
import { ArrowRightIcon } from "./ui/Icons";
import { understand, CONTACT_HREF } from "@/config/site";

export function WeUnderstand() {
  return (
    <section id="understand" aria-labelledby="understand-heading" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* No visible title — the cards speak for themselves. */}
        <h2 id="understand-heading" className="sr-only">
          {understand.heading}
        </h2>

        <div className="flex flex-col gap-4">
          {understand.points.map((point, i) => (
            <Reveal key={point.title} delay={i * 0.08}>
              <OverlayCard
                image={point.image}
                eyebrow={point.eyebrow}
                title={point.title}
                body={point.body}
                index={i + 1}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-14 text-center">
            <p className="mx-auto max-w-md text-paper/80">{understand.footer}</p>
            <div className="mt-6 flex justify-center">
              <Button href={CONTACT_HREF} size="lg">
                {understand.cta}
                <ArrowRightIcon width={20} height={20} />
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
