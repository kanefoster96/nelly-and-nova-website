"use client";

import { CONSENT_COOKIE_NAME } from "@/lib/cookie-consent";

/** Lets a visitor change their cookie choice as easily as they gave it — clears it and reloads, which shows the banner again. */
export function CookieSettingsButton() {
  function handleClick() {
    document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    window.location.reload();
  }

  return (
    <button type="button" onClick={handleClick} className="text-left transition-colors hover:text-accent">
      Cookie Settings
    </button>
  );
}
