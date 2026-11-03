import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { TeamManager } from "@/components/admin/TeamManager";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

/** The trainers: display names, photos, adding and removing (trainers only). */
export default function TeamPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link href="/admin" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to dashboard
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">Team.</h1>
            <p className="mt-3 text-paper/75">
              Display names and photos show on your chat messages, community posts (with the official tick) and in the app.
            </p>
            <RequireAdmin>
              <TeamManager />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
