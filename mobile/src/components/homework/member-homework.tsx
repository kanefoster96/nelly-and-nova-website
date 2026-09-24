import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { LoadingState, PrimaryButton, SectionLabel, Tag } from "@/components/ui";
import { formatDate } from "@/data/inbox";
import { getReportCards, logHomeworkDay, type ReportCard } from "@/data/reports";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const today = () => new Date().toISOString().slice(0, 10);

const card = { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 14 } as const;

function HomeworkList({ report }: { report: ReportCard }) {
  return (
    <View style={{ gap: 12 }}>
      {report.homework.map((cat) => (
        <View key={cat.id} style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{cat.name}</Text>
          {cat.drills.map((d) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Ionicons name="ellipse-outline" size={14} color={colors.muted} style={{ marginTop: 2 }} />
              <Text style={{ color: colors.muted, fontSize: 13, flex: 1, lineHeight: 18 }}>{d.name}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Member: the latest report card, this week's homework, and earlier cards. */
export function MemberHomework() {
  const { data: cards, error, reload } = useAsync(getReportCards);
  const [refreshing, setRefreshing] = useState(false);
  // TODO(backend): read today's completion from homework_completions.
  const [loggedOn, setLoggedOn] = useState<Record<string, string>>({});

  if (!cards) return <LoadingState error={error ? "Could not load your homework." : null} />;

  if (cards.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Homework</Text>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", marginTop: 8 }}>Nothing yet</Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>Your trainer&apos;s report card after each session will appear here.</Text>
      </View>
    );
  }

  const [latest, ...earlier] = cards;
  const doneToday = loggedOn[latest.id] === today();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
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
      <View style={card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>Report card · {formatDate(latest.date)}</Text>
          {latest.isNew && <Tag label="New" solid />}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginTop: 6 }}>{latest.focus}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{latest.summary}</Text>
        {latest.wins.length > 0 && (
          <View style={{ gap: 6, marginTop: 12 }}>
            {latest.wins.map((w) => (
              <View key={w} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, lineHeight: 18 }}>{w}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SectionLabel>This week&apos;s homework</SectionLabel>
      <View style={[card, { gap: 16 }]}>
        <HomeworkList report={latest} />
        <PrimaryButton
          title={doneToday ? "Practised today ✓" : "I practised today"}
          disabled={doneToday}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLoggedOn((s) => ({ ...s, [latest.id]: today() }));
            logHomeworkDay(latest.id, today());
          }}
        />
      </View>

      {earlier.length > 0 && <SectionLabel>Earlier report cards</SectionLabel>}
      <View style={{ gap: 10 }}>
        {earlier.map((report) => (
          <View key={report.id} style={[card, { gap: 10 }]}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDate(report.date)}</Text>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 2 }}>{report.focus}</Text>
            </View>
            <HomeworkList report={report} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
