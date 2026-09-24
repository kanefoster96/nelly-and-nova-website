import { Stack, useLocalSearchParams } from "expo-router";

import { ChatThread } from "@/components/ChatThread";

/** Trainer: one member's conversation. */
export default function Conversation() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: name ?? "Chat" }} />
      <ChatThread conversationId={id} asStaff />
    </>
  );
}
