import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Animated, AppState, PanResponder, ScrollView, Text, TextInput, View } from "react-native";

import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { getConversations, markChatRead, setConversationStatus, type Conversation } from "@/data/inbox";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { useAsync } from "@/lib/useAsync";
import { colors, GLASS_BORDER } from "@/theme";

/** Unread is something waiting on a trainer: amber, as on Kanvas's inbox. */
const UNREAD = colors.warning;
/** The owner's chat beat a heartbeat in the last couple of minutes. */
const ACTIVE_MS = 2 * 60 * 1000;

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

/**
 * One inbox row, laid out like Kanvas's (and Instagram's): avatar, the name,
 * the latest message ("You:" when it was ours) with when, then their dogs;
 * how many are unread (amber), a tick when done, and a green ring while they're in the chat.
 */
function ConversationRow({ c, live, onPress, onLongPress }: { c: Conversation; live: boolean; onPress: () => void; onLongPress: () => void }) {
  const unread = c.unread;
  const completed = c.status === "closed";
  const preview = c.lastMessagePreview ? `${c.lastMessageFromStaff ? "You: " : ""}${c.lastMessagePreview}` : "No messages yet";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 11, opacity: completed ? 0.65 : 1, backgroundColor: colors.background }}
    >
      <View>
        <AvatarCircle name={c.user.name} avatarUrl={c.avatarUrl} size={56} />
        {live && (
          <View
            accessibilityLabel="In the chat now"
            style={{ position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.background }}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 16, fontWeight: unread ? "700" : "500" }}>
          {c.user.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text numberOfLines={1} style={{ color: unread ? colors.foreground : colors.muted, fontSize: 14, fontWeight: unread ? "600" : "400", flexShrink: 1 }}>
            {preview}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 14, flexShrink: 0 }}>
            {"\u00A0·\u00A0"}
            {formatActivityDate(c.lastMessageAt)}
          </Text>
        </View>
        {!!c.dogNames && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="paw-outline" size={12} color={colors.muted} />
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
              {c.dogNames}
            </Text>
          </View>
        )}
      </View>
      {unread ? (
        // How many are waiting, in amber, so a busy chat stands out at a glance.
        <View
          accessibilityLabel={`${c.unreadCount || 1} unread`}
          style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: UNREAD }}
        >
          <Text allowFontScaling={false} style={{ color: "#0a0a0a", fontSize: 12, fontWeight: "800" }}>
            {(c.unreadCount || 1) > 99 ? "99+" : c.unreadCount || 1}
          </Text>
        </View>
      ) : completed ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

const ACTION_WIDTH = 84;
type SwipeAction = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; background: string; foreground: string; onPress: () => void };

/**
 * Swipe a chat left for its actions (Done or Reopen, and Read), on React
 * Native's own PanResponder as Kanvas's inbox does — no gesture-handler
 * native module. Only a clearly sideways drag is claimed, so the list still scrolls.
 */
function SwipeActions({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const width = ACTION_WIDTH * actions.length;
  const settle = (to: number) => {
    open.current = to !== 0;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        const base = open.current ? -width : 0;
        x.setValue(Math.min(0, Math.max(-width * 1.4, base + g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        const base = open.current ? -width : 0;
        settle(base + g.dx < -width / 2 ? -width : 0);
      },
      onPanResponderTerminate: () => settle(open.current ? -width : 0),
    })
  ).current;

  return (
    <View style={{ overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              settle(0);
              a.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={{ width: ACTION_WIDTH, backgroundColor: a.background, alignItems: "center", justifyContent: "center", gap: 2 }}
          >
            <Ionicons name={a.icon} size={20} color={a.foreground} />
            <Text style={{ color: a.foreground, fontSize: 12, fontWeight: "700" }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: x }], backgroundColor: colors.background }}>
        {children}
      </Animated.View>
    </View>
  );
}

function EmptyCard({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={{ margin: 16, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={26} color={colors.muted} />
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

/** The trainer inbox: big "Inbox" title, search + filters, every conversation. */
export function TrainerInbox() {
  const router = useRouter();
  const { data: conversations, error, reload, setData } = useAsync(getConversations);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());

  // While it's on screen it keeps up by itself, as Kanvas's does: back from
  // a thread, back from the background, and every half a minute.
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        setNow(Date.now());
        void reload();
      };
      refresh();
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      const timer = setInterval(() => {
        if (AppState.currentState === "active") refresh();
      }, 30_000);
      return () => {
        appState.remove();
        clearInterval(timer);
      };
    }, [reload])
  );

  /** Done / Reopen / Read without opening it: shown at once, put back if it doesn't save. */
  async function act(c: Conversation, action: "done" | "reopen" | "read") {
    hapticSuccess();
    animateListChange();
    setData((list) =>
      list?.map((x) => (x.id !== c.id ? x : action === "read" ? { ...x, unread: false } : { ...x, status: action === "done" ? "closed" : "active" }))
    );
    try {
      if (action === "read") await markChatRead(c.id, true);
      else await setConversationStatus(c.id, action === "done" ? "closed" : "active");
    } catch {
      hapticError();
      Alert.alert("Couldn't update that chat", "Please try again.");
      void reload();
    }
  }

  function actionsFor(c: Conversation): SwipeAction[] {
    return [
      c.status === "closed"
        ? { key: "reopen", label: "Reopen", icon: "arrow-undo-outline", background: "#3a3a40", foreground: colors.foreground, onPress: () => void act(c, "reopen") }
        : { key: "done", label: "Done", icon: "checkmark-circle-outline", background: colors.success, foreground: "#08080a", onPress: () => void act(c, "done") },
      ...(c.unread ? [{ key: "read", label: "Read", icon: "mail-open-outline" as const, background: "#3a3a40", foreground: colors.foreground, onPress: () => void act(c, "read") }] : []),
    ];
  }

  /** Press and hold: the same choices as swiping. */
  function showActions(c: Conversation) {
    Alert.alert(c.user.name, undefined, [
      ...actionsFor(c).map((a) => ({ text: a.key === "read" ? "Mark as read" : a.key === "done" ? "Mark as done" : "Reopen", onPress: a.onPress })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }
  // Under the floating top buttons and over the floating bar (lib/floating-bar.tsx).
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  const visible = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const completed = c.status === "closed";
      if (filter === "unread" && !c.unread) return false;
      if (filter === "open" && (c.unread || completed)) return false;
      if (filter === "completed" && !completed) return false;
      if (!q) return true;
      return c.user.name.toLowerCase().includes(q) || c.lastMessagePreview.toLowerCase().includes(q) || (c.dogNames ?? "").toLowerCase().includes(q);
    });
  }, [conversations, query, filter]);

  const unreadCount = conversations?.filter((c) => c.unread).length ?? 0;
  const counts: Record<Filter, number> = {
    all: conversations?.length ?? 0,
    unread: unreadCount,
    open: conversations?.filter((c) => !c.unread && c.status !== "closed").length ?? 0,
    completed: conversations?.filter((c) => c.status === "closed").length ?? 0,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        {...barScroll}
        automaticallyAdjustKeyboardInsets
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: barInset }}
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
        {/* Title, search and filters scroll with the list, up from under the floating buttons. */}
        <View style={{ paddingTop: topInset }}>
          <PageTitle title="Inbox" note={unreadCount > 0 ? `${unreadCount} unread` : null} noteColor={UNREAD} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }} />

          <View style={{ marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface }}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search names, dogs or messages"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 11 }}
            />
          </View>

          {/* All / Unread / Open / Completed with counts; Unread stays amber while there's any. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const amber = f.key === "unread" && counts.unread > 0;
              const tone = amber ? UNREAD : colors.accent;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    if (filter !== f.key) hapticSelection();
                    animateListChange();
                    setFilter(f.key);
                  }}
                  accessibilityState={{ selected: active }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    ...GLASS_BORDER,
                    ...(active ? { borderColor: tone } : amber ? { borderColor: UNREAD } : null),
                    backgroundColor: active ? tone : "transparent",
                  }}
                >
                  <Text style={{ color: active ? colors.accentForeground : amber ? UNREAD : colors.foreground, fontSize: 13, fontWeight: "700" }}>{f.label}</Text>
                  {conversations !== null && (
                    <Text style={{ color: active ? colors.accentForeground : amber ? UNREAD : colors.muted, fontSize: 13, fontWeight: "600", opacity: 0.8 }}>{counts[f.key]}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 8 }} />
        {error && <Text style={{ color: colors.danger, paddingHorizontal: 16, marginVertical: 12 }}>{error.message}</Text>}
        {visible === null ? (
          <ActivityIndicator color={colors.foreground} style={{ marginTop: 32 }} />
        ) : visible.length === 0 ? (
          query.trim() ? (
            <EmptyCard icon="search-outline" title={`Nothing matches “${query.trim()}”`} text="Try an owner's name, a dog's name or a word from a message." />
          ) : filter === "unread" ? (
            <EmptyCard icon="checkmark-done-outline" title="All caught up" text="Every message has been read." />
          ) : filter === "open" ? (
            <EmptyCard icon="chatbubbles-outline" title="No open conversations" text="Conversations you've read but not marked done show here." />
          ) : filter === "completed" ? (
            <EmptyCard icon="checkmark-circle-outline" title="Nothing done yet" text="Tap Done in a conversation once it's sorted, and it moves here." />
          ) : (
            <EmptyCard icon="chatbubble-ellipses-outline" title="No conversations yet" text="Messages from owners on the app and the website all arrive here." />
          )
        ) : (
          // No lines between chats: the space around each row separates them.
          visible.map((c, i) => (
            <Appear key={c.id} index={i}>
              {/* Fresh when it flips read/unread or done/open, so no half-finished swipe carries over. */}
              <SwipeActions key={`${c.unread ? "unread" : "read"}-${c.status}`} actions={actionsFor(c)}>
                <ConversationRow
                  c={c}
                  live={!!c.memberLastActiveAt && now - new Date(c.memberLastActiveAt).getTime() < ACTIVE_MS}
                  onPress={() => router.push({ pathname: "/conversation/[id]", params: { id: c.id } })}
                  onLongPress={() => showActions(c)}
                />
              </SwipeActions>
            </Appear>
          ))
        )}
      </ScrollView>
    </View>
  );
}
