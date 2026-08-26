"use client";

import { useState } from "react";
import { ChatThread } from "@/components/inbox/ChatThread";
import { ConversationList } from "@/components/inbox/ConversationList";
import { getOrCreateConversation, markConversationReadByStaff, sendStaffMessage } from "@/lib/liveChat/actions";
import type { RealMember } from "@/lib/admin/realMembers";
import type { Conversation, Message } from "@/lib/inbox/types";

/** Real-data admin chat — reuses the scaffold's presentational ChatThread /
 *  ConversationList (they're dumb components, data source doesn't matter)
 *  wired to the real conversations/messages tables instead. */
export function AdminChatApp({
  conversations: initialConversations,
  messagesByConversation: initialMessages,
  membersWithoutConversation,
}: {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  membersWithoutConversation: RealMember[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messagesByConversation, setMessagesByConversation] = useState(initialMessages);
  const [pending, setPending] = useState(membersWithoutConversation);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [starting, setStarting] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId(id);
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, unread: false } : c)));
    void markConversationReadByStaff(id);
  }

  async function startConversation(member: RealMember) {
    setStarting(member.accountId);
    try {
      const id = await getOrCreateConversation(member.accountId);
      const conv: Conversation = {
        id,
        user: { id: member.accountId, name: member.ownerName },
        lastMessageAt: new Date(0).toISOString(),
        lastMessagePreview: "No messages yet",
        unread: false,
        status: "new",
      };
      setConversations((cs) => [conv, ...cs]);
      setMessagesByConversation((m) => ({ ...m, [id]: [] }));
      setPending((p) => p.filter((m) => m.accountId !== member.accountId));
      setSelectedId(id);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-paper">Start a conversation</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((m) => (
              <button
                key={m.accountId}
                type="button"
                onClick={() => startConversation(m)}
                disabled={starting === m.accountId}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40 disabled:opacity-50"
              >
                {starting === m.accountId ? "Starting…" : m.ownerName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="h-[60vh] lg:h-[72vh]">
          <ConversationList conversations={conversations} selectedId={selectedId} onSelect={select} />
        </div>
        <div className="h-[70vh] lg:h-[72vh]">
          {selected ? (
            <ChatThread
              key={selected.id}
              conversationId={selected.id}
              headerName={selected.user.name}
              initialMessages={messagesByConversation[selected.id] ?? []}
              viewerIsStaff
              onSend={(body) => sendStaffMessage(selected.id, body)}
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
