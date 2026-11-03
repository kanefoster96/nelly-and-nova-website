import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Linking, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarCircle } from "@/components/avatar-circle";
import { ChatThread } from "@/components/chat/chat-thread";
import { GlassButton } from "@/components/glass-button";
import { LoadingState } from "@/components/ui";
import { Pressable } from "@/components/pressable";
import { getConversation, getConversationStatus, setConversationStatus } from "@/data/inbox";
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

/** The owner's chat beat a heartbeat in the last couple of minutes. */
const ACTIVE_MS = 2 * 60 * 1000;

function relativeTime(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Done / Reopen: a labelled pill, so what it does is plain at a glance (Kanvas's coach chat). */
function StatusButton({ completed, onPress, disabled }: { completed: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={completed ? "Reopen conversation" : "Mark conversation done"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: completed ? colors.border : "rgba(34,197,94,0.55)",
        backgroundColor: completed ? colors.surface : "rgba(34,197,94,0.14)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={completed ? "arrow-undo-outline" : "checkmark"} size={16} color={completed ? colors.foreground : "#86efac"} />
      <Text style={{ color: completed ? colors.foreground : "#86efac", fontSize: 14, fontWeight: "700" }}>{completed ? "Reopen" : "Done"}</Text>
    </Pressable>
  );
}

/**
 * Trainer: one conversation, messenger-style — back, avatar and name, a
 * status line (in the chat now, when they were last in, or done), call, and
 * Done / Reopen — as Kanvas's coach chat.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: conversation, error, setData } = useAsync(() => getConversation(id), [id]);
  const [pending, setPending] = useState(false);
  const [status, setStatusInfo] = useState<{ memberLastReadAt: string | null; memberLastActiveAt: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // When the owner last read and last had the chat open — kept fresh while it's on screen.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setNow(Date.now());
      getConversationStatus(id)
        .then((s) => {
          if (!cancelled) setStatusInfo(s);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

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
  const activeAt = status?.memberLastActiveAt ?? conversation?.memberLastActiveAt ?? null;
  const live = !!activeAt && now - new Date(activeAt).getTime() < ACTIVE_MS;
  const subtitle = !conversation
    ? null
    : completed
      ? "Marked done"
      : live
        ? "In the chat now"
        : activeAt
          ? `Last in the chat ${relativeTime(activeAt, now)}`
          : conversation.dogNames
            ? `Owner of ${conversation.dogNames}`
            : "Open conversation";

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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", flexShrink: 1 }}>
                  {name}
                </Text>
                {live && <View accessibilityLabel="In the chat now" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />}
              </View>
              {subtitle && (
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {conversation?.phone && <IconButton icon="call-outline" label={`Call ${name}`} onPress={() => Linking.openURL(`tel:${conversation.phone}`)} />}
          {conversation && <StatusButton completed={completed} onPress={() => setStatus(completed ? "active" : "closed")} disabled={pending} />}
        </View>
      </View>

      {!conversation ? (
        <LoadingState error={error ? "Could not load this conversation." : null} />
      ) : (
        <ChatThread
          conversationId={conversation.id}
          viewerIsStaff
          locked={pending || completed}
          lockedMessage={pending ? "Updating…" : "This conversation is done. Tap Reopen above to reply."}
          emptyLabel="No messages yet."
          owner={{ accountId: conversation.user.id, email: conversation.email }}
          memberLastReadAt={status ? status.memberLastReadAt : undefined}
        />
      )}
    </View>
  );
}
