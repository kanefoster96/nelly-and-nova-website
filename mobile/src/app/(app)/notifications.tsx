import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";

import { NotificationsList } from "@/components/notifications-list";
import { ScreenHeader } from "@/components/screen-header";
import { useNotifications } from "@/lib/notifications-context";
import { colors } from "@/theme";

export default function NotificationsScreen() {
  const { notifications, reload, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  // What was unread when the screen opened — those rows keep their dot while
  // it's open, even though opening it clears the bell's badge.
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string> | null>(null);
  const captured = useRef(false);

  useEffect(() => {
    if (!notifications || captured.current) return;
    captured.current = true;
    setUnreadAtOpen(new Set(notifications.filter((n) => !n.readAt).map((n) => n.id)));
    markAllRead();
  }, [notifications, markAllRead]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Notifications" />
      {!notifications || !unreadAtOpen ? (
        <ActivityIndicator color={colors.foreground} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
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
          <NotificationsList notifications={notifications} unreadIds={unreadAtOpen} />
        </ScrollView>
      )}
    </View>
  );
}
