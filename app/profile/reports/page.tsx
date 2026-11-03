import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ReportCards } from "@/components/ReportCards";
import { EYEBROW, TITLE, INTRO, BACK } from "@/components/reports/styles";

export const metadata: Metadata = {
  title: "Report cards",
  robots: { index: false, follow: false },
};

export default function ReportCardsPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <Link href="/profile" className={BACK}>
              ← Back to profile
            </Link>
            <p className={`mt-6 ${EYEBROW}`}>Training</p>
            <h1 className={TITLE}>Report cards</h1>
            <p className={INTRO}>
              After each session, here&apos;s what your dog worked on and their homework. Practise it on 3
              separate days, and ask us anything.
            </p>
            <div className="mt-8">
              <ReportCards />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
