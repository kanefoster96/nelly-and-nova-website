import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { HomeworkLibrary } from "@/components/admin/HomeworkLibrary";

export const metadata: Metadata = {
  title: "Homework",
  robots: { index: false, follow: false },
};

export default async function HomeworkPage() {
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
              Homework library
            </h1>
            <p className="mt-3 text-paper/75">
              Your drills, organised by pillar → category → level. Open a pillar to
              see its categories, then a category to view and add drills at each
              level.
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
