import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { InboxApp } from "@/components/inbox/InboxApp";
import { ChatBadge } from "@/components/inbox/ChatBadge";
import { getNotifications, getRequests, getUnreadCounts } from "@/lib/inbox/data";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default async function InboxPage() {
  const [notifications, requests] = await Promise.all([getNotifications(), getRequests()]);
  const counts = await getUnreadCounts(notifications);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-16 pt-28 sm:pt-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <h1 className="display-heading text-3xl text-paper sm:text-4xl">
                Inbox
              </h1>
              <ChatBadge counts={counts} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-paper/75">
              <span className="min-w-0 flex-1">
                <strong className="text-paper">Live chat and notifications are connected.</strong>{" "}
                Requests below are still sample data.
              </span>
              <Link
                href="/admin/notifications/new"
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                Send a notification
              </Link>
            </div>

            <div className="mt-6">
              <InboxApp
                notifications={notifications}
                requests={requests}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
