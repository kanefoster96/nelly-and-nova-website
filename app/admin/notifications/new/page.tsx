import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { NotificationComposer } from "@/components/admin/NotificationComposer";

export const metadata: Metadata = {
  title: "Send a notification",
  robots: { index: false, follow: false },
};

/** Trainer: tell every owner, or the ones you choose, on the app and their Notifications. */
export default function NewNotificationPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link href="/admin" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to dashboard
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Trainer</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Send a notification</h1>
            <p className="mt-3 text-paper/75">
              It pops up on their phone if they have the app, and waits on their Notifications either way.
            </p>
            <RequireAdmin>
              <NotificationComposer />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
