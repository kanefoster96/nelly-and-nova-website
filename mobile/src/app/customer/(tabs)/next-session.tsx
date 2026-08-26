import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getNextSession, sessionKindLabel, type NextSession } from "@/lib/dogs";
import { activeDog, hasActiveMembership, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

const NOTICE_ICON: Record<NextSession["notices"][number]["kind"], keyof typeof Ionicons.glyphMap> = {
  weather: "rainy-outline",
  heat: "thermometer-outline",
  cancellation: "alert-circle-outline",
  info: "information-circle-outline",
};

function formatSessionWhen(iso: string, isToday: boolean): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today · ${time}`;
  const day = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

/**
 * The dog's schedule at a glance: membership status + a large card for the
 * next (or today's) session, with any trainer notice attached — weather,
 * heat, cancellation, general info. Rescheduling/cancelling/booking extra
 * sessions live on the Calendar tab, not here — this is read-only.
 */
export default function NextSessionScreen() {
  const session = useSession();
  const dog = activeDog(session);

  const [result, setResult] = useState<{ dogId: string; nextSession: NextSession | null } | null>(null);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    const dogId = dog.id;

    getNextSession(dogId).then((nextSession) => {
      if (!cancelled) setResult({ dogId, nextSession });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  if (!session || !dog) return null;

  // Stale result from the previous dog, still resolving for this one.
  const nextSession = result?.dogId === dog.id ? result.nextSession : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.membershipRow}>
        <Ionicons
          name={hasActiveMembership(session) ? "checkmark-circle" : "help-circle-outline"}
          size={18}
          color={hasActiveMembership(session) ? "#4ade80" : colors.paperDim}
        />
        <Text style={styles.membershipText}>
          {hasActiveMembership(session) ? "Active membership" : "No active membership"}
        </Text>
      </View>

      {nextSession === undefined ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : nextSession ? (
        <View style={styles.card}>
          {nextSession.isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}

          <View style={styles.iconWrap}>
            <Ionicons name="paw" size={28} color={colors.accent} />
          </View>

          <Text style={styles.kind}>{sessionKindLabel(nextSession.kind)}</Text>
          <Text style={styles.when}>{formatSessionWhen(nextSession.scheduledAt, nextSession.isToday)}</Text>
          {nextSession.location ? <Text style={styles.location}>{nextSession.location}</Text> : null}

          {nextSession.notices.length > 0 && (
            <View style={styles.notices}>
              {nextSession.notices.map((notice) => (
                <View key={notice.id} style={styles.notice}>
                  <Ionicons name={NOTICE_ICON[notice.kind]} size={16} color={colors.paper} />
                  <Text style={styles.noticeText}>{notice.message}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            No session day set yet — we&apos;ll confirm this once you&apos;re onboarded.
          </Text>
        </View>
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
    gap: 20,
  },
  membershipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  membershipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  loading: {
    marginTop: 40,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 28,
    alignItems: "center",
    gap: 6,
  },
  todayBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentInk,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 8,
  },
  kind: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.paper,
  },
  when: {
    fontSize: 15,
    color: "rgba(245,242,234,0.85)",
  },
  location: {
    fontSize: 13,
    color: colors.paperDim,
  },
  notices: {
    alignSelf: "stretch",
    marginTop: 16,
    gap: 10,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.9)",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
    textAlign: "center",
  },
});
