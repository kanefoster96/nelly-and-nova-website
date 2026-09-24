import { config } from "./config";

/** Sample data uses site-relative paths ("/placeholders/…"); resolve them against the website. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^(https?:|data:)/.test(path) ? path : new URL(path, config.siteUrl).toString();
}
