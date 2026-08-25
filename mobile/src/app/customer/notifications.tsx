import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { markAllRead, markRead, useNotifications, type AppNotification } from "@/lib/notifications";
import { colors } from "@/theme/colors";

const KIND_ICON: Record<AppNotification["kind"], keyof typeof Ionicons.glyphMap> = {
  pickup_eta: "car-outline",
  dropoff_eta: "home-outline",
  info: "information-circle-outline",
};

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <FlatList
      style={styles.screen}
      data={notifications}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        hasUnread ? (
          <Pressable style={styles.markAllRow} onPress={() => void markAllRead()}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => <NotificationRow notification={item} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      }
    />
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        if (!notification.read) void markRead(notification.id);
      }}
    >
      {!notification.read && <View style={styles.unreadDot} />}
      <View style={styles.rowIcon}>
        <Ionicons name={KIND_ICON[notification.kind]} size={18} color={colors.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{notification.title}</Text>
        <Text style={styles.rowBodyText}>{notification.body}</Text>
        <Text style={styles.rowWhen}>{formatWhen(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  markAllRow: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
    alignItems: "flex-end",
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: H_PADDING,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadDot: {
    position: "absolute",
    left: 6,
    top: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fieldBg,
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
  rowBodyText: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.85)",
  },
  rowWhen: {
    marginTop: 2,
    fontSize: 11,
    color: colors.paperDim,
  },
  empty: {
    paddingHorizontal: 32,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.paperDim,
  },
});
