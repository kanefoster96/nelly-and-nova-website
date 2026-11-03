import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { PageTitle } from "@/components/page-title";
import { RefreshControl } from "@/components/refresh-control";
import { CARD, LoadingState, PrimaryButton, SectionLabel, Tag } from "@/components/ui";
import { formatDate } from "@/data/inbox";
import { getReportCards, logHomeworkDay, type ReportCard } from "@/data/reports";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSuccess } from "@/lib/haptics";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const today = () => new Date().toISOString().slice(0, 10);

const card = CARD;

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
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  if (!cards) return <LoadingState error={error ? "Could not load your homework." : null} />;

  if (cards.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topInset + 8, paddingHorizontal: 20 }}>
        <PageTitle title="Homework" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12, paddingBottom: barInset }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>Nothing yet</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>Your trainer&apos;s report card after each session will appear here.</Text>
        </View>
      </View>
    );
  }

  const [latest, ...earlier] = cards;
  const doneToday = loggedOn[latest.id] === today();

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
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
      <PageTitle title="Homework" style={{ marginBottom: 16 }} />
      <Appear style={card}>
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
      </Appear>

      <SectionLabel>This week&apos;s homework</SectionLabel>
      <Appear index={1} style={[card, { gap: 16 }]}>
        <HomeworkList report={latest} />
        <PrimaryButton
          title={doneToday ? "Practised today ✓" : "I practised today"}
          disabled={doneToday}
          onPress={() => {
            hapticSuccess();
            setLoggedOn((s) => ({ ...s, [latest.id]: today() }));
            logHomeworkDay(latest.id, today());
          }}
        />
      </Appear>

      {earlier.length > 0 && <SectionLabel>Earlier report cards</SectionLabel>}
      <View style={{ gap: 10 }}>
        {earlier.map((report, i) => (
          <Appear key={report.id} index={i + 2} style={[card, { gap: 10 }]}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDate(report.date)}</Text>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 2 }}>{report.focus}</Text>
            </View>
            <HomeworkList report={report} />
          </Appear>
        ))}
      </View>
    </ScrollView>
  );
}
