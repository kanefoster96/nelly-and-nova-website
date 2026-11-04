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
import { AvatarCircle } from "@/components/avatar-circle";
import { Tag } from "@/components/ui";
import { countPendingRequests, countUnpaid, DAY_CAPACITY, listRequests, requestsForDate, type SessionRequest } from "@/data/sessions";
import {
  addDays,
  formatDay,
  formatWeekRange,
  getTrainerCalendar,
  groupByDate,
  isFullDay,
  entryTitle,
  isWeekday,
  mondayOf,
  todayISO,
  type CalendarEntry,
} from "@/data/trainer-schedule";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSelection } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

/** This week's Monday, or next week's at the weekend (the week coming up is the one to see). */
function startingMonday(today: string): string {
  return isWeekday(today) ? mondayOf(today) : mondayOf(addDays(today, 2));
}

function dogCountLine(entries: CalendarEntry[], requests: number): string {
  const dogs = entries.filter(isFullDay);
  const oneOffs = dogs.filter((e) => e.kind === "full_day_one_off").length;
  const held = dogs.filter((e) => !e.dogId).length;
  const ones = entries.filter((e) => e.kind === "one_to_one").length;
  const meets = entries.filter((e) => e.kind === "meet_greet").length;
  const parts = [dogs.length === 0 ? "No dogs booked" : `${dogs.length} dog${dogs.length === 1 ? "" : "s"}`];
  if (oneOffs) parts.push(`${oneOffs} one-off`);
  if (held) parts.push(`${held} awaiting registration`);
  if (ones) parts.push(`${ones} 1-1${ones === 1 ? "" : "s"}`);
  if (meets) parts.push(`${meets} meet & greet${meets === 1 ? "" : "s"}`);
  if (requests) parts.push(`${requests} request${requests === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** The day's Full Day dogs as a row of overlapping photos, then their names. */
function DogFaces({ entries }: { entries: CalendarEntry[] }) {
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 6);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      <View style={{ flexDirection: "row" }}>
        {shown.map((e, i) => (
          <View key={`${e.kind}-${e.refId}`} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 15, borderWidth: 2, borderColor: colors.surface }}>
            <AvatarCircle name={entryTitle(e)} avatarUrl={e.dogPhoto} size={26} />
          </View>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
        {entries.map(entryTitle).join(", ")}
      </Text>
    </View>
  );
}

/**
 * Trainer: the Week tab (the file keeps its old name, so /registers links
 * still land here). Full Day Training, Monday to Friday, as Kanvas's
 * Registers tab lists a coach's week: one card per day with how many dogs
 * are in (regular places and one-offs), their faces and names, and what
 * else is on (1-1s, meet & greets, requests). A tap opens the day's page to
 * add or remove; the arrows move a week at a time. The day itself — runs,
 * the register, reports — is on Today.
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
  const [entries, setEntries] = useState<Map<string, CalendarEntry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Requests waiting, sessions to charge, and the open requests by date (shown faded on their day).
  const [waiting, setWaiting] = useState<{ requests: number; unpaid: number }>({ requests: 0, unpaid: 0 });
  const [openRequests, setOpenRequests] = useState<SessionRequest[]>([]);
  // The week a load is for, so a slow one for a week left behind doesn't land.
  const loadingFor = useRef(monday);

  const load = useCallback(async (week: string) => {
    loadingFor.current = week;
    setError(null);
    try {
      const [rows, requests, unpaid, open] = await Promise.all([
        getTrainerCalendar(week, addDays(week, 4)),
        countPendingRequests().catch(() => 0),
        countUnpaid().catch(() => 0),
        listRequests({ open: true, withOwners: true }).catch(() => [] as SessionRequest[]),
      ]);
      if (loadingFor.current !== week) return;
      setEntries(groupByDate(rows));
      setWaiting({ requests, unpaid });
      setOpenRequests(open);
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
        <PageTitle title="Week" subtitle="Full Day Training, Monday to Friday. Tap a day to open it." style={{ marginBottom: 14 }} />

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

        {/* Requests: always the first thing a trainer sees (Kanvas's staff request cards). */}
        <Pressable
          onPress={() => router.push("/requests")}
          accessibilityRole="button"
          accessibilityLabel={`Requests, ${waiting.requests} waiting`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            ...GLASS_BORDER,
            ...(waiting.requests ? { borderColor: "rgba(245,158,11,0.45)" } : null),
            backgroundColor: waiting.requests ? "rgba(245,158,11,0.06)" : colors.surface,
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: waiting.requests ? "rgba(245,158,11,0.18)" : "rgba(245,245,242,0.08)" }}>
            <Text style={{ color: waiting.requests ? colors.warning : colors.foreground, fontSize: 19, fontWeight: "800" }}>{waiting.requests}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>Requests</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              {waiting.requests ? `${waiting.requests} waiting for you` : "Nothing waiting"}
              {waiting.unpaid ? ` · ${waiting.unpaid} unpaid session${waiting.unpaid === 1 ? "" : "s"}` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
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
            const asked = requestsForDate(openRequests, date).length;
            const isToday = date === today;
            return (
              <Appear key={date} index={i}>
                <Pressable
                  onPress={() => router.push({ pathname: "/day/[date]", params: { date } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDay(date)}: ${entries ? dogCountLine(list, asked) : "loading"}. Open the day`}
                  style={{
                    borderWidth: 1,
                    ...GLASS_BORDER,
                    ...(isToday ? { borderColor: "rgba(34,197,94,0.45)" } : null),
                    backgroundColor: isToday ? "rgba(34,197,94,0.06)" : colors.surface,
                    borderRadius: 20,
                    padding: 16,
                    opacity: date < today ? 0.75 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                        <Text style={{ color: dogs.length >= DAY_CAPACITY ? colors.danger : isToday ? colors.success : colors.foreground, fontSize: 16, fontWeight: "800" }}>
                          {dogs.length}/{DAY_CAPACITY}
                        </Text>
                      ) : (
                        <ActivityIndicator color={colors.muted} size="small" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{formatDay(date)}</Text>
                        {isToday && <Tag label="Today" tone={colors.success} />}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                        {entries ? dogCountLine(list, asked) : "Loading…"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </View>
                  {entries && <DogFaces entries={dogs} />}
                </Pressable>
              </Appear>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
