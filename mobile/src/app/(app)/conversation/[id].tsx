import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Linking, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarCircle } from "@/components/avatar-circle";
import { ChatThread } from "@/components/chat/chat-thread";
import { GlassButton } from "@/components/glass-button";
import { LoadingState } from "@/components/ui";
import { getConversation, setConversationStatus } from "@/data/inbox";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

function IconButton({ icon, label, onPress, disabled }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <GlassButton onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.foreground} />
    </GlassButton>
  );
}

/**
 * Trainer: one conversation, messenger-style — back, avatar and name, a
 * status line, call, and a tick/undo for Mark complete / Reopen — round
 * glass buttons, as at the top of every page.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: conversation, error, setData } = useAsync(() => getConversation(id), [id]);
  const [pending, setPending] = useState(false);

  async function setStatus(status: "active" | "closed") {
    setPending(true);
    try {
      await setConversationStatus(id, status);
      setData((c) => (c ? { ...c, status } : c));
      hapticSuccess();
    } catch {
      hapticError();
    } finally {
      setPending(false);
    }
  }

  const completed = conversation?.status === "closed";
  const name = conversation?.user.name ?? "Conversation";
  const subtitle = !conversation ? null : completed ? "Marked complete" : conversation.user.isGuest ? "Website visitor" : "Open conversation";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
          <GlassButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={colors.foreground} style={{ marginRight: 2 }} />
          </GlassButton>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingRight: 6 }}>
            <AvatarCircle name={name} avatarUrl={conversation?.avatarUrl} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                {name}
              </Text>
              {subtitle && (
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {conversation?.phone && <IconButton icon="call-outline" label={`Call ${name}`} onPress={() => Linking.openURL(`tel:${conversation.phone}`)} />}
          {conversation &&
            (completed ? (
              <IconButton icon="arrow-undo-outline" label="Reopen conversation" onPress={() => setStatus("active")} disabled={pending} />
            ) : (
              <IconButton icon="checkmark" label="Mark complete" onPress={() => setStatus("closed")} disabled={pending} />
            ))}
        </View>
      </View>

      {!conversation ? (
        <LoadingState error={error ? "Could not load this conversation." : null} />
      ) : (
        <ChatThread
          conversationId={conversation.id}
          viewerIsStaff
          locked={pending || completed}
          lockedMessage={pending ? "Updating…" : "This conversation is marked complete — tap ↺ above to reopen it."}
          emptyLabel="No messages yet."
        />
      )}
    </View>
  );
}
