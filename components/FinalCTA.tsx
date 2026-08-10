import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { SectionBackground } from "./ui/SectionBackground";
import { media } from "@/config/media";
import { BOOKING_HREF } from "@/config/site";

export function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      <SectionBackground src={media.finalCta.background} parallax={40} />

      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="display-heading text-5xl text-paper sm:text-7xl">
            Ready to start?
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mx-auto mt-5 max-w-lg text-lg text-paper/85">
            Let&apos;s build a calm, confident, well-mannered dog together —
            through trust, engagement and real-life skills.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-9 flex justify-center">
            <Button href={BOOKING_HREF} size="lg">
              Book Now
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
