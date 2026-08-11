"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stepIcons } from "./ui/Icons";
import { howItWorks } from "@/config/site";

// Travelling marker size (px). The card left-padding reserves this lane.
const MARKER = 64;

export function HowItWorks() {
  const steps = howItWorks.steps;

  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [markerTop, setMarkerTop] = useState(0);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Respect prefers-reduced-motion.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Centre the marker vertically on a given card.
  const place = useCallback((idx: number) => {
    const card = cardRefs.current[idx];
    if (card) setMarkerTop(card.offsetTop + card.offsetHeight / 2 - MARKER / 2);
  }, []);

  // Re-place on active change, and again after web fonts settle.
  useEffect(() => {
    place(active);
    const t = setTimeout(() => place(active), 350);
    return () => clearTimeout(t);
  }, [active, place]);

  useEffect(() => {
    const onResize = () => place(active);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, place]);

  // Scroll → active step: a card becomes active when it crosses the centre band.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActive(Number((e.target as HTMLElement).dataset.idx));
          }
        }),
      { rootMargin: "-45% 0px -45% 0px", threshold: 0.01 }
    );
    cardRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // A full turn per step, applied while it slides (both share one transition).
  const spin = active * 360;
  const ActiveIcon = stepIcons[steps[active].icon];

  return (
    <section id="how-it-works" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
          {howItWorks.heading}
        </h2>

        <div className="relative mt-12">
          {/* Travelling marker — moved only via transform, so it never affects layout */}
          {!reduced && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-0 z-10 sm:left-3"
              style={{
                width: MARKER,
                height: MARKER,
                transform: `translateY(${markerTop}px) rotate(${spin}deg)`,
                transition: "transform 650ms cubic-bezier(0.45,0,0.2,1)",
              }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-paper text-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.75)]">
                <ActiveIcon width={28} height={28} />
              </div>
            </div>
          )}

          {/* Steps — left padding reserves the marker's lane */}
          <ol className="space-y-4 pl-24 sm:space-y-5 sm:pl-28">
            {steps.map((step, i) => {
              const Icon = stepIcons[step.icon];
              const isActive = active === i;
              return (
                <li
                  key={step.title}
                  data-idx={i}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className={`relative rounded-3xl border p-6 transition-all duration-300 ${
                    isActive
                      ? "border-white/20 bg-white/[0.06] opacity-100"
                      : "border-transparent bg-white/[0.02] opacity-55"
                  }`}
                >
                  {/* Static per-card icon when motion is reduced */}
                  {reduced && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-16 top-6 flex h-16 w-16 items-center justify-center rounded-full bg-paper text-ink sm:-left-20"
                    >
                      <Icon width={28} height={28} />
                    </span>
                  )}
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold text-paper/50">
                      0{i + 1}
                    </span>
                    <h3 className="text-lg font-bold text-paper sm:text-xl">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-paper/70">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
