import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { PaymentsBoard } from "@/components/admin/PaymentsBoard";
import { getWeekSchedule } from "@/lib/schedule/data";

export const metadata: Metadata = {
  title: "Manage payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const week = await getWeekSchedule();
  const todayISO = new Date().toISOString();

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
              Manage payments
            </h1>
            <p className="mt-3 text-paper/75">
              Every payment taken, most recent first. Retry a failed charge, or send
              a full or partial refund.
            </p>

            <RequireAdmin>
              <PaymentsBoard week={week} todayISO={todayISO} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
