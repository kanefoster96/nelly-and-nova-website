import Image from "next/image";
import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { media } from "@/config/media";

export function About() {
  return (
    <section id="about" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-14">
        {/* Portrait */}
        <Reveal from="left" className="order-1 md:order-none">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl bg-ink-raised ring-1 ring-white/10">
            <Image
              src={media.about.portrait}
              alt="Charlotte, founder of Nelly & Nova, with a dog"
              fill
              sizes="(min-width: 768px) 24rem, 90vw"
              className="object-cover"
            />
          </div>
        </Reveal>

        {/* Copy */}
        <div>
          <Reveal>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Meet the founder
            </p>
            <h2 className="display-heading text-4xl text-paper sm:text-5xl">
              Hi, I&apos;m Charlotte
            </h2>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-6 space-y-4 text-paper/80">
              <p>
                I started Nelly &amp; Nova out of a genuine passion for dogs —
                for how they learn, how they move, and what they eat. Training
                and canine nutrition go hand in hand, and I love helping owners
                understand both so their dog can truly thrive.
              </p>
              <p>
                My mission is simple: to build calm, confident, well-mannered
                dogs through trust, engagement and real-life skills. No fear, no
                shortcuts — just clear communication and a strong relationship
                between you and your dog.
              </p>
              <p>
                Whether it&apos;s a bouncy puppy, a teenage dog testing the
                boundaries, or an adult who needs a little more confidence, we
                meet them where they are and build from there.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="#book">Book Walk &amp; Train</Button>
              <Button href="#one-to-one" variant="secondary">
                1-1 Training
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
