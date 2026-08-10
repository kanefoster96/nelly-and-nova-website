import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { SectionBackground } from "./ui/SectionBackground";
import { media } from "@/config/media";

export function OneToOne() {
  return (
    <section
      id="one-to-one"
      className="relative isolate overflow-hidden py-20 sm:py-28"
    >
      <SectionBackground
        src={media.oneToOne.background}
        parallax={50}
        overlay
      />

      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            Learn it yourself
          </p>
          <h2 className="display-heading text-4xl text-paper sm:text-5xl">
            1-1 Training
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <p className="mx-auto mt-6 max-w-xl text-lg text-paper/85">
            Prefer to be hands-on? In our 1-1 sessions I coach you directly, so
            you can understand your dog, practise the techniques yourself and
            keep the results going long after we&apos;ve finished.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 flex justify-center">
            <Button href="#book" size="lg">
              Enquire about 1-1 Training
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
