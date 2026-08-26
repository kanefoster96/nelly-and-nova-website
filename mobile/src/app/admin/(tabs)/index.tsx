import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getSessionsForToday, type ScheduleSession } from "@/lib/adminSchedule";
import { sessionKindLabel } from "@/lib/dogs";
import { colors } from "@/theme/colors";

const NOTICE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  weather: "rainy-outline",
  heat: "thermometer-outline",
  cancellation: "alert-circle-outline",
  info: "information-circle-outline",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Today's dogs at a glance — every session scheduled today, in order, with
 * any trainer notice (weather/heat/cancellation) surfaced up top. There's no
 * live weather API anywhere in this codebase (website included) — "weather"
 * here means the same trainer-authored session_notices the customer app's
 * Next Session card reads, not a forecast fetch.
 */
export default function AdminDashboardScreen() {
  const [sessions, setSessions] = useState<ScheduleSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSessionsForToday().then((data) => {
      if (!cancelled) setSessions(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const notices = (sessions ?? []).flatMap((s) => s.notices.map((n) => ({ ...n, dogName: s.dogName })));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{today}</Text>

      {sessions === null ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <>
          {notices.length > 0 && (
            <View style={styles.noticesCard}>
              {notices.map((n) => (
                <View key={n.id} style={styles.noticeRow}>
                  <Ionicons name={NOTICE_ICON[n.kind] ?? "information-circle-outline"} size={16} color={colors.paper} />
                  <Text style={styles.noticeText}>
                    <Text style={styles.noticeDog}>{n.dogName}: </Text>
                    {n.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {sessions.length} session{sessions.length === 1 ? "" : "s"} today
          </Text>

          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>Nothing scheduled today.</Text>
          ) : (
            <View style={styles.list}>
              {sessions.map((s) => (
                <View key={s.id} style={styles.row}>
                  <Text style={styles.rowTime}>{formatTime(s.scheduledAt)}</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowDog}>
                      {s.dogName} <Text style={styles.rowOwner}>({s.ownerName})</Text>
                    </Text>
                    <Text style={styles.rowMeta}>
                      {sessionKindLabel(s.kind)}
                      {s.location ? ` · ${s.location}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 20,
    gap: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.paper,
  },
  loading: {
    marginTop: 40,
  },
  noticesCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
    gap: 10,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeDog: {
    fontWeight: "700",
    color: colors.paper,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.9)",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  emptyText: {
    fontSize: 14,
    color: colors.paperDim,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  rowTime: {
    width: 64,
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowDog: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  rowOwner: {
    fontWeight: "400",
    color: colors.paperDim,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.paperDim,
  },
});
