import { useState } from "react";
import { ScrollView, Text } from "react-native";

import { MeetGreetCard } from "@/components/meet-greet-card";
import { Appear } from "@/components/appear";
import { PageTitle } from "@/components/page-title";
import { RefreshControl } from "@/components/refresh-control";
import { DayGroup, SessionCard } from "@/components/schedule/session-card";
import { LoadingState } from "@/components/ui";
import { getDogProfile } from "@/data/reports";
import { formatSessionDate, upcomingSessions } from "@/data/schedule";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

export function MemberSchedule() {
  const { data: dog, error, reload } = useAsync(getDogProfile);
  const [refreshing, setRefreshing] = useState(false);
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  if (!dog) return <LoadingState error={error ? "Could not load your schedule." : null} />;

  const sessions = dog.plan ? upcomingSessions(dog.plan, new Date()) : [];

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset, gap: 20 }}
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
      <PageTitle title="Schedule" style={{ marginBottom: -8 }} />
      <MeetGreetCard />
      {!dog.plan ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>No regular sessions yet — once you&apos;re booked in they&apos;ll show here.</Text>
      ) : (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {dog.name} · {dog.plan.service} {dog.plan.cadence === "alternating" ? "every other" : "every"} {dog.plan.day.replace(/s$/, "")}.
            {dog.plan.note ? ` ${dog.plan.note}.` : ""}
          </Text>
          {sessions.map((iso, i) => (
            <Appear key={iso} index={i}>
              <DayGroup heading={formatSessionDate(iso)}>
                <SessionCard title={dog.plan!.service} detail={`${dog.name}${dog.plan!.note ? ` · ${dog.plan!.note}` : ""}`} tag={i === 0 ? "Next" : "Yours"} highlight={i === 0} />
              </DayGroup>
            </Appear>
          ))}
        </>
      )}
    </ScrollView>
  );
}
