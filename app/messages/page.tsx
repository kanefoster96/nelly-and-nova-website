import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { MemberChat } from "@/components/inbox/MemberChat";
import { NotificationsList } from "@/components/inbox/NotificationsList";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { contact } from "@/config/site";
import { getConversations, getMessages, getNotifications } from "@/lib/inbox/data";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const conversations = await getConversations();
  // Scaffold: pretend the signed-in member owns this conversation.
  const mine = conversations[1] ?? conversations[0];
  const [messages, notifications] = await Promise.all([
    mine ? getMessages(mine.id) : Promise.resolve([]),
    getNotifications(),
  ]);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h1 className="display-heading text-3xl text-paper sm:text-4xl">
              Messages
            </h1>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-paper/75">
              <strong className="text-paper">Scaffold</strong> — sample data,
              no live delivery yet. Ready for the chat backend.
            </div>

            {/* Prefer WhatsApp? For visitors on the website rather than the app. */}
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/35"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                <WhatsAppIcon width={22} height={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-paper">
                  Prefer WhatsApp?
                </span>
                <span className="block text-sm text-paper-dim">
                  Message us on WhatsApp instead
                </span>
              </span>
              <span className="ml-auto text-paper-dim">→</span>
            </a>

            {mine && (
              <div className="mt-4 h-[62vh]">
                <MemberChat conversationId={mine.id} initialMessages={messages} />
              </div>
            )}

            <h2 className="display-heading mt-12 text-2xl text-paper">
              Notifications
            </h2>
            <div className="mt-4">
              <NotificationsList initial={notifications} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
