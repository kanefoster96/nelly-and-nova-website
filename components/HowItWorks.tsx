"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { stepIcons } from "./ui/Icons";
import { howItWorks } from "@/config/site";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// Distance from a card's top to where the icon sits (matches the card's p-6 padding).
const ICON_INSET = 24;

export function HowItWorks() {
  const steps = howItWorks.steps;
  const reduce = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const ysRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  // Measure each card's icon anchor (top + inset) relative to the container.
  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const top = c.getBoundingClientRect().top;
    ysRef.current = cardRefs.current.map((el) =>
      el ? el.getBoundingClientRect().top - top + ICON_INSET : 0
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    // Re-measure after web fonts settle and on resize.
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Icon Y: piecewise-linear across the measured card anchors.
  const y = useTransform(scrollYProgress, (v) => {
    const ys = ysRef.current;
    const n = ys.length;
    if (n === 0) return 0;
    if (n === 1) return ys[0];
    const cv = clamp(v, 0, 1);
    const seg = 1 / (n - 1);
    const idx = Math.min(n - 2, Math.floor(cv / seg));
    const t = (cv - idx * seg) / seg;
    return ys[idx] + (ys[idx + 1] - ys[idx]) * t;
  });

  // Swap the glyph to match the nearest card.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const n = steps.length;
    setActive(clamp(Math.round(clamp(v, 0, 1) * (n - 1)), 0, n - 1));
  });

  const ActiveIcon = stepIcons[steps[active].icon];

  return (
    <section id="how-it-works" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
          {howItWorks.heading}
        </h2>

        <div ref={containerRef} className="relative mt-12">
          {/* Scroll-driven icon that descends the rail and morphs per card */}
          {!reduce && (
            <motion.div
              style={{ y }}
              aria-hidden="true"
              className="pointer-events-none absolute left-6 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)]"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={active}
                  initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ActiveIcon width={24} height={24} />
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}

          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => {
              const Icon = stepIcons[step.icon];
              return (
                <li
                  key={step.title}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className="relative rounded-3xl bg-white/[0.04] p-6 pl-20 ring-1 ring-white/5 sm:pl-24"
                >
                  {/* Static icon per card when motion is reduced */}
                  {reduce && (
                    <span
                      aria-hidden="true"
                      className="absolute left-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink"
                    >
                      <Icon width={24} height={24} />
                    </span>
                  )}
                  <h3 className="display-heading text-lg text-paper sm:text-xl">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="mt-3 text-paper/70">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
