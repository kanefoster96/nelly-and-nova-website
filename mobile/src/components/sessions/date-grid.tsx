import { Text, View } from "react-native";

import { Pressable } from "@/components/pressable";
import { DAY_CAPACITY, plusDays, mondayOf, WEEKDAYS, type Availability, type Weekday } from "@/data/sessions";
import { hapticSelection } from "@/lib/haptics";
import { colors } from "@/theme";

const DOT: Record<string, string> = { green: colors.success, orange: colors.warning };
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Weekdays for the next few weeks, Monday to Friday in columns, with a dot
 * under each: green (room), orange (one space left). A full day is faded
 * and can't be picked (a trainer can still pick it, with `allowFull`, and
 * sees the count). Weekends aren't shown: there's no Full Day Training.
 * One date, up to `max` dates, or (with `range`) a start and an end.
 */
export function DateGrid({
  availability,
  selected,
  onChange,
  after,
  weeks = 6,
  max = 1,
  range = false,
  allowFull = false,
  showCounts = false,
  marked,
}: {
  availability: Availability;
  selected: string[];
  onChange: (dates: string[]) => void;
  /** Only dates after this one (YYYY-MM-DD). */
  after: string;
  weeks?: number;
  max?: number;
  range?: boolean;
  allowFull?: boolean;
  showCounts?: boolean;
  /** Dates to ring (their sessions, say). */
  marked?: Set<string>;
}) {
  const start = mondayOf(plusDays(after, 1));
  const rows = Array.from({ length: weeks }, (_, w) => WEEKDAYS.map((_, i) => plusDays(start, w * 7 + i)));
  const [a, b] = range ? [...selected].sort() : [];

  function tap(date: string) {
    hapticSelection();
    if (range) {
      if (selected.length !== 1) return onChange([date]);
      const [first] = selected;
      return onChange(date === first ? [] : [first, date].sort());
    }
    if (selected.includes(date)) return onChange(selected.filter((d) => d !== date));
    if (max === 1) return onChange([date]);
    if (selected.length >= max) return;
    onChange([...selected, date].sort());
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row" }}>
        {SHORT.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
            {d.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", gap: 6 }}>
          {row.map((date) => {
            const past = date <= after;
            const day = availability[date];
            const full = day?.status === "full";
            const disabled = past || (full && !allowFull);
            const isEnd = range ? date === a || date === b : selected.includes(date);
            const inRange = range && a && b && date > a && date < b;
            const d = new Date(`${date}T12:00:00Z`);
            const firstOfMonth = d.getUTCDate() <= 7 && row[0] === date;
            return (
              <Pressable
                key={date}
                onPress={() => tap(date)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: isEnd, disabled }}
                accessibilityLabel={`${date}${full ? ", full" : day?.status === "orange" ? ", one space left" : ""}`}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isEnd ? colors.foreground : inRange ? "rgba(245,245,242,0.14)" : "rgba(245,245,242,0.05)",
                  borderWidth: marked?.has(date) && !isEnd ? 1 : 0,
                  borderColor: "rgba(34,197,94,0.6)",
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                {firstOfMonth && <Text style={{ color: isEnd ? colors.background : colors.muted, fontSize: 9, fontWeight: "700" }}>{MONTHS[d.getUTCMonth()].toUpperCase()}</Text>}
                <Text style={{ color: isEnd ? colors.background : colors.foreground, fontSize: 16, fontWeight: "700" }}>{d.getUTCDate()}</Text>
                {showCounts && day ? (
                  <Text style={{ color: isEnd ? colors.background : full ? colors.danger : colors.muted, fontSize: 9, fontWeight: "700" }}>
                    {day.dogs}/{DAY_CAPACITY}
                  </Text>
                ) : (
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 3, backgroundColor: !past && day && !full ? DOT[day.status] : "transparent" }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
        {allowFull ? "Counts are dogs booked out of 6." : "Green days are best — we'll confirm or suggest another day. Orange has one space left; faded days are full."}
      </Text>
    </View>
  );
}

/** Monday to Friday as pills, for a regular day. Coloured by how full the next one is. */
export function WeekdayPicker({
  value,
  onChange,
  availability,
  exclude,
}: {
  value: Weekday | null;
  onChange: (d: Weekday) => void;
  availability?: Availability;
  exclude?: Weekday | null;
}) {
  // The next date of each weekday after today, for its dot.
  const nextStatus = (i: number) => {
    const dates = Object.keys(availability ?? {}).sort();
    const date = dates.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === i + 1);
    return date ? availability![date].status : undefined;
  };
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {WEEKDAYS.map((d, i) => {
        const on = value === d;
        const status = nextStatus(i);
        const off = d === exclude;
        return (
          <Pressable
            key={d}
            disabled={off}
            onPress={() => {
              hapticSelection();
              onChange(d);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: off }}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? colors.foreground : "rgba(245,245,242,0.05)",
              opacity: off ? 0.3 : status === "full" && !on ? 0.5 : 1,
            }}
          >
            <Text style={{ color: on ? colors.background : colors.foreground, fontSize: 14, fontWeight: "700" }}>{SHORT[i]}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: status && status !== "full" ? DOT[status] : "transparent" }} />
          </Pressable>
        );
      })}
    </View>
  );
}
