import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getSessionsInRange,
  reschedulePermanent,
  rescheduleOneOff,
  type ScheduleSession,
} from "@/lib/adminSchedule";
import { sessionKindLabel } from "@/lib/dogs";
import { colors } from "@/theme/colors";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_PILLS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Cell colour priority: a cancellation beats a weather/heat notice beats a plain session day. */
function cellTint(sessions: ScheduleSession[]): string | null {
  if (sessions.length === 0) return null;
  if (sessions.some((s) => s.notices.some((n) => n.kind === "cancellation"))) return "#f87171";
  if (sessions.some((s) => s.notices.some((n) => n.kind === "heat" || n.kind === "weather"))) return "#fbbf24";
  return colors.accent;
}

export default function AdminCalendarScreen() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [sessionsByDay, setSessionsByDay] = useState<Map<string, ScheduleSession[]>>(new Map());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<ScheduleSession | null>(null);

  useEffect(() => {
    const start = new Date(month);
    const end = new Date(month);
    end.setMonth(end.getMonth() + 1);

    let cancelled = false;
    getSessionsInRange(start.toISOString(), end.toISOString()).then((sessions) => {
      if (cancelled) return;
      const map = new Map<string, ScheduleSession[]>();
      for (const s of sessions) {
        const key = dateKey(new Date(s.scheduledAt));
        map.set(key, [...(map.get(key) ?? []), s]);
      }
      setSessionsByDay(map);
    });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(month);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const out: (Date | null)[] = Array.from({ length: startWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const selectedSessions = selectedDateKey ? (sessionsByDay.get(selectedDateKey) ?? []) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.monthHeader}>
        <Pressable onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.paper} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={colors.paper} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const key = dateKey(d);
          const sessions = sessionsByDay.get(key) ?? [];
          const tint = cellTint(sessions);
          const isToday = key === dateKey(new Date());
          return (
            <Pressable key={i} style={styles.cell} onPress={() => sessions.length > 0 && setSelectedDateKey(key)}>
              <View style={[styles.cellInner, isToday && styles.cellToday]}>
                <Text style={styles.cellNumber}>{d.getDate()}</Text>
                {tint && <View style={[styles.dot, { backgroundColor: tint }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.accent} label="Sessions" />
        <LegendItem color="#fbbf24" label="Weather/heat notice" />
        <LegendItem color="#f87171" label="Cancellation" />
      </View>

      <Modal visible={!!selectedDateKey} animationType="slide" transparent onRequestClose={() => setSelectedDateKey(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDateKey && new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Pressable onPress={() => setSelectedDateKey(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.paper} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList}>
              {selectedSessions.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.sessionRow}
                  onPress={() => {
                    setSelectedDateKey(null);
                    setReschedulingSession(s);
                  }}
                >
                  <View style={styles.sessionRowBody}>
                    <Text style={styles.sessionDog}>
                      {s.dogName} <Text style={styles.sessionOwner}>({s.ownerName})</Text>
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      {" · "}
                      {sessionKindLabel(s.kind)}
                      {s.location ? ` · ${s.location}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.paperDim} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {reschedulingSession && (
        <RescheduleModal session={reschedulingSession} onClose={() => setReschedulingSession(null)} />
      )}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function RescheduleModal({ session, onClose }: { session: ScheduleSession; onClose: () => void }) {
  const current = new Date(session.scheduledAt);
  const [mode, setMode] = useState<"one-off" | "permanent">("one-off");
  const [date, setDate] = useState(dateKey(current));
  const [time, setTime] = useState(
    `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`
  );
  const [weekday, setWeekday] = useState(current.getDay());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function save() {
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      setResult("Enter a valid time (HH:MM).");
      return;
    }
    setSaving(true);
    setResult(null);

    if (mode === "one-off") {
      const newDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(newDate.getTime())) {
        setResult("Enter a valid date (YYYY-MM-DD).");
        setSaving(false);
        return;
      }
      newDate.setHours(hh, mm, 0, 0);
      const { error } = await rescheduleOneOff(session.id, newDate.toISOString());
      setSaving(false);
      setResult(error ?? "Moved.");
      if (!error) setTimeout(onClose, 700);
    } else {
      const { movedCount, error } = await reschedulePermanent({
        dogId: session.dogId,
        referenceScheduledAt: session.scheduledAt,
        newWeekday: weekday,
        newHour: hh,
        newMinute: mm,
      });
      setSaving(false);
      setResult(error ?? `Moved ${movedCount} future session${movedCount === 1 ? "" : "s"}.`);
      if (!error) setTimeout(onClose, 900);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reschedule {session.dogName}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.paper} />
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modePill, mode === "one-off" && styles.modePillActive]}
              onPress={() => setMode("one-off")}
            >
              <Text style={[styles.modePillText, mode === "one-off" && styles.modePillTextActive]}>This session only</Text>
            </Pressable>
            <Pressable
              style={[styles.modePill, mode === "permanent" && styles.modePillActive]}
              onPress={() => setMode("permanent")}
            >
              <Text style={[styles.modePillText, mode === "permanent" && styles.modePillTextActive]}>
                This & every future one
              </Text>
            </Pressable>
          </View>

          {mode === "one-off" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-09-02" placeholderTextColor={colors.paperDim} />
              <Text style={styles.fieldLabel}>New time (HH:MM)</Text>
              <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="16:00" placeholderTextColor={colors.paperDim} />
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New weekday</Text>
              <View style={styles.weekdayPills}>
                {WEEKDAY_PILLS.map((w) => (
                  <Pressable
                    key={w.value}
                    style={[styles.weekdayPill, weekday === w.value && styles.weekdayPillActive]}
                    onPress={() => setWeekday(w.value)}
                  >
                    <Text style={[styles.weekdayPillText, weekday === w.value && styles.weekdayPillTextActive]}>
                      {w.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>New time (HH:MM)</Text>
              <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="16:00" placeholderTextColor={colors.paperDim} />
            </View>
          )}

          {result && <Text style={styles.resultText}>{result}</Text>}

          <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = "14.28%";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.paper,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: colors.paperDim,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: CELL_SIZE,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellNumber: {
    fontSize: 13,
    color: colors.paper,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.paperDim,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.paper,
  },
  modalList: {
    gap: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
    marginBottom: 10,
  },
  sessionRowBody: {
    flex: 1,
    gap: 2,
  },
  sessionDog: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  sessionOwner: {
    fontWeight: "400",
    color: colors.paperDim,
  },
  sessionMeta: {
    fontSize: 12,
    color: colors.paperDim,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.paperDim,
  },
  modePillTextActive: {
    color: colors.accentInk,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.paperDim,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.paper,
  },
  weekdayPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  weekdayPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekdayPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  weekdayPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.paperDim,
  },
  weekdayPillTextActive: {
    color: colors.accentInk,
  },
  resultText: {
    fontSize: 12,
    color: "#4ade80",
    marginBottom: 10,
  },
  saveButton: {
    borderRadius: 999,
    backgroundColor: colors.paper,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
});
