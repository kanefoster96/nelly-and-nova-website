import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Card, EmptyState, Loading, Muted, SectionTitle } from "@/components/ui";
import { getDogProfile } from "@/data/reports";
import { formatSessionDate, upcomingSessions } from "@/data/schedule";
import { useAsync } from "@/lib/useAsync";
import { colors, space } from "@/theme";

export function MemberSchedule() {
  const { data: dog, loading, reload } = useAsync(getDogProfile);

  if (!dog) return <Loading />;
  if (!dog.plan) return <EmptyState title="No regular sessions yet" body="Once you're booked in, your sessions will show here." />;

  const sessions = upcomingSessions(dog.plan, new Date());

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <Text style={styles.service}>{dog.plan.service}</Text>
        <Text style={styles.day}>
          {dog.name} · {dog.plan.cadence === "alternating" ? "Every other " : "Every "}
          {dog.plan.day.replace(/s$/, "")}
        </Text>
        {dog.plan.note ? <Muted>{dog.plan.note}</Muted> : null}
      </Card>

      <SectionTitle>Upcoming sessions</SectionTitle>
      <Card>
        {sessions.map((iso, i) => (
          <View key={iso} style={[styles.row, i > 0 && styles.divider]}>
            <SymbolView name={{ ios: "calendar", android: "event" }} tintColor={i === 0 ? colors.paper : colors.paperDim} size={18} />
            <Text style={[styles.date, i === 0 && styles.next]}>{formatSessionDate(iso)}</Text>
            {i === 0 ? <Text style={styles.nextLabel}>Next</Text> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  service: { color: colors.paper, fontSize: 22, fontWeight: "800" },
  day: { color: colors.paper, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  date: { color: colors.paperDim, fontSize: 16, flex: 1 },
  next: { color: colors.paper, fontWeight: "700" },
  nextLabel: { color: colors.paper, fontSize: 13, fontWeight: "600" },
});
