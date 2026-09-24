import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { AttachmentContent } from "@/components/chat/attachment-content";
import { getMessages, markChatRead, sendMessage, type Attachment, type Message } from "@/data/inbox";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DIVIDER_GAP_MS = 5 * 60 * 1000;

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} · ${hours}:${minutes}`;
}

function needsDivider(current: Message, previous: Message | undefined): boolean {
  if (!previous) return true;
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > DIVIDER_GAP_MS;
}

type RowMessage = Message & { showDivider: boolean; showSenderLabel: boolean };

// One line at rest; grows to about five lines, then scrolls inside.
const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_MAX_HEIGHT = 22 * 5 + 20;

/**
 * One conversation, laid out like the Kanvas app's chat: time dividers,
 * team bubbles with the sender's avatar and name, your own bubbles in the
 * accent colour, and the composer at the bottom.
 *
 * `viewerIsStaff` picks the side: a member gets one tidy row (field, attach,
 * send); a trainer gets the full-width field with a toolbar underneath.
 */
export function ChatThread({
  conversationId,
  viewerIsStaff,
  locked = false,
  lockedMessage,
  emptyLabel = "No messages yet — say hello!",
}: {
  conversationId: string;
  viewerIsStaff: boolean;
  /** Hides the composer — a completed conversation on the trainer side. */
  locked?: boolean;
  lockedMessage?: string | null;
  emptyLabel?: string;
}) {
  const { data: loaded } = useAsync(() => getMessages(conversationId), [conversationId]);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (loaded) setMessages(loaded);
  }, [loaded]);

  useEffect(() => {
    markChatRead(conversationId, viewerIsStaff).catch(() => {});
  }, [conversationId, viewerIsStaff]);

  // How far the keyboard overlaps this thread, measured against where the
  // thread really ends on screen — right whether the tab bar is under it or not.
  const rootRef = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const onFrame = (e: { endCoordinates: { screenY: number } }) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKeyboardInset(Math.max(0, Math.round(y + h - keyboardTop))));
    };
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", onFrame);
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN_HEIGHT);

  async function send(body: string, attachment?: Attachment) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = { id: tempId, conversationId, body, fromStaff: viewerIsStaff, createdAt: new Date().toISOString(), pending: true, attachment };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setError(null);
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const saved = await sendMessage(conversationId, body, viewerIsStaff, attachment);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
    } catch {
      setError("Could not send that — please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    send(body);
  }

  async function pickFromLibrary(kind: "image" | "video") {
    setAttachMenuOpen(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [kind === "image" ? "images" : "videos"], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    send(draft.trim(), { type: kind, url: asset.uri, name: asset.fileName ?? (kind === "image" ? "Photo" : "Video") });
  }

  async function pickFile() {
    setAttachMenuOpen(false);
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    send(draft.trim(), { type: "file", url: asset.uri, name: asset.name });
  }

  const rows: RowMessage[] = messages.map((message, i) => {
    const showDivider = needsDivider(message, messages[i - 1]);
    const theirsFromStaff = message.fromStaff && !viewerIsStaff;
    const showSenderLabel = theirsFromStaff && (showDivider || i === 0 || !messages[i - 1].fromStaff || messages[i - 1].senderName !== message.senderName);
    return { ...message, showDivider, showSenderLabel };
  });

  const attachMenu = attachMenuOpen && (
    <View
      style={{
        position: "absolute",
        bottom: 48,
        right: 0,
        width: 150,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingVertical: 4,
        zIndex: 10,
      }}
    >
      {(
        [
          { icon: "image-outline", label: "Photo", onPress: () => pickFromLibrary("image") },
          { icon: "videocam-outline", label: "Video", onPress: () => pickFromLibrary("video") },
          { icon: "document-outline", label: "File", onPress: pickFile },
        ] as const
      ).map((item) => (
        <Pressable key={item.label} onPress={item.onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Ionicons name={item.icon} size={16} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const textInput = (fontSize: number, extraStyle: object) => (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      multiline
      onContentSizeChange={(e) => setInputHeight(Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, e.nativeEvent.contentSize.height + 20)))}
      placeholder="Type a message…"
      placeholderTextColor={colors.muted}
      style={{
        height: draft ? inputHeight : COMPOSER_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        color: colors.foreground,
        fontSize,
        lineHeight: 22,
        textAlignVertical: "top",
        ...extraStyle,
      }}
    />
  );

  return (
    <View ref={rootRef} style={{ flex: 1, paddingBottom: keyboardInset, backgroundColor: colors.background }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: rows.length === 0 ? "center" : undefined }}
        data={[...rows].reverse()}
        inverted
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loaded ? (
            <Text style={{ color: colors.muted, textAlign: "center", transform: [{ scaleY: -1 }] }}>{emptyLabel}</Text>
          ) : (
            <ActivityIndicator color={colors.foreground} />
          )
        }
        renderItem={({ item: message }) => {
          const isMine = message.fromStaff === viewerIsStaff;
          const showAvatarColumn = !isMine && message.fromStaff;
          return (
            <View style={{ marginBottom: 4 }}>
              {message.showDivider && (
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginVertical: 10 }}>{formatMessageTime(message.createdAt)}</Text>
              )}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                {showAvatarColumn && (
                  <View style={{ width: 26, height: 26 }}>
                    {message.showSenderLabel && <AvatarCircle name={message.senderName ?? "Nelly & Nova"} avatarUrl={message.senderAvatarUrl} size={26} />}
                  </View>
                )}
                <View style={{ maxWidth: "80%", gap: 2 }}>
                  {message.showSenderLabel && (
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", marginLeft: 4 }}>{message.senderName ?? "Nelly & Nova"}</Text>
                  )}
                  <View
                    style={{
                      borderRadius: 18,
                      paddingHorizontal: message.attachment ? 6 : 14,
                      paddingVertical: message.attachment ? 6 : 9,
                      backgroundColor: isMine ? colors.accent : colors.surface,
                      borderWidth: isMine ? 0 : 1,
                      borderColor: colors.border,
                      gap: 6,
                      opacity: message.pending ? 0.7 : 1,
                    }}
                  >
                    {message.attachment && <AttachmentContent attachment={message.attachment} mine={isMine} />}
                    {!!message.body && (
                      <Text style={{ color: isMine ? colors.accentForeground : colors.foreground, fontSize: 14, paddingHorizontal: message.attachment ? 6 : 0 }}>
                        {message.body}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      {locked ? (
        <Text style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 14, textAlign: "center", color: colors.muted, fontSize: 13 }}>
          {lockedMessage ?? "This conversation is marked complete."}
        </Text>
      ) : !viewerIsStaff ? (
        // A member's composer: one tidy row — the text field, attach, Send.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          {textInput(16, { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 22 })}
          <View>
            <Pressable
              onPress={() => setAttachMenuOpen((v) => !v)}
              accessibilityLabel="Attach"
              hitSlop={6}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="add-circle-outline" size={28} color={colors.foreground} />
            </Pressable>
            {attachMenu}
          </View>
          <Pressable
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            accessibilityLabel="Send"
            style={({ pressed }) => [
              { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", opacity: sending || !draft.trim() ? 0.45 : 1 },
              pressed && { opacity: 0.8 },
            ]}
          >
            {sending ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Ionicons name="arrow-up" size={22} color={colors.accentForeground} />}
          </Pressable>
        </View>
      ) : (
        // Messenger-desk layout for trainers: full-width field on top, toolbar underneath.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {textInput(17, {})}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2 }}>
            <View style={{ flex: 1 }} />
            <View>
              <Pressable
                onPress={() => setAttachMenuOpen((v) => !v)}
                accessibilityLabel="Attach"
                hitSlop={6}
                style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="add-circle-outline" size={26} color={colors.accent} />
              </Pressable>
              {attachMenu}
            </View>
            <Pressable
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              style={({ pressed }) => [
                { height: 38, borderRadius: 19, paddingHorizontal: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", opacity: sending || !draft.trim() ? 0.45 : 1 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {sending ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Text style={{ color: colors.accentForeground, fontSize: 15, fontWeight: "700" }}>Send</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {error && (
        <Text
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(225,29,51,0.3)",
            backgroundColor: "rgba(225,29,51,0.1)",
            color: colors.danger,
            fontSize: 12,
            textAlign: "center",
            padding: 8,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
