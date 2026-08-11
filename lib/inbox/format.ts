const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Deterministic, locale-free timestamp — "11 Aug · 13:48" (UTC).
 * Avoids "x minutes ago" so server and client render identically (no
 * hydration mismatch). Swap for a relative formatter on the client if desired.
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = MONTHS[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} · ${hh}:${mm}`;
}
