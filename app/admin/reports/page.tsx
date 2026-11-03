import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { AdminReportCards } from "@/components/reports/AdminReportCards";
import { EYEBROW, TITLE, INTRO, BACK } from "@/components/reports/styles";

export const metadata: Metadata = {
  title: "Report cards",
  robots: { index: false, follow: false },
};

// "Today" (the default session date) per request.
export const dynamic = "force-dynamic";

export default function AdminReportsPage() {
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link href="/admin" className={BACK}>
              ← Trainer dashboard
            </Link>
            <p className={`mt-6 ${EYEBROW}`}>Trainer</p>
            <h1 className={TITLE}>Report cards</h1>
            <p className={INTRO}>
              Write each dog&apos;s card after a session and send it. Their owner gets an email and an app
              notification, and the homework goes on their Homework page to practise on 3 days.
            </p>
            <RequireAdmin>
              <AdminReportCards todayISO={todayISO} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
