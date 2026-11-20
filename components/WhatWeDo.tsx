import { Reveal } from "./ui/Reveal";
import { OverlayCard } from "./ui/OverlayCard";
import { SectionHeading } from "./ui/SectionHeading";
import { Button } from "./ui/Button";
import { ArrowRightIcon, CheckIcon, MapPinIcon } from "./ui/Icons";
import { services } from "@/config/site";

/** "Full Day Training" → "Full Day", for the tight comparison columns. */
const shortName = (label: string) => label.replace(/ Training$/, "");

const label = "text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/55";

/**
 * "Three ways we can help": the three services as equal choices. Each has its
 * photo card, who it's for, the time it asks of you, what you get, the price
 * and a link to its page; then a comparison (a stacked list on phones).
 */
export function WhatWeDo() {
  const { tabs, compare } = services;

  return (
    <section id="services" aria-labelledby="services-heading" className="bg-ink pb-20 pt-16 sm:pb-32 sm:pt-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <SectionHeading id="services-heading" align="center" eyebrow={services.eyebrow} lines={[services.heading]} />
        <Reveal delay={0.05}>
          <p className="mx-auto mt-5 max-w-md text-center text-paper/70">{services.lead}</p>
        </Reveal>

        <div className="mt-12 flex flex-col gap-6 sm:gap-8">
          {tabs.map((tab, i) => (
            <Reveal key={tab.id} delay={i * 0.08}>
              <div className="rounded-[2rem] bg-white/[0.04] p-2">
                <OverlayCard
                  compact
                  image={tab.image}
                  eyebrow={tab.subtitle}
                  title={tab.label}
                  body={tab.description}
                  index={i + 1}
                />

                <div className="px-5 pb-6 pt-7 sm:px-7 sm:pb-8">
                  {/* Price */}
                  <p className="flex items-baseline gap-2 text-paper">
                    <span className="display-heading text-4xl leading-none">{tab.price.amount}</span>
                    <span className="text-paper/70">{tab.price.unit}</span>
                  </p>
                  <p className="mt-2 text-sm text-paper/55">{tab.price.note}</p>

                  <dl className="mt-7 grid gap-6 sm:grid-cols-2">
                    <div>
                      <dt className={label}>Who it&apos;s for</dt>
                      <dd className="mt-2 text-paper/75">{tab.bestFor}</dd>
                    </div>
                    <div>
                      <dt className={label}>Time from you</dt>
                      <dd className="mt-2 text-paper/75">{tab.time}</dd>
                    </div>
                  </dl>

                  <p className={`mt-7 ${label}`}>What you get</p>
                  <ul className="mt-3 space-y-3">
                    {tab.points.map((point) => (
                      <li key={point} className="flex gap-3 text-paper/85">
                        <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <Button href={tab.pageHref} variant="secondary" radius="xl" className="mt-8 w-full">
                    {tab.cta}
                    <ArrowRightIcon width={18} height={18} />
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Comparison */}
        <Reveal delay={0.05}>
          <div className="mt-20">
            <h3 className="display-heading text-center text-3xl text-paper sm:text-4xl">{compare.heading}</h3>

            {/* Phones: one soft block per question, the three answers inside. */}
            <div className="mt-8 flex flex-col gap-3 sm:hidden">
              {compare.rows.map((row) => (
                <div key={row.label} className="rounded-2xl bg-white/[0.04] px-5 py-4">
                  <p className={label}>{row.label}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    {row.values.map((value, j) => (
                      <div key={tabs[j].id} className="flex items-baseline justify-between gap-4">
                        <dt className="shrink-0 text-paper/55">{shortName(tabs[j].label)}</dt>
                        <dd className="text-right text-paper">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            {/* Wider screens: a table, rows told apart by soft stripes rather than lines. */}
            <div className="mt-8 hidden overflow-hidden rounded-3xl bg-white/[0.04] sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <td className="px-5 py-4" />
                    {tabs.map((tab) => (
                      <th key={tab.id} scope="col" className="px-4 py-4 font-semibold text-paper">
                        {tab.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare.rows.map((row, r) => (
                    <tr key={row.label} className={r % 2 === 0 ? "bg-white/[0.03]" : ""}>
                      <th scope="row" className="px-5 py-4 align-top font-medium text-paper/55">
                        {row.label}
                      </th>
                      {row.values.map((value, j) => (
                        <td key={tabs[j].id} className="px-4 py-4 align-top text-paper/85">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* Membership + next step */}
        <Reveal delay={0.05}>
          <div className="mt-12 text-center">
            <p className="mx-auto max-w-md text-paper/75">{services.membership}</p>
            <div className="mt-7 flex justify-center">
              <Button href={services.ctaHref} size="lg">
                {services.cta}
                <ArrowRightIcon width={20} height={20} />
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Coverage check */}
        <a
          href={services.areaHref}
          className="glass mt-10 flex min-h-[56px] items-center justify-center gap-3 rounded-2xl px-6 text-paper transition-colors"
        >
          <span className="font-medium">{services.areaCta}</span>
          <ArrowRightIcon width={18} height={18} className="text-paper/70" />
          <MapPinIcon width={22} height={22} className="ml-1" />
        </a>
      </div>
    </section>
  );
}
