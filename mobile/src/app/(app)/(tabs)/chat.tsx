import { useEffect, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { ChatThread } from "@/components/chat/chat-thread";
import { TrainerInbox } from "@/components/chat/trainer-inbox";
import { PageTitle } from "@/components/page-title";
import { LoadingState } from "@/components/ui";
import { getMyConversation } from "@/data/inbox";
import { getMyMemberships, hasOnline, REPLY_PROMISE } from "@/data/memberships";
import { useBarInset, useTopBarInset } from "@/lib/floating-bar";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const ONE_CHANNEL = "Message us here for anything — we reply in the app, and you'll get a notification when we do.";

function MemberChat() {
  const { data: conversation, error } = useAsync(getMyConversation);
  // Online members: our promise to reply within 12 hours.
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let live = true;
    getMyMemberships()
      .then((m) => live && setOnline(hasOnline(m)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  // Below the floating top buttons; the composer stays above the floating bar.
  const topInset = useTopBarInset();
  const barInset = useBarInset();
  if (!conversation) return <LoadingState error={error ? "Chat is temporarily unavailable." : null} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topInset }}>
      {/* One clear channel: this chat, rather than WhatsApp or texts. */}
      <PageTitle title="Chat" subtitle={online ? REPLY_PROMISE : ONE_CHANNEL} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }} />
      <ChatThread
        conversationId={conversation.id}
        viewerIsStaff={false}
        emptyLabel={
          online
            ? `Say hello! Questions about your homework, a video of how it's going, or anything else. ${REPLY_PROMISE}`
            : "Say hello! Questions about sessions, homework, pick-ups or anything else: the team will reply right here."
        }
        bottomInset={barInset}
      />
    </View>
  );
}

export default function Chat() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerInbox /> : <MemberChat />;
}
