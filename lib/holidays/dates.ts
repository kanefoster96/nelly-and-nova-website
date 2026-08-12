/**
 * Pure date helpers for holidays — no React, no schedule imports, so both the
 * public holidays page (server) and the admin/store code (client) share exactly
 * the same range maths. Dates are inclusive ISO strings (YYYY-MM-DD).
 */
export type Period = { start: string; end: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** A sortable/comparable integer for an ISO date (yyyymmdd). */
export function isoToNum(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return y * 10000 + (m + 1) * 100 + d;
}

export function yearOf(iso: string): number {
  return parseISO(iso).y;
}

/** Is `iso` within [start, end] inclusive? */
export function rangeCoversISO(start: string, end: string, iso: string): boolean {
  const n = isoToNum(iso);
  return n >= isoToNum(start) && n <= isoToNum(end);
}

export function daysInclusive(p: Period): number {
  const s = parseISO(p.start);
  const e = parseISO(p.end);
  return Math.round((Date.UTC(e.y, e.m, e.d) - Date.UTC(s.y, s.m, s.d)) / 86_400_000) + 1;
}

/** Shift an ISO date by `n` days (n may be negative). */
export function addDaysISO(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m, d + n)).toISOString().slice(0, 10);
}

/** "2–9 Mar 2026" / "28 Feb – 3 Mar 2026" / cross-year. */
export function formatRange(p: Period): string {
  const s = parseISO(p.start);
  const e = parseISO(p.end);
  if (s.y === e.y && s.m === e.m) return `${s.d}–${e.d} ${MONTHS_SHORT[s.m]} ${s.y}`;
  if (s.y === e.y) return `${s.d} ${MONTHS_SHORT[s.m]} – ${e.d} ${MONTHS_SHORT[e.m]} ${s.y}`;
  return `${s.d} ${MONTHS_SHORT[s.m]} ${s.y} – ${e.d} ${MONTHS_SHORT[e.m]} ${e.y}`;
}

/** Full-month label, e.g. "March 2026". */
export function monthLabel(y: number, m: number): string {
  return `${MONTHS[m]} ${y}`;
}

/** The {y, m} months any of the periods touch, sorted. */
export function affectedMonths(periods: Period[]): { y: number; m: number }[] {
  const set = new Set<number>();
  for (const p of periods) {
    const s = parseISO(p.start);
    const e = parseISO(p.end);
    let y = s.y;
    let m = s.m;
    while (y < e.y || (y === e.y && m <= e.m)) {
      set.add(y * 100 + m);
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }
  return [...set].sort((a, b) => a - b).map((v) => ({ y: Math.floor(v / 100), m: v % 100 }));
}
