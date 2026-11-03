import { config } from "@/lib/config";

/**
 * Every link that opens the app passes through here first (expo-router's
 * +native-intent). The "Set up my account" / "Reset my password" email's
 * button — https://<site>/app-setup?e=…&t=…&a=… as a Universal Link, or
 * nellyandnova://app-setup?… from the website's /app-setup page — becomes
 * the "Create a password" screen with its one-use ticket. Everything else
 * passes through untouched. Never throws: the app would fail to open.
 */
const SITE_HOST = (() => {
  try {
    return new URL(config.siteUrl).host;
  } catch {
    return "";
  }
})();
const KNOWN_HOSTS = new Set([SITE_HOST, "nellyandnova.co.uk", "www.nellyandnova.co.uk", "nelly-and-nova-website.vercel.app"]);

function readParams(query: string): URLSearchParams {
  return new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
}

export function redirectSystemPath({ path }: { path: string | null; initial: boolean }): string | null {
  if (!path) return path;
  try {
    let pathname = "";
    let query = "";
    const schemeMatch = path.match(/^nellyandnova:\/\/([^?]*)(\?.*)?$/);
    const webMatch = path.match(/^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/);
    if (schemeMatch) {
      pathname = `/${schemeMatch[1]}`;
      query = schemeMatch[2] ?? "";
    } else if (webMatch && KNOWN_HOSTS.has(webMatch[1])) {
      pathname = webMatch[2] || "/";
      query = webMatch[3] ?? "";
    } else if (path.startsWith("/")) {
      const i = path.indexOf("?");
      pathname = i === -1 ? path : path.slice(0, i);
      query = i === -1 ? "" : path.slice(i);
    } else {
      return path;
    }
    if (pathname.replace(/\/$/, "") === "/app-setup") {
      const q = readParams(query);
      const next = new URLSearchParams({ email: q.get("e") ?? "", ticket: q.get("t") ?? "", account: q.get("a") ?? "" });
      return `/create-password?${next.toString()}`;
    }
    return path;
  } catch {
    return "/";
  }
}
