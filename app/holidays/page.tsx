import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { holidays, CONTACT_HREF } from "@/config/site";

export const metadata: Metadata = {
  title: "Holidays",
  description:
    "Planned closure dates for Nelly & Nova dog training, and how our membership value works.",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Period = { start: string; end: string };

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
function toNum(y: number, m: number, d: number) {
  return y * 10000 + (m + 1) * 100 + d;
}
function daysInclusive(p: Period) {
  const s = parseISO(p.start);
  const e = parseISO(p.end);
  return (
    Math.round(
      (Date.UTC(e.y, e.m, e.d) - Date.UTC(s.y, s.m, s.d)) / 86_400_000
    ) + 1
  );
}
function formatRange(p: Period) {
  const s = parseISO(p.start);
  const e = parseISO(p.end);
  if (s.y === e.y && s.m === e.m)
    return `${s.d}–${e.d} ${MONTHS_SHORT[s.m]} ${s.y}`;
  if (s.y === e.y)
    return `${s.d} ${MONTHS_SHORT[s.m]} – ${e.d} ${MONTHS_SHORT[e.m]} ${s.y}`;
  return `${s.d} ${MONTHS_SHORT[s.m]} ${s.y} – ${e.d} ${MONTHS_SHORT[e.m]} ${e.y}`;
}
function affectedMonths(periods: Period[]) {
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

export default function HolidaysPage() {
  const { value, scheduled } = holidays;
  const periods = scheduled.periods;

  const closedRanges = periods.map((p) => {
    const s = parseISO(p.start);
    const e = parseISO(p.end);
    return [toNum(s.y, s.m, s.d), toNum(e.y, e.m, e.d)] as const;
  });
  const isClosed = (y: number, m: number, d: number) => {
    const n = toNum(y, m, d);
    return closedRanges.some(([a, b]) => n >= a && n <= b);
  };

  function MonthCalendar({ y, m }: { y: number; m: number }) {
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday-first
    const cells: (number | null)[] = [
      ...Array<null>(lead).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return (
      <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/5">
        <p className="display-heading text-lg text-paper">
          {MONTHS[m]} {y}
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-paper-dim">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) =>
            d === null ? (
              <div key={i} />
            ) : (
              <div
                key={i}
                className={`flex h-9 items-center justify-center rounded-full text-sm ${
                  isClosed(y, m, d)
                    ? "bg-paper font-semibold text-ink"
                    : "text-paper/70"
                }`}
              >
                {d}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  const [before, after] = value.savings.text.split(value.savings.highlight);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              {holidays.heading}
            </h1>
            <p className="mt-3 text-sm text-paper-dim">
              Last Updated: {holidays.updated}
            </p>
            <p className="mt-8 text-paper/80">{holidays.intro}</p>
            <div className="mt-8 h-px w-16 bg-white/30" />

            {/* Membership value */}
            <div className="mt-10">
              <h2 className="display-heading text-xl text-paper sm:text-2xl">
                {value.heading}
              </h2>
              <p className="mt-5 font-bold text-paper">{value.lead}</p>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  {value.pricingHeading}
                </p>
                <dl className="mt-3">
                  {value.pricing.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2"
                    >
                      <dt className="text-paper/80">{row.label}</dt>
                      <dd className="font-semibold text-paper">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="mt-6 text-paper/80">
                {before}
                <span className="font-semibold text-paper underline decoration-white/40 underline-offset-4">
                  {value.savings.highlight}
                </span>
                {after}
              </p>

              <div className="mt-6 space-y-4 text-paper/80">
                {value.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>

            {/* Scheduled holidays */}
            <div className="mt-14">
              <h2 className="display-heading text-xl text-paper sm:text-2xl">
                {scheduled.heading}
              </h2>
              <p className="mt-2 text-paper-dim">{scheduled.year}</p>

              {/* Prominent date cards */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {periods.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/10"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                      Closed
                    </p>
                    <p className="display-heading mt-3 text-2xl text-paper sm:text-3xl">
                      {formatRange(p)}
                    </p>
                    <p className="mt-3 text-sm text-paper-dim">
                      {daysInclusive(p)} days · no sessions or collections
                    </p>
                  </div>
                ))}
              </div>

              {/* Calendars */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {affectedMonths(periods).map((mm, i) => (
                  <MonthCalendar key={i} y={mm.y} m={mm.m} />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-paper-dim">
                <span className="inline-block h-4 w-4 rounded-full bg-paper" />
                Unavailable
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12">
              <Button href={CONTACT_HREF} variant="secondary" radius="xl">
                Questions about dates? Contact us
                <ArrowRightIcon width={18} height={18} />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
