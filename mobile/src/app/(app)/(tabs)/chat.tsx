import { useAuth } from "@/auth/AuthProvider";
import { ChatThread } from "@/components/chat/chat-thread";
import { TrainerInbox } from "@/components/chat/trainer-inbox";
import { LoadingState } from "@/components/ui";
import { getMyConversation } from "@/data/inbox";
import { useAsync } from "@/lib/useAsync";

function MemberChat() {
  const { data: conversation, error } = useAsync(getMyConversation);
  if (!conversation) return <LoadingState error={error ? "Chat is temporarily unavailable." : null} />;
  return <ChatThread conversationId={conversation.id} viewerIsStaff={false} emptyLabel="Send us a message and the team will get back to you here." />;
}

export default function Chat() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerInbox /> : <MemberChat />;
}
