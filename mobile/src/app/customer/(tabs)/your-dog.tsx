import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { getCompletedSessionCount, getDogDetail, getDogLevel } from "@/lib/dogs";
import { getLatestReportCard, type ReportCard } from "@/lib/homework";
import { activeDog, setActiveDog, useSession, type SessionDog } from "@/lib/session";
import { colors } from "@/theme/colors";

type DogStats = {
  dogId: string;
  breed: string;
  age: string;
  level: number;
  sessionCount: number;
  latestReportCard: ReportCard | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function YourDogScreen() {
  const session = useSession();
  const dog = activeDog(session);

  const [stats, setStats] = useState<DogStats | null>(null);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    const dogId = dog.id;

    Promise.all([getDogDetail(dogId), getDogLevel(dogId), getCompletedSessionCount(dogId), getLatestReportCard(dogId)]).then(
      ([detail, level, sessionCount, latestReportCard]) => {
        if (cancelled) return;
        setStats({ dogId, breed: detail.breed, age: detail.age, level, sessionCount, latestReportCard });
      }
    );

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest report card</Text>
        {shown?.latestReportCard ? (
          <ReportCardPreview card={shown.latestReportCard} />
        ) : shown ? (
          <Text style={styles.emptyText}>No report cards published yet.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ReportCardPreview({ card }: { card: ReportCard }) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportCardHeader}>
        <Text style={styles.reportCardTitle}>{card.title || "Session report"}</Text>
        {card.sessionDate ? <Text style={styles.reportCardDate}>{formatDate(card.sessionDate)}</Text> : null}
      </View>
      {card.summary ? <Text style={styles.reportCardSummary}>{card.summary}</Text> : null}
      {card.items.slice(0, 3).map((item) => (
        <Text key={item.id} style={styles.reportCardItem}>
          • {item.drillName}
        </Text>
      ))}
      {card.items.length > 3 ? (
        <Text style={styles.reportCardMore}>+{card.items.length - 3} more on the Homework tab</Text>
      ) : null}
    </View>
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
  reportCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 16,
    gap: 6,
  },
  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.paper,
  },
  reportCardDate: {
    fontSize: 12,
    color: colors.paperDim,
  },
  reportCardSummary: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(245,242,234,0.85)",
  },
  reportCardItem: {
    fontSize: 13,
    color: "rgba(245,242,234,0.85)",
  },
  reportCardMore: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
  },
});
