import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { UpcomingSessions } from "@/components/profile/UpcomingSessions";
import { getDogProfile } from "@/lib/reports/data";
import { getWeekSchedule } from "@/lib/schedule/data";
import { memberDays } from "@/lib/schedule/sessions";

export const metadata: Metadata = {
  title: "Upcoming sessions",
  robots: { index: false, follow: false },
};

// "Today" is evaluated per request so the session list is current.
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const [profile, week] = await Promise.all([getDogProfile(), getWeekSchedule()]);
  const todayISO = new Date().toISOString();
  const days = memberDays(week);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <Link
              href="/profile"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to profile
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              Upcoming sessions
            </h1>
            <div className="mt-6">
              {profile.plan ? (
                <UpcomingSessions
                  todayISO={todayISO}
                  plan={{
                    dayId: profile.plan.dayId,
                    cadence: profile.plan.cadence,
                    service: profile.plan.service,
                    day: profile.plan.day,
                  }}
                  days={days}
                />
              ) : (
                <p className="rounded-2xl bg-white/[0.04] p-5 text-sm text-paper/70 ring-1 ring-white/10">
                  No training day set yet — we&apos;ll confirm this once you&apos;re
                  onboarded.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
