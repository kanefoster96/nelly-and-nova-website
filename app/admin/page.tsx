import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getDaySchedule, getWeekSchedule } from "@/lib/schedule/data";
import { getOnboarding } from "@/lib/inbox/data";
import { dayIdFromDate, dayLabel } from "@/lib/schedule/types";

export const metadata: Metadata = {
  title: "Trainer dashboard",
  robots: { index: false, follow: false },
};

// "Today" must be evaluated per request, not frozen at build time.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // "Today" is computed on the server so the client renders deterministically.
  const now = new Date();
  const todayId = dayIdFromDate(now);
  const [today, week, customers] = await Promise.all([
    getDaySchedule(todayId),
    getWeekSchedule(),
    getOnboarding(),
  ]);
  const todayISO = now.toISOString();

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <AdminDashboard
              todayLabel={dayLabel(todayId)}
              todayISO={todayISO}
              dogs={today.dogs}
              week={week}
              customers={customers}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
