import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar, Card, EmptyState, Loading, Pill } from "@/components/ui";
import { DAYS, getWeekSchedule, spacesLeft, todayDayId, type DayId } from "@/data/schedule";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

export function TrainerSchedule() {
  const { data: week, loading, reload } = useAsync(getWeekSchedule);
  const [day, setDay] = useState<DayId>(todayDayId());

  if (!week) return <Loading />;
  const selected = week.find((d) => d.day === day) ?? { day, capacity: 0, dogs: [] };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {DAYS.map((d) => {
          const sched = week.find((w) => w.day === d.id);
          const active = d.id === day;
          return (
            <Pressable
              key={d.id}
              onPress={() => {
                Haptics.selectionAsync();
                setDay(d.id);
              }}
              style={[styles.dayChip, active && styles.dayChipActive]}
            >
              <Text style={[styles.dayShort, active && styles.dayTextActive]}>{d.short}</Text>
              <Text style={[styles.dayCount, active && styles.dayTextActive]}>{sched ? sched.dogs.length : "–"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.summary}>
        {selected.capacity ? `${selected.dogs.length} of ${selected.capacity} booked · ${spacesLeft(selected)} spaces left` : "Closed"}
      </Text>

      {selected.dogs.length === 0 ? <EmptyState title="No dogs booked" /> : null}
      {selected.dogs.map((dog) => (
        <Card key={dog.id} style={styles.dog}>
          <Avatar uri={dog.photo} name={dog.name} size={48} />
          <View style={styles.dogText}>
            <Text style={styles.dogName}>{dog.name}</Text>
            <Text style={styles.owner}>{dog.ownerName}</Text>
          </View>
          <View style={styles.tags}>
            {dog.cadence === "alternating" ? <Pill label={`Alt · Wk ${dog.weekParity}`} /> : null}
            {dog.status === "held" ? <Pill label="Held" tone="warn" /> : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { gap: space.sm },
  dayChip: { width: 56, paddingVertical: 10, borderRadius: radius.md, borderCurve: "continuous", backgroundColor: colors.inkRaised, alignItems: "center", gap: 2 },
  dayChipActive: { backgroundColor: colors.accent },
  dayShort: { color: colors.paperDim, fontSize: 13, fontWeight: "600" },
  dayCount: { color: colors.paper, fontSize: 18, fontWeight: "800" },
  dayTextActive: { color: colors.accentInk },
  summary: { color: colors.paperDim, fontSize: 14 },
  dog: { flexDirection: "row", alignItems: "center", gap: space.md },
  dogText: { flex: 1 },
  dogName: { color: colors.paper, fontSize: 17, fontWeight: "600" },
  owner: { color: colors.paperDim, fontSize: 14 },
  tags: { gap: 4, alignItems: "flex-end" },
});
