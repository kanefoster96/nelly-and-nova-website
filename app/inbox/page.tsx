import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { InboxApp } from "@/components/inbox/InboxApp";
import { ChatBadge } from "@/components/inbox/ChatBadge";
import {
  getConversations,
  getMessages,
  getNotifications,
  getRequests,
  getUnreadCounts,
} from "@/lib/inbox/data";

export const metadata: Metadata = {
  title: "Inbox",
  robots: { index: false, follow: false },
};

export default async function InboxPage() {
  const [conversations, notifications, requests, counts] = await Promise.all([
    getConversations(),
    getNotifications(),
    getRequests(),
    getUnreadCounts(),
  ]);
  const entries = await Promise.all(
    conversations.map(async (c) => [c.id, await getMessages(c.id)] as const)
  );
  const messagesByConversation = Object.fromEntries(entries);

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
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-paper/75">
              <strong className="text-paper">Scaffold</strong> — sample data.
              Wire a backend behind <code>lib/inbox/data.ts</code> and add auth
              before going live (see <code>lib/inbox/schema.sql</code>).
            </div>

            <div className="mt-6">
              <InboxApp
                conversations={conversations}
                messagesByConversation={messagesByConversation}
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
