import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { AdminChatApp } from "@/components/admin/AdminChatApp";
import { getConversationsForAdmin, getMessages } from "@/lib/liveChat/queries";
import { getRealMembers } from "@/lib/admin/realMembers";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  const [conversations, members] = await Promise.all([getConversationsForAdmin(), getRealMembers()]);

  const entries = await Promise.all(
    conversations.map(async (c) => [c.id, await getMessages(c.id)] as const)
  );
  const messagesByConversation = Object.fromEntries(entries);

  const withConversation = new Set(conversations.map((c) => c.user.id));
  const membersWithoutConversation = members.filter((m) => !withConversation.has(m.accountId));

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-16 pt-28 sm:pt-32">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Link
              href="/admin"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to dashboard
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              Chat
            </h1>
            <p className="mt-3 text-paper/75">
              Real conversations with members — a reply here pushes straight to
              their phone.
            </p>

            <RequireAdmin>
              <div className="mt-6">
                <AdminChatApp
                  conversations={conversations}
                  messagesByConversation={messagesByConversation}
                  membersWithoutConversation={membersWithoutConversation}
                />
              </div>
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
