import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, GroupHeading } from "@/components/trainer/cards";
import { EntryRow } from "@/components/trainer/entry-row";
import { LoadingState } from "@/components/ui";
import {
  cancelBooking,
  endRegularPlace,
  entryTitle,
  formatDay,
  formatShortDay,
  getTrainerCalendar,
  isFullDay,
  pluralDay,
  todayISO,
  weekdayOf,
  addDays,
  type CalendarEntry,
} from "@/data/trainer-schedule";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

function Section({ children }: { children: React.ReactNode }) {
  return <View style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 }}>{children}</View>;
}

/**
 * Trainer: one day on the calendar — the dogs in for Full Day Training
 * (regular and one-off), its 1-1s and meet & greets — with Add new dog
 * (a registered dog, or Send onboarding for a meet & greet request) and Add
 * a 1-1. The × on a row takes it off: a one-off or a 1-1 is cancelled; a
 * regular place ends the day before, after a confirm.
 */
export default function DayScreen() {
  const router = useRouter();
  const { date: param } = useLocalSearchParams<{ date: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(param)) ? String(param) : todayISO();
  const weekday = weekdayOf(date);
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await getTrainerCalendar(date, date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this day.");
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
      hapticSuccess();
      animateListChange();
      await load();
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function askRemove(e: CalendarEntry) {
    const name = entryTitle(e);
    const key = `${e.kind}-${e.refId}`;
    hapticWarning();
    if (e.kind === "full_day") {
      Alert.alert(
        `Take ${name} off ${weekday ? pluralDay(weekday) : "this day"}?`,
        `This ends their regular place: their last day is ${formatShortDay(addDays(date, -1))}, and they won't be on from ${formatShortDay(date)} on.`,
        [
          { text: "Keep", style: "cancel" },
          { text: "End regular place", style: "destructive", onPress: () => run(key, () => endRegularPlace(e.refId, date)) },
        ],
      );
      return;
    }
    const what = e.kind === "one_to_one" ? "1-1" : "one-off day";
    Alert.alert(`Cancel ${name}'s ${what}?`, `It comes off ${formatDay(date)}.`, [
      { text: "Keep", style: "cancel" },
      { text: `Cancel ${what}`, style: "destructive", onPress: () => run(key, () => cancelBooking(e.refId)) },
    ]);
  }

  function removeButton(e: CalendarEntry) {
    const key = `${e.kind}-${e.refId}`;
    return (
      <Pressable
        onPress={() => askRemove(e)}
        disabled={busy !== null}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${entryTitle(e)}`}
        style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,245,242,0.06)" }}
      >
        {busy === key ? <ActivityIndicator size="small" color={colors.muted} /> : <Ionicons name="close" size={18} color={colors.muted} />}
      </Pressable>
    );
  }

  const openDog = (e: CalendarEntry) => (e.dogId ? () => router.push({ pathname: "/dog/[id]", params: { id: e.dogId! } }) : undefined);

  const dogs = entries?.filter(isFullDay) ?? [];
  const ones = entries?.filter((e) => e.kind === "one_to_one") ?? [];
  const meets = entries?.filter((e) => e.kind === "meet_greet") ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={formatDay(date)}
        subtitle={entries ? (weekday ? `${dogs.length} dog${dogs.length === 1 ? "" : "s"} at Full Day Training` : "No Full Day Training at the weekend") : null}
      />
      {!entries ? (
        <LoadingState error={error} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.foreground}
            />
          }
        >
          {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

          <Appear index={0} style={{ gap: 10, marginTop: 4 }}>
            {weekday && (
              <BigButton icon="add" label="Add new dog" onPress={() => router.push({ pathname: "/add-dog", params: { date, mode: "dog" } })} />
            )}
            <BigButton icon="time-outline" label="Add a 1-1" variant="outline" onPress={() => router.push({ pathname: "/add-dog", params: { date, mode: "one_to_one" } })} />
          </Appear>

          {weekday && (
            <Appear index={1}>
              <GroupHeading>Full Day Training</GroupHeading>
              <Section>
                {dogs.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 14, paddingVertical: 14 }}>No dogs booked in yet.</Text>
                ) : (
                  dogs.map((e, i) => <EntryRow key={`${e.kind}-${e.refId}`} entry={e} first={i === 0} onPress={openDog(e)} trailing={removeButton(e)} />)
                )}
              </Section>
            </Appear>
          )}

          {ones.length > 0 && (
            <Appear index={2}>
              <GroupHeading>1-1s</GroupHeading>
              <Section>
                {ones.map((e, i) => (
                  <EntryRow key={e.refId} entry={e} first={i === 0} onPress={openDog(e)} trailing={removeButton(e)} />
                ))}
              </Section>
            </Appear>
          )}

          {meets.length > 0 && (
            <Appear index={3}>
              <GroupHeading>Meet & greets</GroupHeading>
              <Section>
                {meets.map((e, i) => (
                  <EntryRow
                    key={e.refId}
                    entry={e}
                    first={i === 0}
                    trailing={
                      weekday ? (
                        <Pressable
                          onPress={() => router.push({ pathname: "/add-dog", params: { date, mode: "dog", enquiry: e.refId } })}
                          accessibilityRole="button"
                          accessibilityLabel={`Send onboarding to ${entryTitle(e)}`}
                          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>Onboard</Text>
                        </Pressable>
                      ) : undefined
                    }
                  />
                ))}
              </Section>
              {weekday && (
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                  Onboard sends them the join link and holds a place on {pluralDay(weekday)} from this date; their dog's name fills in once they register.
                </Text>
              )}
            </Appear>
          )}
        </ScrollView>
      )}
    </View>
  );
}
