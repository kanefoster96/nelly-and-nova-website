import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { initialsForName } from "@/components/avatar-circle";
import type { Notification } from "@/data/notifications";
import { colors, pressedBg } from "@/theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/**
 * A notification carries no image, so the mark comes from where the link
 * goes — the one field that reliably says what kind of thing happened.
 */
type Mark = { icon: keyof typeof Ionicons.glyphMap; tone: string };

function markFor(href: string | undefined): Mark {
  const path = (href ?? "").split(/[?#]/)[0];
  if (path.startsWith("/homework")) return { icon: "school", tone: colors.success };
  if (path.startsWith("/schedule")) return { icon: "calendar", tone: "#a78bfa" };
  if (path.startsWith("/community")) return { icon: "heart", tone: "#f472b6" };
  if (path.startsWith("/chat") || path.startsWith("/conversation")) return { icon: "chatbubble", tone: "#38bdf8" };
  if (path.startsWith("/profile")) return { icon: "person", tone: "#38bdf8" };
  return { icon: "notifications", tone: colors.muted };
}

/** Initials when a person did the thing; a glyph for the kind of thing when it was the business. */
const SYSTEM_SENDERS = ["nelly & nova", "website"];

function Avatar({ sentByName, href }: { sentByName: string; href?: string }) {
  if (!SYSTEM_SENDERS.includes(sentByName.trim().toLowerCase())) {
    return (
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(245,245,242,0.12)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>{initialsForName(sentByName)}</Text>
      </View>
    );
  }
  const { icon, tone } = markFor(href);
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${tone}22`, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={19} color={tone} />
    </View>
  );
}

export function NotificationsList({ notifications, unreadIds }: { notifications: Notification[]; unreadIds?: Set<string> }) {
  if (notifications.length === 0) {
    return (
      <View style={{ margin: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(18,18,18,0.5)", borderRadius: 16, padding: 32 }}>
        <Text style={{ color: colors.muted, textAlign: "center", fontSize: 14 }}>No notifications yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      {notifications.map((n, i) => {
        const unread = unreadIds ? unreadIds.has(n.id) : !n.readAt;
        const body = (
          <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
            <Avatar sentByName={n.sentByName ?? "Nelly & Nova"} href={n.actionHref} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                  {n.sentByName ?? "Nelly & Nova"}
                </Text>
                {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />}
                <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDateTime(n.createdAt)}</Text>
                {n.actionHref && <Ionicons name="chevron-forward" size={15} color={colors.muted} />}
              </View>
              {!!n.title && <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginTop: 4 }}>{n.title}</Text>}
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{n.body}</Text>
            </View>
          </View>
        );
        const rowStyle = i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined;
        return n.actionHref ? (
          <Pressable key={n.id} onPress={() => router.navigate(n.actionHref as never)} style={({ pressed }) => [rowStyle, pressed && { backgroundColor: pressedBg }]}>
            {body}
          </Pressable>
        ) : (
          <View key={n.id} style={rowStyle}>
            {body}
          </View>
        );
      })}
    </View>
  );
}
