import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import Image from "next/image";
import { ArrowRightIcon } from "./ui/Icons";
import { understand, CONTACT_HREF } from "@/config/site";

export function WeUnderstand() {
  return (
    <section id="understand" aria-labelledby="understand-heading" className="bg-ink py-20 sm:py-32">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* No visible title — the cards speak for themselves. */}
        <h2 id="understand-heading" className="sr-only">
          {understand.heading}
        </h2>

        {/* Photo on the left, words on the right: these are statements, not
            buttons, so nothing here looks tappable (no arrows, no hover). */}
        <ul className="flex flex-col gap-10 sm:gap-14">
          {understand.points.map((point, i) => (
            <Reveal as="li" key={point.title} delay={i * 0.08} className="flex items-center gap-6 sm:gap-8">
                <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl sm:w-40">
                  <Image src={point.image} alt="" fill sizes="(min-width: 640px) 10rem, 7rem" className="object-cover" />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">{point.eyebrow}</p>
                  <h3 className="display-heading mt-2 text-2xl uppercase leading-none text-paper sm:text-3xl">{point.title}</h3>
                  <p className="mt-3 text-paper/70">{point.body}</p>
                </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1}>
          <div className="mt-20 text-center">
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
