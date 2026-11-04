import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { config } from "@/lib/config";

/*
 * A link to one of our own website's pages, tapped in the app (a link in a
 * trainer's chat message, the guidelines on a post): opens the app's own
 * screen for that page where there is one, and the in-app browser
 * otherwise — other sites, files, and the pages that only the website can
 * do (downloading your data). The join link, the consent & waiver and the
 * owner's account pages have app versions now (OWNERS).
 */

const HOSTS = new Set(
  [
    (() => {
      try {
        return new URL(config.siteUrl).host;
      } catch {
        return "";
      }
    })(),
    "nellyandnova.co.uk",
    "www.nellyandnova.co.uk",
    "nelly-and-nova-website.vercel.app",
  ].filter(Boolean),
);

/** Website page → app screen, for everyone. */
const EVERYONE: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/community-guidelines$/, () => "/guidelines"],
  [/^\/community$/, () => "/community"],
  [/^\/(messages|inbox)$/, () => "/chat"],
  [/^\/profile\/(reports|practice)$/, () => "/homework"],
  [/^\/profile\/sessions$/, () => "/schedule"],
  [/^\/profile$/, () => "/dog"],
];

/** An owner's set-up and account pages → the app's own (the checklist, the register form, My Info, a dog's record). */
const OWNERS: [RegExp, (m: RegExpMatchArray, url: URL) => string][] = [
  [/^\/join\/[^/]+$/, () => "/dog"],
  [/^\/waiver$/, (_m, url) => (/^[0-9a-f-]{36}$/i.test(url.searchParams.get("dog") ?? "") ? `/register/${url.searchParams.get("dog")}` : "/register")],
  [/^\/profile\/account\/edit$/, () => "/my-info"],
  [/^\/profile\/dogs\/new$/, () => "/my-dogs/new"],
  [/^\/profile\/dogs\/([0-9a-f-]{36})$/i, (m) => `/my-dogs/${m[1]}`],
];

/** The trainer's pages (/admin/…) → the trainer's screens. */
const TRAINERS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/admin\/dogs\/([0-9a-f-]{36})$/i, (m) => `/dog/${m[1]}`],
  [/^\/admin\/onboarding$/, () => "/onboarding"],
  [/^\/admin\/requests$/, () => "/requests"],
  [/^\/admin\/schedule$/, () => "/calendar"],
  [/^\/admin\/homework$/, () => "/library"],
  [/^\/admin\/team$/, () => "/team"],
  [/^\/admin\/notifications\/new$/, () => "/send-notification"],
  [/^\/admin$/, () => "/today"],
];

/** The app screen for a link, or null when it belongs in the browser. */
export function appRouteFor(href: string, isTrainer: boolean): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !HOSTS.has(url.host)) return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!isTrainer) {
    for (const [re, to] of OWNERS) {
      const m = path.match(re);
      if (m) return to(m, url);
    }
  }
  for (const [re, to] of isTrainer ? [...TRAINERS, ...EVERYONE] : EVERYONE) {
    const m = path.match(re);
    if (m) return to(m);
  }
  return null;
}

export function openLink(href: string, isTrainer: boolean): void {
  const route = appRouteFor(href, isTrainer);
  if (route) router.push(route as never);
  else void WebBrowser.openBrowserAsync(href);
}
