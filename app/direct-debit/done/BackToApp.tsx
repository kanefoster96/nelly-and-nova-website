"use client";

import { useEffect } from "react";

/** Hands straight back to the app (closing its sign-in sheet), with a button in case that doesn't happen. */
export function BackToApp({ href }: { href: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.assign(href), 400);
    return () => window.clearTimeout(timer);
  }, [href]);
  return (
    <a
      href={href}
      className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
    >
      Go back to the app
    </a>
  );
}
