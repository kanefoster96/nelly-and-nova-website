import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { GlassButton } from "@/components/glass-button";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { EntryRow } from "@/components/trainer/entry-row";
import { Tag } from "@/components/ui";
import {
  addDays,
  formatDay,
  formatWeekRange,
  getTrainerCalendar,
  groupByDate,
  isFullDay,
  isWeekday,
  mondayOf,
  todayISO,
  type CalendarEntry,
} from "@/data/trainer-schedule";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

/** This week's Monday, or next week's at the weekend (the week coming up is the one to see). */
function startingMonday(today: string): string {
  return isWeekday(today) ? mondayOf(today) : mondayOf(addDays(today, 2));
}

function dogCountLine(entries: CalendarEntry[]): string {
  const dogs = entries.filter(isFullDay);
  const oneOffs = dogs.filter((e) => e.kind === "full_day_one_off").length;
  const held = dogs.filter((e) => !e.dogId).length;
  const ones = entries.filter((e) => e.kind === "one_to_one").length;
  const parts = [dogs.length === 0 ? "No dogs booked" : `${dogs.length} dog${dogs.length === 1 ? "" : "s"}`];
  if (oneOffs) parts.push(`${oneOffs} one-off`);
  if (held) parts.push(`${held} awaiting registration`);
  if (ones) parts.push(`${ones} 1-1${ones === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * Trainer: Full Day Training, Monday to Friday, as Kanvas's Registers tab
 * lists a coach's week. One card per day with how many dogs are in (regular
 * places and one-offs); today's is open with each dog — photo, name, owner —
 * and a tap opens the dog. Any other day opens with a tap; the arrows move
 * a week at a time. "Open day" goes to the day's page to add or remove dogs.
 */
export default function RegistersScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const barInset = useBarInset();
  const barScroll = useBarScroll();
  const topInset = useTopBarInset();

  const today = todayISO();
  const thisMonday = startingMonday(today);
  const [monday, setMonday] = useState(thisMonday);
  const [open, setOpen] = useState<Set<string>>(() => new Set([isWeekday(today) ? today : thisMonday]));
  const [entries, setEntries] = useState<Map<string, CalendarEntry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The week a load is for, so a slow one for a week left behind doesn't land.
  const loadingFor = useRef(monday);

  const load = useCallback(async (week: string) => {
    loadingFor.current = week;
    setError(null);
    try {
      const rows = await getTrainerCalendar(week, addDays(week, 4));
      if (loadingFor.current === week) setEntries(groupByDate(rows));
    } catch (err) {
      if (loadingFor.current === week) setError(err instanceof Error ? err.message : "Couldn't load this week.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isTrainer) load(monday);
    }, [isTrainer, load, monday]),
  );

  if (!isTrainer) return <Redirect href="/community" />;

  function moveWeek(by: number) {
    hapticSelection();
    const next = addDays(monday, by * 7);
    setEntries(null);
    setMonday(next);
    // Today opens again on its own week; other weeks start closed.
    setOpen(new Set(next === thisMonday ? [isWeekday(today) ? today : thisMonday] : []));
  }

  function toggle(date: string) {
    hapticSelection();
    animateListChange();
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const weekLabel = monday === mondayOf(today) ? "This week" : monday === addDays(mondayOf(today), 7) ? "Next week" : monday === addDays(mondayOf(today), -7) ? "Last week" : "Week of";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        {...barScroll}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(monday);
              setRefreshing(false);
            }}
            tintColor={colors.foreground}
          />
        }
      >
        <PageTitle title="Registers" subtitle="Full Day Training this week. Tap a day for its dogs, and a dog for its details." style={{ marginBottom: 14 }} />

        <Pressable
          onPress={() => router.push("/calendar")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 1,
            ...GLASS_BORDER,
            backgroundColor: colors.surface,
            borderRadius: 999,
            paddingVertical: 11,
            marginBottom: 20,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>See full calendar</Text>
        </Pressable>

        {/* The week, and the arrows either side of it. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <GlassButton onPress={() => moveWeek(-1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Previous week">
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </GlassButton>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{weekLabel}</Text>
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 2 }}>{formatWeekRange(monday)}</Text>
          </View>
          <GlassButton onPress={() => moveWeek(1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Next week">
            <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
          </GlassButton>
        </View>

        {error && <Text style={{ color: colors.danger, marginBottom: 14 }}>{error}</Text>}

        <View style={{ gap: 10 }}>
          {days.map((date, i) => {
            const list = entries?.get(date) ?? [];
            const dogs = list.filter(isFullDay);
            const expanded = open.has(date);
            const isToday = date === today;
            return (
              <Appear key={date} index={i}>
                <View
                  style={{
                    borderWidth: 1,
                    ...GLASS_BORDER,
                    ...(isToday ? { borderColor: "rgba(34,197,94,0.45)" } : null),
                    backgroundColor: isToday ? "rgba(34,197,94,0.06)" : colors.surface,
                    borderRadius: 20,
                    overflow: "hidden",
                    opacity: date < today ? 0.75 : 1,
                  }}
                >
                  <Pressable
                    onPress={() => toggle(date)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}
                  >
                    {/* The count, big, like Kanvas's class times. */}
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isToday ? "rgba(34,197,94,0.18)" : "rgba(245,245,242,0.08)",
                      }}
                    >
                      {entries ? (
                        <Text style={{ color: isToday ? colors.success : colors.foreground, fontSize: 19, fontWeight: "800" }}>{dogs.length}</Text>
                      ) : (
                        <ActivityIndicator color={colors.muted} size="small" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{formatDay(date)}</Text>
                        {isToday && <Tag label="Today" tone={colors.success} />}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        {entries ? dogCountLine(list) : "Loading…"}
                      </Text>
                    </View>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                  </Pressable>

                  {expanded && entries && (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingBottom: 8 }}>
                      {dogs.length === 0 && <Text style={{ color: colors.muted, fontSize: 14, paddingVertical: 14 }}>No dogs booked in for Full Day Training.</Text>}
                      {dogs.map((e, j) => (
                        <EntryRow
                          key={`${e.kind}-${e.refId}`}
                          entry={e}
                          first={j === 0}
                          onPress={e.dogId ? () => router.push({ pathname: "/dog/[id]", params: { id: e.dogId! } }) : undefined}
                        />
                      ))}
                      {list
                        .filter((e) => !isFullDay(e))
                        .map((e) => (
                          <EntryRow
                            key={`${e.kind}-${e.refId}`}
                            entry={e}
                            onPress={e.dogId ? () => router.push({ pathname: "/dog/[id]", params: { id: e.dogId! } }) : undefined}
                          />
                        ))}
                      <Pressable
                        onPress={() => router.push({ pathname: "/day/[date]", params: { date } })}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Open day · add or remove dogs</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </Appear>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
