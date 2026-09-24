import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { ChatThread } from "@/components/ChatThread";
import { Screen } from "@/components/Screen";
import { Avatar, Card, EmptyState, Loading, Pill } from "@/components/ui";
import { formatTime, getConversations, getMyConversation } from "@/data/inbox";
import { useAsync } from "@/lib/useAsync";
import { colors, space } from "@/theme";

function TrainerInbox() {
  const { data: conversations, loading, reload } = useAsync(getConversations);
  if (!conversations) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {conversations.length === 0 ? <EmptyState title="No conversations yet" /> : null}
      {conversations.map((c) => (
        <Card key={c.id} style={styles.row} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id, name: c.user.name } })}>
          <Avatar name={c.user.name} />
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text style={[styles.name, c.unread && styles.unread]} numberOfLines={1}>{c.user.name}</Text>
              <Text style={styles.time}>{formatTime(c.lastMessageAt)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={2}>{c.lastMessagePreview}</Text>
          </View>
          {c.user.isGuest ? <Pill label="Guest" /> : c.unread ? <View style={styles.dot} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

function MemberChat() {
  const { data: conversation } = useAsync(getMyConversation);
  if (!conversation) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: "Nelly & Nova", headerLargeTitle: false }} />
      <ChatThread conversationId={conversation.id} asStaff={false} />
    </>
  );
}

export default function Chat() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerInbox /> : <MemberChat />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  name: { color: colors.paper, fontSize: 16, fontWeight: "500", flex: 1 },
  unread: { fontWeight: "800" },
  time: { color: colors.paperDim, fontSize: 12 },
  preview: { color: colors.paperDim, fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
