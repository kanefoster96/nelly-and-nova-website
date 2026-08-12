"use client";

import { useEffect, useRef, useState } from "react";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";
import { NotificationsList } from "./NotificationsList";
import { RequestsList } from "./RequestsList";
import { RequestDetail } from "./RequestDetail";
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
    <details open={open} className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
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
  conversations: initialConversations,
  messagesByConversation: initialMessages,
  notifications,
  requests: initialRequests,
}: InboxAppProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messagesByConversation, setMessagesByConversation] = useState(initialMessages);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  // Deep-link: /inbox?name=<owner> opens (or starts) that customer's chat.
  // Runs once on the client after mount, so SSR still renders the default.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current) return;
    deepLinkedRef.current = true;
    const name = new URLSearchParams(window.location.search).get("name");
    if (!name) return;
    const existing = conversations.find(
      (c) => c.user.name.toLowerCase() === name.toLowerCase()
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const conv: Conversation = {
      id: `dm-${name.toLowerCase().replace(/\s+/g, "-")}`,
      user: { id: `u-${name.toLowerCase().replace(/\s+/g, "-")}`, name },
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "New conversation",
      unread: false,
      status: "new",
    };
    setConversations((cs) => [conv, ...cs]);
    setMessagesByConversation((m) => ({ ...m, [conv.id]: [] }));
    setSelectedId(conv.id);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [conversations]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const openRequest = requests.find((r) => r.id === openRequestId) ?? null;

  function resolveRequest(id: string) {
    // TODO(backend): update requests.status and, on approve, notify the requester.
    setRequests((rs) => rs.filter((r) => r.id !== id));
    setOpenRequestId(null);
  }

  /** Open (or start) a chat with the person who submitted the request. */
  function replyViaChat(request: InboxRequest) {
    const existing = conversations.find(
      (c) => c.user.name.toLowerCase() === request.requesterName.toLowerCase()
    );
    if (existing) {
      setSelectedId(existing.id);
    } else {
      const conv: Conversation = {
        id: `req-${request.id}`,
        user: {
          id: `u-${request.id}`,
          name: request.requesterName,
          isGuest: request.kind === "contact",
        },
        lastMessageAt: request.createdAt,
        lastMessagePreview: request.summary,
        unread: false,
        status: "new",
      };
      setConversations((cs) => [conv, ...cs]);
      setMessagesByConversation((m) => ({ ...m, [conv.id]: [] }));
      setSelectedId(conv.id);
    }
    setOpenRequestId(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Notifications" count={notifications.filter((n) => !n.readAt).length}>
          <NotificationsList initial={notifications} />
        </Panel>
        <Panel title="Requests" count={requests.filter((r) => r.status === "pending").length} open>
          <RequestsList items={requests} onOpen={(r) => setOpenRequestId(r.id)} />
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

      {openRequest && (
        <RequestDetail
          request={openRequest}
          onClose={() => setOpenRequestId(null)}
          onApprove={() => resolveRequest(openRequest.id)}
          onReject={() => resolveRequest(openRequest.id)}
          onReplyChat={() => replyViaChat(openRequest)}
        />
      )}
    </div>
  );
}
