import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ReportCards } from "@/components/ReportCards";
import { getReportCards } from "@/lib/reports/data";

export const metadata: Metadata = {
  title: "Report cards",
  robots: { index: false, follow: false },
};

export default async function ReportCardsPage() {
  const cards = await getReportCards();
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
              Report cards
            </h1>
            <p className="mt-3 text-paper/75">
              After each session, here&apos;s what your dog worked on and their
              homework. Tick homework off as you go, and ask us anything.
            </p>
            <div className="mt-8">
              <ReportCards initial={cards} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
