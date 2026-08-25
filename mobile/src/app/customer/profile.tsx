import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import {
  getCompletedSessionCount,
  getDogDetail,
  getDogLevel,
  getNextSession,
  sessionKindLabel,
  type NextSession,
} from "@/lib/dogs";
import { activeDog, setActiveDog, useSession, type SessionDog } from "@/lib/session";
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
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

type DogStats = {
  dogId: string;
  breed: string;
  age: string;
  level: number;
  sessionCount: number;
  nextSession: NextSession | null;
};

export default function ProfileScreen() {
  const session = useSession();
  const router = useRouter();
  const dog = activeDog(session);

  const [stats, setStats] = useState<DogStats | null>(null);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    const dogId = dog.id;

    Promise.all([
      getDogDetail(dogId),
      getDogLevel(dogId),
      getCompletedSessionCount(dogId),
      getNextSession(dogId),
    ]).then(([detail, level, sessionCount, nextSession]) => {
      if (cancelled) return;
      setStats({ dogId, breed: detail.breed, age: detail.age, level, sessionCount, nextSession });
    });

    return () => {
      cancelled = true;
    };
    // Re-fetch on dog switch only — `dog` is a fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  if (!session || !dog) return null;

  // Stale stats from the previous dog, still resolving for this one.
  const shown = stats?.dogId === dog.id ? stats : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {session.dogs.length > 1 && (
        <DogSwitcher dogs={session.dogs} activeId={dog.id} onSelect={setActiveDog} />
      )}

      <View style={styles.header}>
        <Avatar uri={dog.photo} name={dog.name} size={88} />
        <View style={styles.stats}>
          <Stat label="Level" value={shown?.level ?? "…"} />
          <Stat label="Age" value={shown?.age || "—"} />
          <Stat label="Sessions" value={shown?.sessionCount ?? "…"} />
        </View>
      </View>

      <View style={styles.nameBlock}>
        <Text style={styles.name}>{dog.name}</Text>
        {shown?.breed ? <Text style={styles.breed}>{shown.breed}</Text> : null}
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.actionsCol}>
          <Button title="Walks" variant="secondary" onPress={() => router.push("/customer/walks")} />
        </View>
        <View style={styles.actionsCol}>
          <Button title="Reports" variant="secondary" onPress={() => router.push("/customer/reports")} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next session</Text>
        {!shown ? (
          <ActivityIndicator color={colors.accent} />
        ) : shown.nextSession ? (
          <View style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionIcon}>
                <Ionicons name="calendar" size={20} color={colors.accent} />
              </View>
              <View style={styles.sessionText}>
                <Text style={styles.sessionKind}>{sessionKindLabel(shown.nextSession.kind)}</Text>
                <Text style={styles.sessionWhen}>
                  {formatSessionWhen(shown.nextSession.scheduledAt, shown.nextSession.isToday)}
                </Text>
                {shown.nextSession.location ? (
                  <Text style={styles.sessionLocation}>{shown.nextSession.location}</Text>
                ) : null}
              </View>
            </View>

            {shown.nextSession.notices.map((notice) => (
              <View key={notice.id} style={styles.notice}>
                <Ionicons name={NOTICE_ICON[notice.kind]} size={16} color={colors.paper} />
                <Text style={styles.noticeText}>{notice.message}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No session day set yet — we&apos;ll confirm this once you&apos;re onboarded.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function DogSwitcher({
  dogs,
  activeId,
  onSelect,
}: {
  dogs: SessionDog[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.switcher}>
      {dogs.map((d) => {
        const active = d.id === activeId;
        return (
          <Pressable
            key={d.id}
            onPress={() => onSelect(d.id)}
            style={[styles.switcherPill, active && styles.switcherPillActive]}
          >
            <Avatar uri={d.photo} name={d.name} size={24} />
            <Text style={[styles.switcherLabel, active && styles.switcherLabelActive]}>{d.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingVertical: 20,
    gap: 20,
  },
  switcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: H_PADDING,
  },
  switcherPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switcherPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  switcherLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paper,
  },
  switcherLabelActive: {
    color: colors.accentInk,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingHorizontal: H_PADDING,
  },
  stats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.paperDim,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.paper,
  },
  nameBlock: {
    paddingHorizontal: H_PADDING,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: H_PADDING,
  },
  actionsCol: {
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.paper,
  },
  breed: {
    marginTop: 2,
    fontSize: 14,
    color: colors.paperDim,
  },
  section: {
    paddingHorizontal: H_PADDING,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  sessionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 16,
    gap: 12,
  },
  sessionRow: {
    flexDirection: "row",
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sessionText: {
    flex: 1,
    gap: 1,
  },
  sessionKind: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.paper,
  },
  sessionWhen: {
    fontSize: 13,
    color: "rgba(245,242,234,0.8)",
  },
  sessionLocation: {
    fontSize: 12,
    color: colors.paperDim,
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
  },
});
