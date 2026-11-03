import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { GlassButton } from "@/components/glass-button";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { EntryTags, KIND_COLOR } from "@/components/trainer/entry-row";
import { LoadingState, Tag } from "@/components/ui";
import { DAY_CAPACITY } from "@/data/sessions";
import {
  addDays,
  entryTitle,
  formatDay,
  getTrainerCalendar,
  groupByDate,
  isFullDay,
  isWeekday,
  MAX_CALENDAR_DAYS,
  nextWeekday,
  todayISO,
  type CalendarEntry,
} from "@/data/trainer-schedule";
import { hapticSelection } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

/** How far ahead it shows at first, and how much more each "Show more" adds. */
const PAGE_DAYS = 56;

type Filter = "all" | "full" | "one_to_one" | "meet_greet";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "full", label: "Full days" },
  { value: "one_to_one", label: "1-1s" },
  { value: "meet_greet", label: "Meet & greets" },
];

function matches(e: CalendarEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "full") return isFullDay(e);
  return e.kind === filter;
}

/** The filter row: a pill per view, the chosen one filled (Kanvas's SlidingChoice, as plain pills). */
function FilterRow({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {FILTERS.map((f) => {
        const on = f.value === value;
        return (
          <Pressable
            key={f.value}
            onPress={() => {
              hapticSelection();
              onChange(f.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: on ? colors.accent : colors.border,
              backgroundColor: on ? colors.accent : "transparent",
            }}
          >
            <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 13, fontWeight: "700" }}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A day on the calendar, as one card: its dogs, then any 1-1s and meet & greets. Tap to open the day. */
function DayCard({ date, entries, onOpen }: { date: string; entries: CalendarEntry[]; onOpen: () => void }) {
  const dogs = entries.filter(isFullDay);
  const others = entries.filter((e) => !isFullDay(e));
  const weekday = isWeekday(date);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${formatDay(date)}: open`}
      style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10 }}
    >
      {weekday && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="paw-outline" size={15} color={dogs.length ? KIND_COLOR.full_day : colors.muted} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", flex: 1 }}>Full Day Training</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{dogs.length === 0 ? "Tap to add a dog" : `${dogs.length}/${DAY_CAPACITY} dogs`}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.muted} />
          </View>
          {dogs.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {dogs.map((e) => {
                const held = !e.dogId;
                const oneOff = e.kind === "full_day_one_off";
                const tone = held ? colors.warning : oneOff ? KIND_COLOR.full_day_one_off : null;
                return (
                  <View
                    key={`${e.kind}-${e.refId}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor: tone ? `${tone}80` : colors.border,
                      backgroundColor: tone ? `${tone}14` : "transparent",
                      borderRadius: 999,
                      paddingLeft: 3,
                      paddingRight: 10,
                      paddingVertical: 3,
                    }}
                  >
                    <AvatarCircle name={entryTitle(e)} avatarUrl={e.dogPhoto} size={22} />
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                      {entryTitle(e)}
                      {oneOff ? " · one-off" : held ? " · awaiting" : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
      {others.map((e) => (
        <View key={`${e.kind}-${e.refId}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", ...(weekday ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 } : null) }}>
          <Ionicons name={e.kind === "meet_greet" ? "hand-left-outline" : "person-outline"} size={15} color={KIND_COLOR[e.kind]} />
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
            {entryTitle(e)}
            {e.kind === "meet_greet" && e.dogName ? <Text style={{ color: colors.muted, fontWeight: "400" }}>{` · ${e.dogName}`}</Text> : null}
          </Text>
          <EntryTags entry={e} />
        </View>
      ))}
    </Pressable>
  );
}

/**
 * Trainer: the full calendar, day by day as the Kanvas coach's Full
 * Calendar runs — every weekday (Full Day Training, regular dogs and
 * one-offs), plus 1-1s and meet & greets on any day, each kind with its own
 * tag. Tap a day to open it: its list, and Add new dog / Add a 1-1 there.
 */
export default function CalendarScreen() {
  const router = useRouter();
  const today = todayISO();
  const [days, setDays] = useState(PAGE_DAYS);
  const [entries, setEntries] = useState<Map<string, CalendarEntry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  // How many days are showing, for the reload on coming back to the page.
  const daysRef = useRef(days);
  daysRef.current = days;

  const load = useCallback(
    async (count: number) => {
      setError(null);
      try {
        setEntries(groupByDate(await getTrainerCalendar(today, addDays(today, count - 1))));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the calendar.");
      }
    },
    [today],
  );

  useFocusEffect(
    useCallback(() => {
      // Again on coming back from a day: something may have been added or taken off.
      load(daysRef.current);
    }, [load]),
  );

  async function showMore() {
    const next = Math.min(days + PAGE_DAYS, MAX_CALENDAR_DAYS);
    setLoadingMore(true);
    await load(next);
    setDays(next);
    setLoadingMore(false);
  }

  const header = (
    <ScreenHeader
      title="Calendar"
      right={
        <GlassButton
          onPress={() => router.push({ pathname: "/day/[date]", params: { date: nextWeekday(today) } })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add a dog"
        >
          <Ionicons name="add" size={22} color={colors.foreground} />
        </GlassButton>
      }
    />
  );

  if (!entries) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <LoadingState error={error} />
      </View>
    );
  }

  const dates = Array.from({ length: days }, (_, i) => addDays(today, i))
    .map((date) => ({ date, list: (entries.get(date) ?? []).filter((e) => matches(e, filter)) }))
    // Weekdays always (a day to add dogs to), when it's their kind on show; the weekend only with something on.
    .filter(({ date, list }) => list.length > 0 || (isWeekday(date) && (filter === "all" || filter === "full")));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48, gap: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(days);
              setRefreshing(false);
            }}
            tintColor={colors.foreground}
          />
        }
      >
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: 20 }}>
          Every Full Day Training day, one-off, 1-1 and meet & greet for the next {days} days. Tap a day to see it, add a dog or a 1-1, or take one off.
        </Text>
        <FilterRow value={filter} onChange={setFilter} />
        {error && <Text style={{ color: colors.danger, paddingHorizontal: 20 }}>{error}</Text>}

        {dates.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>Nothing on the calendar for the next {days} days.</Text>}

        {dates.map(({ date, list }, i) => (
          <Appear key={date} index={i} style={{ gap: 8, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{formatDay(date)}</Text>
              {date === today && <Tag label="Today" tone={colors.success} />}
            </View>
            <DayCard date={date} entries={list} onOpen={() => router.push({ pathname: "/day/[date]", params: { date } })} />
          </Appear>
        ))}

        {days < MAX_CALENDAR_DAYS && (
          <Pressable
            onPress={showMore}
            disabled={loadingMore}
            style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 }}
          >
            {loadingMore ? <ActivityIndicator color={colors.foreground} size="small" /> : <Ionicons name="chevron-down" size={16} color={colors.foreground} />}
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Show the next {Math.min(PAGE_DAYS, MAX_CALENDAR_DAYS - days)} days</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
