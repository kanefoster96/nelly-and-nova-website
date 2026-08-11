"use client";

import { useState } from "react";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";
import { NotificationsList } from "./NotificationsList";
import { RequestsList } from "./RequestsList";
import { sendMessage } from "@/lib/inbox/data";
import type {
  Conversation,
  InboxRequest,
  Message,
  Notification,
} from "@/lib/inbox/types";

type InboxAppProps = {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  notifications: Notification[];
  requests: InboxRequest[];
};

function Panel({
  title,
  count,
  children,
  open,
}: {
  title: string;
  count: number;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="font-semibold text-paper">{title}</span>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-paper">
          {count}
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function InboxApp({
  conversations,
  messagesByConversation,
  notifications,
  requests,
}: InboxAppProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id ?? null
  );
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Notifications" count={notifications.filter((n) => !n.readAt).length}>
          <NotificationsList initial={notifications} />
        </Panel>
        <Panel title="Requests" count={requests.filter((r) => r.status === "pending").length}>
          <RequestsList initial={requests} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="h-[60vh] lg:h-[72vh]">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="h-[70vh] lg:h-[72vh]">
          {selected ? (
            <ChatThread
              key={selected.id}
              conversationId={selected.id}
              headerName={selected.user.name}
              initialMessages={messagesByConversation[selected.id] ?? []}
              viewerIsStaff
              onSend={(body) => sendMessage(selected.id, body, true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl bg-white/[0.03] text-paper-dim ring-1 ring-white/10">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
