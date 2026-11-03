import { Reveal } from "./ui/Reveal";
import { OverlayCard } from "./ui/OverlayCard";
import { ArrowRightIcon, MapPinIcon } from "./ui/Icons";
import { services } from "@/config/site";

/** The two services — Full Day Training and 1-1 Training — as photo cards. */
export function WhatWeDo() {
  return (
    <section id="services" aria-labelledby="services-heading" className="bg-ink pb-20 sm:pb-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <h2 id="services-heading" className="sr-only">
          {services.heading}
        </h2>

        <div className="flex flex-col gap-4">
          {services.tabs.map((tab, i) => (
            <Reveal key={tab.id} delay={i * 0.08}>
              <OverlayCard
                image={tab.image}
                eyebrow={tab.subtitle.replace(/\.$/, "")}
                title={tab.label.replace(/\.$/, "")}
                body={tab.description}
                cta={tab.pageHref ? "Learn more" : tab.cta}
                href={tab.pageHref ?? tab.ctaHref}
                index={i + 1}
              />
            </Reveal>
          ))}
        </div>

        {/* Coverage check */}
        <a
          href={services.areaHref}
          className="glass mt-4 flex min-h-[56px] items-center justify-center gap-3 rounded-2xl px-6 text-paper transition-colors"
        >
          <span className="font-medium">{services.areaCta}</span>
          <ArrowRightIcon width={18} height={18} className="text-paper/70" />
          <MapPinIcon width={22} height={22} className="ml-1" />
        </a>
      </div>
    </section>
  );
}
