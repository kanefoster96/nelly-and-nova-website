"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Messages as a screen rather than a panel (ported from Kanvas Academy).
 *
 * A chat inside a scrolling page means two scrollbars fighting, and on a
 * phone the composer drifts up the screen as you scroll. Every messaging app
 * fills the screen and pins the composer to the bottom, so this does the
 * same — covering the site's nav and footer while it's open, with one cross
 * to come back out. `100dvh` (not `100vh`) keeps the composer above mobile
 * Safari's toolbars.
 */
export function MessagesScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // The page underneath must not scroll while this covers it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function close() {
    // Back where they came from; straight home if they arrived here cold.
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      // A referrer we can't parse is one we shouldn't trust.
    }
    router.push("/");
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink" style={{ height: "100dvh" }}>
      <header
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-paper">{title}</h1>
          {subtitle && <p className="truncate text-xs text-paper-dim">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close messages"
          className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper-dim transition-colors hover:text-paper"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {children}
      </div>
    </div>
  );
}
