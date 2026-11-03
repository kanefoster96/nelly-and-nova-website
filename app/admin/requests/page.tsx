import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { RescheduleRequests } from "@/components/inbox/RescheduleRequests";
import { EYEBROW, TITLE, INTRO, BACK } from "@/components/reports/styles";

export const metadata: Metadata = {
  title: "Session requests",
  robots: { index: false, follow: false },
};

export default function AdminRequestsPage() {
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
            <h1 className={TITLE}>Session requests</h1>
            <p className={INTRO}>
              What owners have asked for: replacement days, extra sessions, new or switched regular days. Accept it, suggest
              other dates, or decline. The owner is told straight away, in the app and in their chat. Cancellations don&apos;t
              need you: they come off the calendar by themselves.
            </p>
            <div className="mt-8">
              <RequireAdmin>
                <RescheduleRequests />
              </RequireAdmin>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
