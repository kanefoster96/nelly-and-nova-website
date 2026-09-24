import { useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";

import { DayGroup, SessionCard } from "@/components/schedule/session-card";
import { LoadingState } from "@/components/ui";
import { getDogProfile } from "@/data/reports";
import { formatSessionDate, upcomingSessions } from "@/data/schedule";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

export function MemberSchedule() {
  const { data: dog, error, reload } = useAsync(getDogProfile);
  const [refreshing, setRefreshing] = useState(false);

  if (!dog) return <LoadingState error={error ? "Could not load your schedule." : null} />;

  const sessions = dog.plan ? upcomingSessions(dog.plan, new Date()) : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
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
      {!dog.plan ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>No regular sessions yet — once you&apos;re booked in they&apos;ll show here.</Text>
      ) : (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            {dog.name} · {dog.plan.service} {dog.plan.cadence === "alternating" ? "every other" : "every"} {dog.plan.day.replace(/s$/, "")}.
            {dog.plan.note ? ` ${dog.plan.note}.` : ""}
          </Text>
          {sessions.map((iso, i) => (
            <DayGroup key={iso} heading={formatSessionDate(iso)}>
              <SessionCard title={dog.plan!.service} detail={`${dog.name}${dog.plan!.note ? ` · ${dog.plan!.note}` : ""}`} tag={i === 0 ? "Next" : "Yours"} highlight={i === 0} />
            </DayGroup>
          ))}
        </>
      )}
    </ScrollView>
  );
}
