import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { getConversationsForAdmin, type AdminConversation } from "@/lib/adminChat";
import { colors } from "@/theme/colors";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Every customer's conversation, newest activity first. */
export default function AdminMessagesListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<AdminConversation[] | null>(null);

  useEffect(() => {
    getConversationsForAdmin().then(setConversations);
  }, []);

  if (conversations === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={conversations}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No conversations yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => router.push({ pathname: "/admin/messages/[id]", params: { id: item.id, name: item.ownerName, accountId: item.accountId } })}
        >
          <Avatar name={item.ownerName} size={40} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName}>{item.ownerName}</Text>
              <Text style={styles.rowTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.rowPreview} numberOfLines={1}>
                {item.lastMessagePreview}
              </Text>
              {item.unread && <View style={styles.dot} />}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: colors.paperDim,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  rowTime: {
    fontSize: 11,
    color: colors.paperDim,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowPreview: {
    flex: 1,
    fontSize: 13,
    color: colors.paperDim,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
