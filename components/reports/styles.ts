/**
 * Shared looks for the report card, homework, practice and skills pages —
 * the Kanvas Academy layout (eyebrow, title, muted intro; surface cards with
 * a glass edge; pill buttons; green/red banners) in Nelly & Nova's colours.
 */
export const CARD =
  "rounded-2xl border border-white/10 bg-ink-soft shadow-[inset_0_1px_0_rgba(245,242,234,0.07)]";
export const EYEBROW = "text-sm uppercase tracking-widest text-paper-dim";
export const TITLE = "display-heading mt-1 text-3xl text-paper sm:text-4xl";
export const INTRO = "mt-2 text-paper/75";
export const SECTION = "text-xs font-semibold uppercase tracking-[0.2em] text-paper-dim";
export const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50";
export const QUIET = "glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-paper";
export const INPUT =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
export const OK_BANNER = "rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";
export const ERROR_BANNER = "rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300";
export const PILL = "rounded-full px-2.5 py-0.5 text-xs font-semibold";
export const BACK = "text-sm text-paper-dim transition-colors hover:text-paper";

/** "Tue 4 Nov" from an ISO date or YYYY-MM-DD. */
export function shortDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

/** "4 Nov 2026". */
export function longDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}
