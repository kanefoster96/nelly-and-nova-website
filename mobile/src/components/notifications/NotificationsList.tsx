import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications";
import { colors } from "@/theme/colors";

const KIND_ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle-outline",
  pickup_eta: "car-outline",
  dropoff_eta: "car-outline",
  chat_message: "chatbubble-ellipses-outline",
  reschedule_accepted: "calendar-outline",
  report_card_published: "document-text-outline",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** Shared bell-list rendering — customer/notifications.tsx and
 *  admin/notifications.tsx differ only in where each kind links to. */
export function NotificationsList({ routeFor }: { routeFor: (kind: NotificationKind) => string | undefined }) {
  const router = useRouter();
  const notifications = useNotifications();
  const unread = useUnreadNotificationCount();

  function onPress(n: NotificationItem) {
    if (!n.readAt) void markNotificationRead(n.id);
    const route = routeFor(n.kind);
    if (route) router.push(route as never);
  }

  return (
    <View style={styles.screen}>
      {unread > 0 && (
        <Pressable onPress={() => markAllNotificationsRead()} hitSlop={8} style={styles.markAllRow}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </Pressable>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Nothing yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPress(item)} style={styles.row}>
            <View style={[styles.iconWrap, !item.readAt && styles.iconWrapUnread]}>
              <Ionicons name={KIND_ICON[item.kind]} size={18} color={colors.paper} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMessage} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.rowWhen}>{formatWhen(item.createdAt)}</Text>
            </View>
            {!item.readAt && <View style={styles.dot} />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  markAllRow: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
  list: {
    paddingVertical: 8,
  },
  emptyText: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 14,
    color: colors.paperDim,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconWrapUnread: {
    backgroundColor: colors.accent,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  rowMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.85)",
  },
  rowWhen: {
    marginTop: 2,
    fontSize: 11,
    color: colors.paperDim,
  },
  dot: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
