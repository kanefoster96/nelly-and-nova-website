"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/Button";
import { PlusIcon, MinusIcon, HelpCircleIcon } from "./ui/Icons";
import { faq, CONTACT_HREF } from "@/config/site";

export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const reduce = useReducedMotion();

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section id="faq" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
          {faq.heading}
        </h2>

        <div className="mt-10 overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/5">
          {faq.items.map((item, i) => {
            const isOpen = open.has(i);
            const panelId = `faq-panel-${i}`;
            const btnId = `faq-btn-${i}`;
            return (
              <div
                key={item.q}
                className={i > 0 ? "border-t border-white/10" : undefined}
              >
                <h3>
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-medium text-paper sm:text-lg">
                      {item.q}
                    </span>
                    <span className="shrink-0 text-paper/80">
                      {isOpen ? (
                        <MinusIcon width={24} height={24} />
                      ) : (
                        <PlusIcon width={24} height={24} />
                      )}
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      id={panelId}
                      role="region"
                      aria-labelledby={btnId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: reduce ? 0 : 0.3,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 px-6 pb-6 text-paper/70">
                        {item.a.map((para, j) => (
                          <p key={j}>{para}</p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Button href={CONTACT_HREF} variant="secondary" size="lg" radius="xl">
            {faq.cta}
            <HelpCircleIcon width={22} height={22} />
          </Button>
        </div>
      </div>
    </section>
  );
}
