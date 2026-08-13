import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { getReportCards } from "@/lib/reports/data";
import { sampleDog } from "@/lib/reports/sample";
import { formatDate } from "@/lib/inbox/format";

export const metadata: Metadata = {
  title: "Recent report cards",
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage() {
  const cards = await getReportCards();

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
              Recent report cards
            </h1>
            <p className="mt-3 text-paper/75">
              The latest cards sent to owners.
            </p>

            <RequireAdmin>
              <ul className="mt-8 space-y-2">
                {cards.map((c) => {
                  const drills = c.homework.flatMap((cat) => cat.drills);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sampleDog.photo} alt="" className="h-full w-full object-cover" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-paper">
                          {sampleDog.name}
                          <span className="text-paper-dim"> · {c.focus}</span>
                        </p>
                        <p className="truncate text-xs text-paper-dim">
                          {formatDate(c.date)} · {c.homework.length} categor{c.homework.length === 1 ? "y" : "ies"} · {drills.length} drills
                          {c.comments.length > 0 && ` · ${c.comments.length} comment${c.comments.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <Link
                        href="/profile/reports"
                        className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40"
                      >
                        View
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
