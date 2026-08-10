"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/Button";
import { Wordmark } from "./ui/Wordmark";
import { MenuIcon, CloseIcon } from "./ui/Icons";
import { navLinks, BOOKING_HREF } from "@/config/site";

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();
  const hasLinks = navLinks.length > 0;

  // Solidify the bar once the hero has begun to scroll away.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on Escape, and lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "bg-ink/90 backdrop-blur-md border-b border-white/10"
          : "bg-gradient-to-b from-black/60 to-transparent"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Wordmark href="#top" height={34} priority className="shrink-0" />

        {/* Desktop links — shown once menu items exist in config/site.ts */}
        {hasLinks && (
          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium text-paper/85 transition-colors hover:text-accent focus-visible:text-accent"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <Button href={BOOKING_HREF} size="md">
            Book Now
          </Button>

          {/* Mobile menu toggle — only when there are menu items */}
          {hasLinks && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-paper transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {open && hasLinks && (
          <motion.div
            id="mobile-menu"
            key="mobile-menu"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden"
          >
            <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-5 pt-1 sm:px-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[52px] items-center rounded-xl px-4 text-lg font-semibold text-paper transition-colors hover:bg-white/5 hover:text-accent"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <Button
                  href={BOOKING_HREF}
                  size="lg"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Book Now
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
