import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "./Avatar";
import { useSession } from "@/lib/session";
import { useUnreadNotificationCount } from "@/lib/notifications";
import { colors } from "@/theme/colors";

/**
 * App-wide top bar: account avatar (top-left), page title (centre), and a
 * notification bell (top-right) — Instagram-style. Shared by the customer
 * shell now and the admin shell later.
 */
export function TopBar({ title, onAvatarPress, onBellPress }: {
  title?: string;
  onAvatarPress?: () => void;
  onBellPress?: () => void;
}) {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const unread = useUnreadNotificationCount();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={onAvatarPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Account"
      >
        <Avatar uri={session?.avatarUrl} name={session?.ownerName} size={32} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        onPress={onBellPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        style={styles.bell}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.paper} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.paper,
    marginHorizontal: 8,
  },
  bell: {
    width: 32,
    alignItems: "flex-end",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
});
