"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesScreen } from "./MessagesScreen";
import { PageTabs } from "./PageTabs";
import { ChatThread } from "./ChatThread";
import { TeamInbox } from "./TeamInbox";
import { NotificationsList } from "@/components/inbox/NotificationsList";
import { OnboardingList } from "@/components/inbox/OnboardingList";
import { RescheduleRequests } from "@/components/inbox/RescheduleRequests";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { contact, site } from "@/config/site";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import { chatSupabase, getMyConversationId, getUnreadChatCount } from "@/lib/chat/client";
import { listRequests } from "@/lib/sessions/client";
import type { Notification } from "@/lib/inbox/types";
import type { OnboardingEntry } from "@/lib/inbox/onboarding";
import type { DaySchedule } from "@/lib/schedule/types";

/**
 * The chat page, ported from Kanvas Academy's /messages and reworded for dog
 * owners:
 *   - Owners: Live Chat with the team + Notifications, as one full screen.
 *   - Trainers: the inbox of every owner's chat, plus Requests and Onboarding.
 *   - Logged out: log in to chat, or message us on WhatsApp.
 */
export function MessagesApp({
  notifications,
  onboarding,
  week,
}: {
  notifications: Notification[];
  onboarding: OnboardingEntry[];
  week: DaySchedule[];
}) {
  const status = useAuthStatus();
  const session = useSession();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authed") return;
    chatSupabase()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, [status]);

  if (status === "anon") return <SignedOut />;
  if (status === "loading" || !session || !userId) {
    return (
      <MessagesScreen title={site.name}>
        <p className="mt-10 text-center text-sm text-paper-dim">Loading…</p>
      </MessagesScreen>
    );
  }

  if (session.role === "admin") {
    return (
      <TrainerMessages
        userId={userId}
        name={session.ownerName || site.name}
        onboarding={onboarding}
        week={week}
      />
    );
  }

  return (
    <OwnerMessages
      userId={userId}
      name={session.ownerName || "Owner"}
      notifications={notifications}
    />
  );
}

function OwnerMessages({
  userId,
  name,
  notifications,
}: {
  userId: string;
  name: string;
  notifications: Notification[];
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // The badge is what was waiting when they arrived; opening the chat reads it.
    getUnreadChatCount().then(setUnread).catch(() => {});
    getMyConversationId()
      .then(setConversationId)
      .catch(() => setError(true));
  }, []);

  const chatPanel = error ? (
    <div className="flex flex-1 items-center justify-center px-6 text-center">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-paper">Chat is temporarily unavailable</h2>
        <p className="mt-2 text-paper-dim">Please try again shortly.</p>
      </div>
    </div>
  ) : conversationId ? (
    <ChatThread
      conversationId={conversationId}
      viewerId={userId}
      viewerRole="member"
      presenceName={name}
      emptyLabel="Send us a message about your dog and the team will get back to you here."
    />
  ) : (
    <p className="mt-10 text-center text-sm text-paper-dim">Connecting…</p>
  );

  return (
    <MessagesScreen title={site.name}>
      <PageTabs
        defaultTab="chat"
        railClassName="mx-4 mt-3"
        tabs={[
          { key: "chat", label: "Live Chat", count: unread },
          { key: "notifications", label: "Notifications", count: notifications.filter((n) => !n.readAt).length },
        ]}
        panels={{
          // The chat runs edge to edge with its own padding and scroll.
          chat: chatPanel,
          notifications: (
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <NotificationsList initial={notifications} />
            </div>
          ),
        }}
      />
    </MessagesScreen>
  );
}

function TrainerMessages({
  userId,
  name,
  onboarding,
  week,
}: {
  userId: string;
  name: string;
  onboarding: OnboardingEntry[];
  week: DaySchedule[];
}) {
  // Waiting on the team: new requests (an owner's reply to a suggestion comes back as pending too).
  const [pendingReschedules, setPendingReschedules] = useState(0);
  useEffect(() => {
    listRequests()
      .then((rs) => setPendingReschedules(rs.filter((r) => r.status === "pending").length))
      .catch(() => setPendingReschedules(0));
  }, []);

  return (
    <MessagesScreen title={site.name} subtitle="Team inbox">
      <PageTabs
        defaultTab="chat"
        railClassName="mx-4 mt-3"
        tabs={[
          { key: "chat", label: "Live Chat" },
          { key: "requests", label: "Requests", count: pendingReschedules },
          { key: "onboarding", label: "Onboarding" },
        ]}
        panels={{
          chat: <TeamInbox viewerId={userId} viewerName={name} />,
          requests: (
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <RescheduleRequests week={week} />
            </div>
          ),
          onboarding: (
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <OnboardingList initial={onboarding} onOpenChat={() => {}} />
            </div>
          ),
        }}
      />
    </MessagesScreen>
  );
}

function SignedOut() {
  return (
    <MessagesScreen title={`Chat with ${site.name}`}>
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <p className="text-paper-dim">
          Got a question about your dog? Log in and send us a message — the team will reply here.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="flex min-h-[48px] items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
          >
            Log in to chat
          </Link>
          <a
            href={contact.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="glass flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon width={22} height={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-paper">Not a member yet?</span>
              <span className="block text-sm text-paper-dim">Message us on WhatsApp instead</span>
            </span>
            <span className="ml-auto text-paper-dim">→</span>
          </a>
          <Link
            href="/book"
            className="glass flex min-h-[48px] items-center justify-center rounded-full px-5 text-sm font-semibold text-paper"
          >
            Book a meet &amp; greet
          </Link>
        </div>
      </div>
    </MessagesScreen>
  );
}
