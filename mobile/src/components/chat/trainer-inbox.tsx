import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { getConversations, type Conversation } from "@/data/inbox";
import { useAsync } from "@/lib/useAsync";
import { colors, pressedBg } from "@/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Filter = "all" | "unread" | "open" | "completed";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "completed", label: "Completed" },
];

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return WEEKDAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Messenger-style row: avatar, bold name, latest message, time, unread dot. */
function ConversationRow({ c, onPress }: { c: Conversation; onPress: () => void }) {
  const unread = c.unread;
  const completed = c.status === "closed";
  const preview = c.lastMessagePreview ? `${c.lastMessageFromStaff ? "You: " : ""}${c.lastMessagePreview}` : "No messages yet";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, opacity: completed ? 0.65 : 1 },
        pressed && { backgroundColor: pressedBg },
      ]}
    >
      <AvatarCircle name={c.user.name} avatarUrl={c.avatarUrl} size={50} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 16, fontWeight: unread ? "700" : "600", flex: 1, minWidth: 0 }}>
            {c.user.name}
            {c.user.isGuest ? <Text style={{ color: colors.muted, fontWeight: "400" }}> · Visitor</Text> : null}
          </Text>
          <Text style={{ color: unread ? colors.foreground : colors.muted, fontSize: 12 }}>{formatActivityDate(c.lastMessageAt)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
          <Text numberOfLines={1} style={{ color: unread ? colors.foreground : colors.muted, fontSize: 14, flex: 1, fontWeight: unread ? "500" : "400" }}>
            {preview}
          </Text>
          {unread ? (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />
          ) : completed ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.muted} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The trainer inbox: big "Inbox" title, search + filters, every conversation. */
export function TrainerInbox() {
  const router = useRouter();
  const { data: conversations, error, reload } = useAsync(getConversations);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const completed = c.status === "closed";
      if (filter === "unread" && !c.unread) return false;
      if (filter === "open" && (c.unread || completed)) return false;
      if (filter === "completed" && !completed) return false;
      if (!q) return true;
      return c.user.name.toLowerCase().includes(q) || c.lastMessagePreview.toLowerCase().includes(q);
    });
  }, [conversations, query, filter]);

  const unreadCount = conversations?.filter((c) => c.unread).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>Inbox</Text>
        {unreadCount > 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>{unreadCount} unread</Text>}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search-outline" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 4 }}
        />
        <Pressable onPress={() => setFiltersOpen((v) => !v)} hitSlop={8} accessibilityLabel="Filter conversations" style={{ padding: 4 }}>
          <Ionicons name="options-outline" size={22} color={filter === "all" ? colors.foreground : colors.accent} />
        </Pressable>
      </View>

      {filtersOpen && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : "transparent",
                }}
              >
                <Text style={{ color: active ? colors.accentForeground : colors.muted, fontSize: 12, fontWeight: "600" }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView
        automaticallyAdjustKeyboardInsets
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            tintColor={colors.foreground}
          />
        }
      >
        {error && <Text style={{ color: colors.danger, paddingHorizontal: 16, marginVertical: 12 }}>{error.message}</Text>}
        {visible === null ? (
          <ActivityIndicator color={colors.foreground} style={{ marginTop: 32 }} />
        ) : visible.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 32 }}>
            {query.trim() ? `No conversations match “${query.trim()}”.` : filter === "all" ? "No conversations yet." : "Nothing here."}
          </Text>
        ) : (
          visible.map((c, i) => (
            <View key={c.id} style={{ borderBottomWidth: i < visible.length - 1 ? 1 : 0, borderColor: colors.border, marginLeft: 80 }}>
              <View style={{ marginLeft: -80 }}>
                <ConversationRow c={c} onPress={() => router.push({ pathname: "/conversation/[id]", params: { id: c.id } })} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
