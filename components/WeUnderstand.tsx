import { Reveal } from "./ui/Reveal";
import Image from "next/image";
import { understand } from "@/config/site";

export function WeUnderstand() {
  return (
    <section id="understand" aria-labelledby="understand-heading" className="bg-ink pb-8 pt-20 sm:pb-12 sm:pt-32">
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
      </div>
    </section>
  );
}
