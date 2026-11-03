import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Appear } from "@/components/appear";
import { PageTitle } from "@/components/page-title";
import { RefreshControl } from "@/components/refresh-control";
import { DayGroup, SessionCard } from "@/components/schedule/session-card";
import { LoadingState, Tag } from "@/components/ui";
import { formatSessionDate, getWeekSchedule, nextDates, spacesLeft } from "@/data/schedule";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const DAYS_AHEAD = 14;

/** Every Full Day Training day for the next two weeks, with the dogs booked on each. */
export function TrainerSchedule() {
  const { data: week, error, reload } = useAsync(getWeekSchedule);
  const [refreshing, setRefreshing] = useState(false);
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  if (!week) return <LoadingState error={error ? "Could not load the schedule." : null} />;

  // TODO(backend): alternating-week parity + one-off moves (the website's dogsForDate simplifies these too).
  const days = nextDates(DAYS_AHEAD)
    .map(({ iso, day }) => ({ iso, schedule: week.find((d) => d.day === day) }))
    .filter((d) => d.schedule && d.schedule.capacity > 0);

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
      <PageTitle title="Schedule" subtitle={`Every Full Day Training day for the next ${DAYS_AHEAD} days and the dogs booked on it.`} style={{ marginBottom: -4 }} />
      {days.map(({ iso, schedule }, i) => {
        const s = schedule!;
        const spaces = spacesLeft(s);
        return (
          <Appear key={iso} index={i}>
            <DayGroup heading={formatSessionDate(iso)}>
              <SessionCard
                title="Full Day Training"
                detail={`${s.dogs.length} of ${s.capacity} booked · ${spaces === 0 ? "Full" : `${spaces} space${spaces === 1 ? "" : "s"} left`}`}
                tag={i === 0 ? "Next" : undefined}
                highlight={i === 0}
              >
                {s.dogs.length > 0 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {s.dogs.map((dog) => (
                      <View key={dog.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 }}>
                        <AvatarCircle name={dog.name} avatarUrl={dog.photo} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{dog.name}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{dog.ownerName}</Text>
                        </View>
                        {dog.cadence === "alternating" && <Tag label={`Alt · wk ${dog.weekParity}`} />}
                        {dog.status === "held" && <Tag label="Held" tone={colors.warning} />}
                      </View>
                    ))}
                  </View>
                )}
              </SessionCard>
            </DayGroup>
          </Appear>
        );
      })}
    </ScrollView>
  );
}
