import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { painIcons, ArrowRightIcon } from "./ui/Icons";
import { understand, CONTACT_HREF } from "@/config/site";

export function WeUnderstand() {
  return (
    <section id="understand" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Reveal>
          <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
            {understand.heading}
          </h2>
        </Reveal>

        <div className="mt-12 flex flex-col gap-5">
          {understand.points.map((point, i) => {
            const Icon = painIcons[point.icon];
            return (
              <Reveal key={point.title} delay={i * 0.08}>
                <article className="rounded-3xl bg-white/[0.04] px-6 py-10 text-center ring-1 ring-white/5 sm:px-10">
                  <Icon
                    width={34}
                    height={34}
                    className="mx-auto text-paper"
                  />
                  <h3 className="display-heading mt-5 text-xl text-paper sm:text-2xl">
                    {point.title}
                  </h3>
                  <p className="mx-auto mt-4 max-w-md text-paper/70">
                    {point.body}
                  </p>
                </article>
              </Reveal>
            );
          })}
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
