import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { getMessages, subscribeToMessages, type ChatMessage } from "@/lib/chat";
import { markConversationReadByStaff, sendStaffMessage } from "@/lib/adminChat";
import { colors } from "@/theme/colors";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** One customer's conversation, from the coach's side. */
export default function AdminMessageThreadScreen() {
  const { id, name, accountId } = useLocalSearchParams<{ id: string; name: string; accountId: string }>();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void markConversationReadByStaff(id);
    getMessages(id).then((initial) => {
      if (!cancelled) setMessages(initial);
    });
    const unsubscribe = subscribeToMessages(id, (message) => {
      setMessages((prev) => (prev ? [...prev.filter((m) => m.id !== message.id), message] : [message]));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id]);

  async function handleSend() {
    const body = text.trim();
    if (!body || !id || !accountId || sending) return;
    setText("");
    setSending(true);
    try {
      const sent = await sendStaffMessage(id, accountId, body);
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: name ?? "Chat" }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.fromStaff ? styles.rowMine : styles.rowCustomer]}>
              <View style={[styles.bubble, item.fromStaff ? styles.bubbleMine : styles.bubbleCustomer]}>
                <Text style={[styles.bubbleText, item.fromStaff ? styles.textMine : styles.textCustomer]}>
                  {item.body}
                </Text>
                <Text style={[styles.bubbleTime, item.fromStaff ? styles.textMine : styles.textCustomer]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          )}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Reply…"
            placeholderTextColor={colors.paperDim}
            multiline
          />
          <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8} style={styles.sendButton}>
            <Ionicons name="send" size={20} color={text.trim() ? colors.accent : colors.paperDim} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: "row",
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowCustomer: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.paper,
  },
  bubbleCustomer: {
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTime: {
    marginTop: 4,
    fontSize: 10,
    opacity: 0.6,
  },
  textMine: {
    color: colors.ink,
  },
  textCustomer: {
    color: colors.paper,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.paper,
  },
  sendButton: {
    paddingBottom: 8,
  },
});
