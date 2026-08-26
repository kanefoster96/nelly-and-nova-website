import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { ReportCardsReal } from "@/components/admin/ReportCardsReal";
import { getDraftReportCards } from "@/lib/liveReports/queries";
import { getRealMembers } from "@/lib/admin/realMembers";

export const metadata: Metadata = {
  title: "Report cards",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminReportCardsPage() {
  const [members, drafts] = await Promise.all([getRealMembers(), getDraftReportCards()]);

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
              Report cards
            </h1>
            <p className="mt-3 text-paper/75">
              Real report cards — publishing one pushes the owner a
              notification and unlocks it in their Homework library.
            </p>

            <RequireAdmin>
              <ReportCardsReal members={members} initialDrafts={drafts} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
