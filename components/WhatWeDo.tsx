"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/Button";
import { CheckIcon, ArrowRightIcon, MapPinIcon } from "./ui/Icons";
import { media } from "@/config/media";
import { services, CONTACT_HREF } from "@/config/site";

// Black at the top and bottom, fading to reveal the photo through the middle.
const GRADIENT =
  "linear-gradient(to bottom, #0a0a0a 0%, rgba(10,10,10,0.85) 10%, rgba(10,10,10,0.45) 26%, rgba(10,10,10,0.45) 68%, rgba(10,10,10,0.88) 88%, #0a0a0a 100%)";

export function WhatWeDo() {
  const [activeId, setActiveId] = useState(services.tabs[0].id);
  const reduce = useReducedMotion();
  const active = services.tabs.find((t) => t.id === activeId) ?? services.tabs[0];

  return (
    <section id="services" className="relative isolate overflow-hidden bg-ink">
      {/* Background photo + gradient (fades from the black background into the picture) */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <Image
          src={media.services.background}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: GRADIENT }} />
      </div>

      <div className="mx-auto max-w-xl px-4 py-20 sm:py-28">
        <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
          {services.heading}
        </h2>

        {/* Card */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-md sm:p-8">
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Services"
            className="grid grid-cols-2"
          >
            {services.tabs.map((tab) => {
              const isActive = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(tab.id)}
                  className={`relative min-h-[44px] pb-3 text-center text-lg font-semibold transition-colors ${
                    isActive ? "text-paper" : "text-paper/45 hover:text-paper/70"
                  }`}
                >
                  {tab.label}
                  {/* Faint baseline under every tab */}
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15" />
                  {/* Animated active underline */}
                  {isActive && (
                    <motion.span
                      layoutId="service-underline"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-paper"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 500, damping: 40 }
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              role="tabpanel"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pt-8"
            >
              <p className="text-center text-sm font-medium uppercase tracking-[0.15em] text-paper/70">
                {active.subtitle}
              </p>

              <ul className="mt-6 space-y-4">
                {active.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-paper">
                    <CheckIcon
                      width={22}
                      height={22}
                      className="mt-0.5 shrink-0 text-paper"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button href={active.ctaHref} radius="xl" size="lg">
                  {active.cta}
                </Button>
                <Button href={CONTACT_HREF} variant="ghost">
                  Contact us
                  <ArrowRightIcon width={18} height={18} />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Coverage check */}
        <a
          href={services.areaHref}
          className="mt-5 flex min-h-[56px] items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black/30 px-6 text-paper backdrop-blur-md transition-colors hover:border-white/35"
        >
          <span className="font-medium">{services.areaCta}</span>
          <ArrowRightIcon width={18} height={18} className="text-paper/70" />
          <MapPinIcon width={22} height={22} className="ml-1" />
        </a>
      </div>
    </section>
  );
}
