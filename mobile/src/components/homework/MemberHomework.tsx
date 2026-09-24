import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, Loading, Muted, Pill, SectionTitle } from "@/components/ui";
import { formatDate } from "@/data/inbox";
import { getReportCards, logHomeworkDay, type ReportCard } from "@/data/reports";
import { useAsync } from "@/lib/useAsync";
import { colors, space } from "@/theme";

const today = () => new Date().toISOString().slice(0, 10);

function HomeworkList({ card }: { card: ReportCard }) {
  return (
    <>
      {card.homework.map((cat) => (
        <View key={cat.id} style={styles.category}>
          <Text style={styles.categoryName}>{cat.name}</Text>
          {cat.drills.map((d) => (
            <View key={d.id} style={styles.drill}>
              <SymbolView name={{ ios: "circle.fill", android: "circle" }} tintColor={colors.paperDim} size={6} />
              <Text style={styles.drillText}>{d.name}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

export function MemberHomework() {
  const { data: cards, loading, reload } = useAsync(getReportCards);
  // TODO(backend): read today's completion from homework_completions.
  const [loggedOn, setLoggedOn] = useState<Record<string, string>>({});

  if (!cards) return <Loading />;
  if (cards.length === 0)
    return <EmptyState title="No homework yet" body="Your trainer's report card after each session will appear here." />;

  const [latest, ...earlier] = cards;
  const doneToday = loggedOn[latest.id] === today();

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.date}>{formatDate(latest.date)}</Text>
          {latest.isNew ? <Pill label="New" tone="accent" /> : null}
        </View>
        <Text style={styles.focus}>{latest.focus}</Text>
        <Muted>{latest.summary}</Muted>
        {latest.wins.length ? (
          <View style={styles.wins}>
            {latest.wins.map((w) => (
              <View key={w} style={styles.drill}>
                <SymbolView name={{ ios: "checkmark", android: "check" }} tintColor={colors.paper} size={14} />
                <Text style={styles.drillText}>{w}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionTitle>This week's homework</SectionTitle>
      <Card>
        <HomeworkList card={latest} />
        <Button
          label={doneToday ? "Practised today ✓" : "I practised today"}
          disabled={doneToday}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLoggedOn((s) => ({ ...s, [latest.id]: today() }));
            logHomeworkDay(latest.id, today());
          }}
        />
      </Card>

      {earlier.length ? <SectionTitle>Earlier report cards</SectionTitle> : null}
      {earlier.map((card) => (
        <Card key={card.id}>
          <Text style={styles.date}>{formatDate(card.date)}</Text>
          <Text style={styles.focusSmall}>{card.focus}</Text>
          <HomeworkList card={card} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { color: colors.paperDim, fontSize: 13, fontWeight: "600" },
  focus: { color: colors.paper, fontSize: 22, fontWeight: "800" },
  focusSmall: { color: colors.paper, fontSize: 17, fontWeight: "700" },
  wins: { gap: 6, paddingTop: space.xs },
  category: { gap: 6 },
  categoryName: { color: colors.paper, fontSize: 16, fontWeight: "700" },
  drill: { flexDirection: "row", alignItems: "center", gap: space.sm },
  drillText: { color: colors.paper, fontSize: 15, flex: 1 },
});
