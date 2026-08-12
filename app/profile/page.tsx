import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProfileView } from "@/components/ProfileView";
import { getDogProfile } from "@/lib/reports/data";
import { getSessionWeather } from "@/lib/weather/data";
import { dayIdFromISO, nextDateForDay, formatSessionDate } from "@/lib/schedule/sessions";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getDogProfile();

  // Weather for their next/today's session → coat reminder if wet.
  let weather = null;
  let sessionLabel = "";
  if (profile.plan) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const isTodaySession = dayIdFromISO(todayISO) === profile.plan.dayId;
    const sessionDate = isTodaySession ? todayISO : nextDateForDay(todayISO, profile.plan.dayId);
    weather = await getSessionWeather(sessionDate);
    sessionLabel = isTodaySession ? "today's session" : `${formatSessionDate(sessionDate)}`;
  }

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <ProfileView profile={profile} weather={weather} sessionLabel={sessionLabel} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
