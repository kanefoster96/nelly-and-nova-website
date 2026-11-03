import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { NotificationsList } from "@/components/notifications-list";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { useNotifications } from "@/lib/notifications-context";
import { colors } from "@/theme";

/**
 * Your notifications, as Kanvas's screen: the list edge to edge, pull to
 * refresh. Opening it marks everything read (the bell's badge clears);
 * what was new keeps its dot while you're here.
 */
export default function NotificationsScreen() {
  const { notifications, reload, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  // Fresh from the server each time it's opened.
  useEffect(() => {
    reload();
  }, [reload]);

  // Anything unread — on opening, or arriving while it's open — is shown new and marked read.
  useEffect(() => {
    if (!notifications) return;
    const unread = notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length === 0) return;
    setNewIds((prev) => new Set([...prev, ...unread]));
    markAllRead();
  }, [notifications, markAllRead]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Notifications" />
      {!notifications ? (
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
          <NotificationsList notifications={notifications} unreadIds={newIds} />
        </ScrollView>
      )}
    </View>
  );
}
