import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmptyState, Loading } from "@/components/ui";
import { formatTime, getMessages, sendMessage, type Message } from "@/data/inbox";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

/**
 * One conversation. `asStaff` = the signed-in user is a trainer, so their own
 * bubbles are the staff ones.
 */
export function ChatThread({ conversationId, asStaff }: { conversationId: string; asStaff: boolean }) {
  const headerHeight = useHeaderHeight();
  const { data: messages, setData } = useAsync(() => getMessages(conversationId), [conversationId]);
  const [draft, setDraft] = useState("");

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const optimistic: Message = { id: `pending-${Date.now()}`, conversationId, body, fromStaff: asStaff, createdAt: new Date().toISOString(), pending: true };
    setData((m) => [...(m ?? []), optimistic]);
    const saved = await sendMessage(conversationId, body, asStaff);
    setData((m) => m?.map((x) => (x.id === optimistic.id ? saved : x)));
  }

  if (!messages) return <Loading />;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <FlatList
        style={styles.flex}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="Say hello 👋" body="Messages go straight to the Nelly & Nova team." />}
        renderItem={({ item }) => {
          const mine = item.fromStaff === asStaff;
          return (
            <View style={[styles.bubbleRow, mine && styles.mineRow]}>
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs, item.pending && styles.pending]}>
                <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
              </View>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.paperDim}
          multiline
        />
        <Pressable onPress={send} disabled={!draft.trim()} style={({ pressed }) => [styles.send, (!draft.trim() || pressed) && { opacity: 0.4 }]} accessibilityLabel="Send">
          <SymbolView name={{ ios: "arrow.up", android: "arrow_upward" }} tintColor={colors.accentInk} size={18} weight="bold" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink },
  list: { padding: space.md, gap: space.sm },
  bubbleRow: { alignItems: "flex-start", gap: 2 },
  mineRow: { alignItems: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, borderCurve: "continuous" },
  mine: { backgroundColor: colors.accent },
  theirs: { backgroundColor: colors.inkRaised },
  pending: { opacity: 0.6 },
  body: { color: colors.paper, fontSize: 16, lineHeight: 21 },
  mineText: { color: colors.accentInk },
  time: { color: colors.paperDim, fontSize: 11, paddingHorizontal: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, padding: space.sm, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 120, color: colors.paper, fontSize: 16, backgroundColor: colors.inkRaised, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 2 },
});
