"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MenuIcon, CloseIcon, MessageIcon, UserIcon } from "./ui/Icons";
import { navLinks, site } from "@/config/site";
import { media } from "@/config/media";
import { useSession, accountAvatar } from "@/lib/auth/session";
import { useUnseenReportCount } from "@/lib/reports/seen";

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();
  const session = useSession();
  const unseenReports = useUnseenReportCount();

  // Solidify the bar once the hero has begun to scroll away.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on Escape, and lock body scroll while the menu is open.
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
        {/* Monogram — top left */}
        <Link href="/" aria-label={`${site.name} — home`} className="shrink-0">
          <Image
            src={media.logo.monogram}
            alt={`${site.name} logo`}
            width={52}
            height={36}
            priority
            style={{ height: 30, width: "auto" }}
          />
        </Link>

        {/* Chat + account + hamburger — top right */}
        <div className="flex items-center gap-2">
          <Link
            href="/messages"
            aria-label="Chat with us"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-white/20 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MessageIcon width={22} height={22} />
          </Link>

          {/* Account — admins go to the trainer dashboard; members to their dog's
              profile. Signed out shows "Log in". */}
          {session ? (
            session.role === "admin" ? (
              <Link
                href="/admin"
                aria-label="Trainer dashboard"
                className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.dogPhoto}
                  alt="Trainer dashboard"
                  className="h-full w-full object-contain"
                />
              </Link>
            ) : (
              <Link
                href="/profile"
                aria-label={
                  unseenReports > 0
                    ? `${session.dogName}'s profile — ${unseenReports} new report card${unseenReports > 1 ? "s" : ""}`
                    : `${session.dogName}'s profile`
                }
                className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={accountAvatar(session)}
                  alt={`${session.dogName}`}
                  className="h-full w-full object-cover"
                />
                {unseenReports > 0 && (
                  <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-ink bg-red-500" />
                )}
              </Link>
            )
          ) : (
            <Link
              href="/login"
              aria-label="Log in"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-paper transition-colors hover:bg-white/20 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <UserIcon width={18} height={18} />
              Log in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-paper transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* Menu panel — populated from navLinks as sections are built */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="menu"
            key="menu"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-5 pt-1 sm:px-6">
              {navLinks.length === 0 ? (
                <li className="px-4 py-3 text-sm text-paper-dim">
                  Menu items appear here as pages are added.
                </li>
              ) : (
                navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[52px] items-center rounded-xl px-4 text-lg font-semibold text-paper transition-colors hover:bg-white/5 hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
