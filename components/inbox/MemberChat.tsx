"use client";

import { ChatThread } from "./ChatThread";
import { sendMessage } from "@/lib/inbox/data";
import type { Message } from "@/lib/inbox/types";

/** Member/visitor side of the chat — wires onSend to the data layer. */
export function MemberChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  return (
    <ChatThread
      conversationId={conversationId}
      headerName="Nelly & Nova"
      initialMessages={initialMessages}
      viewerIsStaff={false}
      onSend={(body) => sendMessage(conversationId, body, false)}
    />
  );
}
