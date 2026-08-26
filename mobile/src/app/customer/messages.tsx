import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { getMessages, getOrCreateMyConversation, sendMessage, subscribeToMessages, type ChatMessage } from "@/lib/chat";
import { colors } from "@/theme/colors";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Real-time chat with the trainer — one ongoing thread per account. */
export default function MessagesScreen() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    getOrCreateMyConversation().then(async (id) => {
      if (cancelled) return;
      setConversationId(id);
      const initial = await getMessages(id);
      if (cancelled) return;
      setMessages(initial);
      unsubscribe = subscribeToMessages(id, (message) => {
        setMessages((prev) => (prev ? [...prev.filter((m) => m.id !== message.id), message] : [message]));
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function handleSend() {
    const body = text.trim();
    if (!body || !conversationId || sending) return;
    setText("");
    setSending(true);
    try {
      const sent = await sendMessage(conversationId, body);
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {messages === null ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Say hello — your trainer will reply here.</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.fromStaff ? styles.rowStaff : styles.rowMine]}>
              <View style={[styles.bubble, item.fromStaff ? styles.bubbleStaff : styles.bubbleMine]}>
                <Text style={[styles.bubbleText, item.fromStaff ? styles.textStaff : styles.textMine]}>
                  {item.body}
                </Text>
                <Text style={[styles.bubbleTime, item.fromStaff ? styles.textStaff : styles.textMine]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message your trainer…"
          placeholderTextColor={colors.paperDim}
          multiline
        />
        <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8} style={styles.sendButton}>
          <Ionicons name="send" size={20} color={text.trim() ? colors.accent : colors.paperDim} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loading: {
    marginTop: 40,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  emptyText: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 14,
    color: colors.paperDim,
  },
  bubbleRow: {
    flexDirection: "row",
  },
  rowMine: {
    justifyContent: "flex-end",
  },
  rowStaff: {
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
  bubbleStaff: {
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
  textStaff: {
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
