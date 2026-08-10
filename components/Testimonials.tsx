"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./ui/Reveal";
import { ArrowRightIcon } from "./ui/Icons";
import { media } from "@/config/media";

// Placeholder reviews — swap for real testimonials later.
const TESTIMONIALS = [
  {
    quote:
      "The change in our spaniel after Walk & Train was unreal. Calmer at home, brilliant recall, and we finally understand how to keep it up. The report cards are gold.",
    name: "Placeholder Reviewer",
    detail: "Owner of a Cocker Spaniel · Tynemouth",
    avatar: media.avatars[0],
  },
  {
    quote:
      "Charlotte gets dogs. Our adolescent rescue went from pulling and lunging to walking beautifully on a loose lead. Genuinely life-changing for our walks.",
    name: "Placeholder Reviewer",
    detail: "Owner of a Rescue Lurcher · Whitley Bay",
    avatar: media.avatars[1],
  },
  {
    quote:
      "The 1-1 sessions gave me the confidence to actually train my puppy properly. Clear, kind and no nonsense. Couldn't recommend Nelly & Nova more.",
    name: "Placeholder Reviewer",
    detail: "Owner of a Labrador puppy · Cramlington",
    avatar: media.avatars[2],
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const reduce = useReducedMotion();
  const count = TESTIMONIALS.length;

  const go = (dir: number) => {
    setDirection(dir);
    setIndex((i) => (i + dir + count) % count);
  };
  const goTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
  };

  const active = TESTIMONIALS[index];

  return (
    <section id="testimonials" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            Happy owners
          </p>
          <h2 className="display-heading text-4xl text-paper sm:text-5xl">
            What owners say
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="relative mt-12">
            <div
              className="relative overflow-hidden rounded-3xl bg-ink-raised px-6 py-10 ring-1 ring-white/10 sm:px-12 sm:py-12"
              aria-roledescription="carousel"
              aria-label="Owner testimonials"
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.blockquote
                  key={index}
                  custom={direction}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction >= 0 ? 40 : -40 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction >= 0 ? -40 : 40 }
                  }
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  drag={reduce ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) go(1);
                    else if (info.offset.x > 60) go(-1);
                  }}
                  aria-live="polite"
                >
                  <span
                    aria-hidden="true"
                    className="mb-4 block font-display text-6xl leading-none text-accent/60"
                  >
                    &ldquo;
                  </span>
                  <p className="text-xl leading-relaxed text-paper sm:text-2xl">
                    {active.quote}
                  </p>
                  <footer className="mt-8 flex items-center gap-4">
                    <span className="relative h-12 w-12 overflow-hidden rounded-full ring-1 ring-white/15">
                      <Image
                        src={active.avatar}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>
                    <span>
                      <span className="block font-semibold text-paper">
                        {active.name}
                      </span>
                      <span className="block text-sm text-paper-dim">
                        {active.detail}
                      </span>
                    </span>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2" role="tablist" aria-label="Choose testimonial">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show testimonial ${i + 1} of ${count}`}
                    onClick={() => goTo(i)}
                    className={`h-2.5 rounded-full transition-all ${
                      i === index
                        ? "w-7 bg-accent"
                        : "w-2.5 bg-white/25 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous testimonial"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-white/20 text-paper transition-colors hover:text-accent hover:ring-accent/60"
                >
                  <ArrowRightIcon width={20} height={20} className="rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next testimonial"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-white/20 text-paper transition-colors hover:text-accent hover:ring-accent/60"
                >
                  <ArrowRightIcon width={20} height={20} />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
