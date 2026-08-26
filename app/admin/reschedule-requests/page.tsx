import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { RescheduleRequestsReal } from "@/components/admin/RescheduleRequestsReal";
import { getPendingReschedules } from "@/lib/liveReschedule/queries";

export const metadata: Metadata = {
  title: "Reschedule requests",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RescheduleRequestsPage() {
  const requests = await getPendingReschedules();

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link
              href="/admin"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to dashboard
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              Reschedule requests
            </h1>
            <p className="mt-3 text-paper/75">
              Real requests submitted from the app. Approving pushes the member
              a notification straight away.
            </p>

            <RequireAdmin>
              <RescheduleRequestsReal initial={requests} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
