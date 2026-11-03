import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { HomeworkLibrary } from "@/components/admin/HomeworkLibrary";
import { EYEBROW, TITLE, INTRO, BACK } from "@/components/reports/styles";

export const metadata: Metadata = {
  title: "Drill library",
  robots: { index: false, follow: false },
};

export default async function HomeworkPage() {
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
            <h1 className={TITLE}>Drill library</h1>
            <p className={INTRO}>
              The drills report-card homework is picked from, by pillar, category and level. Open a
              drill to build its how-to page; owners open it from their homework.
            </p>

            <RequireAdmin>
              <HomeworkLibrary />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
