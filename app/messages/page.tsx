import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ChatCenter } from "@/components/inbox/ChatCenter";
import {
  getConversations,
  getMessages,
  getNotifications,
  getOnboarding,
} from "@/lib/inbox/data";
import { getWeekSchedule } from "@/lib/schedule/data";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const conversations = await getConversations();
  // Scaffold: pretend the signed-in member owns this conversation.
  const mine = conversations[1] ?? conversations[0];
  const [messages, notifications, onboarding, week] = await Promise.all([
    mine ? getMessages(mine.id) : Promise.resolve([]),
    getNotifications(),
    getOnboarding(),
    getWeekSchedule(),
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
            <div className="mt-4 mb-6 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-paper/75">
              <strong className="text-paper">Scaffold</strong> — sample data,
              no live delivery yet. Ready for the chat backend.
            </div>

            <ChatCenter
              conversationId={mine?.id ?? null}
              initialMessages={messages}
              notifications={notifications}
              onboarding={onboarding}
              week={week}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
