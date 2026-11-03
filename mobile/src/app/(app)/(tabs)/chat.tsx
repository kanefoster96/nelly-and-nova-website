import { View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { ChatThread } from "@/components/chat/chat-thread";
import { TrainerInbox } from "@/components/chat/trainer-inbox";
import { PageTitle } from "@/components/page-title";
import { LoadingState } from "@/components/ui";
import { getMyConversation } from "@/data/inbox";
import { useBarInset, useTopBarInset } from "@/lib/floating-bar";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

function MemberChat() {
  const { data: conversation, error } = useAsync(getMyConversation);
  // Below the floating top buttons; the composer stays above the floating bar.
  const topInset = useTopBarInset();
  const barInset = useBarInset();
  if (!conversation) return <LoadingState error={error ? "Chat is temporarily unavailable." : null} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topInset }}>
      <PageTitle title="Chat" subtitle="Message the team any time." style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }} />
      <ChatThread
        conversationId={conversation.id}
        viewerIsStaff={false}
        emptyLabel="Send us a message and the team will get back to you here."
        bottomInset={barInset}
      />
    </View>
  );
}

export default function Chat() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerInbox /> : <MemberChat />;
}
