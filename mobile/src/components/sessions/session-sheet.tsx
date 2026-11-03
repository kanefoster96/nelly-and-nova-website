import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass-button";
import { Pressable } from "@/components/pressable";
import { PrimaryButton } from "@/components/ui";
import {
  cancelSessions,
  createRequest,
  getAvailability,
  longDate,
  plural,
  plusDays,
  priceLine,
  sessionLabel,
  shortDate,
  todayLondon,
  type Availability,
  type DogSession,
  type Placement,
  type Weekday,
} from "@/data/sessions";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

import { DateGrid, WeekdayPicker } from "./date-grid";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type SheetMode = "menu" | "cancel" | "one_off" | "add_regular" | "switch";

/** A full-width option, as Kanvas's class-pass actions. */
export function OptionPill({ icon, label, hint, onPress, tone }: { icon: IoniconName; label: string; hint?: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={20} color={tone ?? colors.foreground} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: tone ?? colors.foreground, fontSize: 15, fontWeight: "700" }}>{label}</Text>
        {hint && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{hint}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticSelection();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: on ? colors.foreground : "transparent" }}
          >
            <Text style={{ color: on ? colors.background : colors.muted, fontSize: 14, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 20, marginBottom: 8 }}>{children}</Text>;
}

function Note({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      multiline
      maxLength={500}
      style={{ minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, color: colors.foreground, fontSize: 15, backgroundColor: colors.surface, textAlignVertical: "top" }}
    />
  );
}

function Chips({ dates, selected, onPick, label }: { dates: DogSession[]; selected: string | null; onPick: (s: DogSession) => void; label?: (s: DogSession) => string }) {
  if (dates.length === 0) return <Text style={{ color: colors.muted, fontSize: 14 }}>No upcoming sessions.</Text>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {dates.map((s) => {
        const on = selected === s.date;
        return (
          <Pressable
            key={`${s.date}-${s.placementId ?? s.bookingId}`}
            onPress={() => {
              hapticSelection();
              onPick(s);
            }}
            style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: on ? colors.foreground : "rgba(245,245,242,0.06)" }}
          >
            <Text style={{ color: on ? colors.background : colors.foreground, fontSize: 13, fontWeight: "600" }}>{label ? label(s) : shortDate(s.date)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The one sheet for everything an owner changes about their dog's sessions,
 * opened from the Profile tab's Manage list and from a date on the
 * Schedule tab:
 *   Cancel (one session, or every one in a holiday) — instant, no refund,
 *     with "Ask for a replacement day" in the same place;
 *   Book an extra Full Day or a 1-1 (with its price);
 *   Add a regular day;
 *   Switch my regular day (this week only, or for good).
 * Everything but a cancellation is a request the trainer accepts, offers
 * other days for, or declines. Date pickers show how full each day is.
 */
export function SessionSheet({
  visible,
  onClose,
  dog,
  session,
  sessions,
  placements,
  member,
  initialMode = "menu",
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  dog: { id: string; name: string };
  /** The date tapped on the Schedule tab, if any. */
  session?: DogSession | null;
  /** Upcoming sessions (cancelled ones are left out here). */
  sessions: DogSession[];
  placements: Placement[];
  member: boolean;
  initialMode?: SheetMode;
  onDone: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const today = todayLondon();
  const tomorrow = plusDays(today, 1);
  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [availability, setAvailability] = useState<Availability>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Cancel
  const [cancelKind, setCancelKind] = useState<"one" | "holiday">("one");
  const [cancelDate, setCancelDate] = useState<DogSession | null>(null);
  const [range, setRange] = useState<string[]>([]);
  const [wantReplacement, setWantReplacement] = useState(false);
  const [replacement, setReplacement] = useState<string[]>([]);
  // One-off
  const [service, setService] = useState<"full_day" | "one_to_one">("full_day");
  const [part, setPart] = useState<"morning" | "afternoon">("morning");
  const [date, setDate] = useState<string[]>([]);
  // Regular day / switch
  const [day, setDay] = useState<Weekday | null>(null);
  const [cadence, setCadence] = useState<"weekly" | "alternating">("weekly");
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [switchWhen, setSwitchWhen] = useState<"week" | "permanent">("permanent");
  const [moveFrom, setMoveFrom] = useState<DogSession | null>(null);

  const upcoming = useMemo(() => sessions.filter((s) => !s.cancelled && s.date > today), [sessions, today]);

  // Fresh each time it opens, from whatever was tapped.
  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setNote("");
    setCancelKind("one");
    setCancelDate(session && !session.cancelled && session.date > today ? session : null);
    setRange([]);
    setWantReplacement(false);
    setReplacement([]);
    setService("full_day");
    setDate([]);
    setDay(null);
    setCadence("weekly");
    setPlacementId(session?.placementId ?? placements[0]?.id ?? null);
    setSwitchWhen(session?.placementId ? "week" : "permanent");
    setMoveFrom(session?.placementId && !session.cancelled ? session : null);
    let live = true;
    getAvailability(tomorrow, plusDays(tomorrow, 7 * 8))
      .then((a) => live && setAvailability(a))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const placement = placements.find((p) => p.id === placementId) ?? null;

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      const message = await action();
      hapticSuccess();
      onDone(message);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function submitCancel() {
    if (cancelKind === "one") {
      if (!cancelDate) return Alert.alert("Pick the session to cancel");
      if (wantReplacement && !replacement[0]) return Alert.alert("Pick a replacement day", "Or turn off “Ask for a replacement day”.");
      return run(async () => {
        await cancelSessions(dog.id, cancelDate.date, cancelDate.date, note);
        if (wantReplacement && replacement[0]) {
          await createRequest({
            dogId: dog.id,
            kind: "replacement",
            date: replacement[0],
            placementId: cancelDate.placementId,
            fromDate: cancelDate.date,
            note,
          });
          return `Cancelled ${shortDate(cancelDate.date)}. We'll confirm ${shortDate(replacement[0])} or suggest another day.`;
        }
        return `Cancelled ${dog.name}'s session on ${shortDate(cancelDate.date)}.`;
      });
    }
    if (range.length < 1) return Alert.alert("Pick the first and last day you're away");
    const [from, to] = [range[0], range[1] ?? range[0]];
    return run(async () => {
      const res = await cancelSessions(dog.id, from, to, note);
      return `Cancelled ${res.cancelled} session${res.cancelled === 1 ? "" : "s"}, ${shortDate(from)} to ${shortDate(to)}.`;
    });
  }

  function submitOneOff() {
    if (!date[0]) return Alert.alert("Pick a day");
    return run(async () => {
      await createRequest({ dogId: dog.id, kind: "one_off", date: date[0], service, partOfDay: service === "one_to_one" ? part : null, note });
      return `Asked for ${service === "one_to_one" ? "a 1-1" : "an extra Full Day"} on ${shortDate(date[0])}. We'll confirm or suggest another day.`;
    });
  }

  function submitRegular() {
    if (!day) return Alert.alert("Pick a day");
    return run(async () => {
      await createRequest({ dogId: dog.id, kind: "add_regular", day, cadence, note });
      return `Asked for ${plural(day)}${cadence === "alternating" ? " every other week" : ""}. We'll confirm or suggest another day.`;
    });
  }

  function submitSwitch() {
    if (!placement) return Alert.alert("No regular day to switch yet");
    if (switchWhen === "week") {
      if (!moveFrom) return Alert.alert("Pick the session to move");
      if (!date[0]) return Alert.alert("Pick the new day");
      return run(async () => {
        await createRequest({ dogId: dog.id, kind: "switch_week", placementId: placement.id, fromDate: moveFrom.date, date: date[0], note });
        return `Asked to move ${shortDate(moveFrom.date)} to ${shortDate(date[0])}. We'll confirm or suggest another day.`;
      });
    }
    if (!day) return Alert.alert("Pick the new day");
    return run(async () => {
      await createRequest({ dogId: dog.id, kind: "switch_permanent", placementId: placement.id, day, note });
      return `Asked to move ${dog.name}'s regular day to ${plural(day)}. We'll let you know.`;
    });
  }

  const title =
    mode === "menu"
      ? session
        ? longDate(session.date)
        : `${dog.name}'s sessions`
      : mode === "cancel"
        ? "Cancel"
        : mode === "one_off"
          ? "Book an extra session"
          : mode === "add_regular"
            ? "Add a regular day"
            : "Switch my regular day";

  const placementSessions = upcoming.filter((s) => s.placementId === placementId);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          {mode !== "menu" && initialMode === "menu" ? (
            <GlassButton onPress={() => setMode("menu")} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </GlassButton>
          ) : null}
          <Text style={{ flex: 1, color: colors.foreground, fontSize: 22, fontWeight: "800" }} numberOfLines={1}>
            {title}
          </Text>
          <GlassButton onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </GlassButton>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 32 }}
        >
          {mode === "menu" && (
            <View style={{ gap: 10 }}>
              {session && (
                <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 6 }}>
                  {sessionLabel(session)}
                  {session.cancelled ? " · Cancelled" : ""}
                </Text>
              )}
              {(!session || (!session.cancelled && session.date > today)) && (
                <OptionPill icon="close-circle-outline" label={session ? "Cancel this session" : "Cancel a session or a holiday"} hint="No refund · lets us know not to collect" onPress={() => setMode("cancel")} />
              )}
              {session && !session.cancelled && session.date > today && (
                <OptionPill
                  icon="refresh-outline"
                  label="Cancel & ask for a replacement day"
                  hint="If we have space"
                  onPress={() => {
                    setWantReplacement(true);
                    setMode("cancel");
                  }}
                />
              )}
              {session?.placementId && !session.cancelled && session.date > today && (
                <OptionPill
                  icon="swap-horizontal-outline"
                  label="Move just this session"
                  hint="To another day"
                  onPress={() => {
                    setSwitchWhen("week");
                    setMode("switch");
                  }}
                />
              )}
              {placements.length > 0 && (
                <OptionPill
                  icon="repeat-outline"
                  label="Switch my regular day"
                  hint={placements.map((p) => plural(p.day)).join(" · ")}
                  onPress={() => {
                    setSwitchWhen("permanent");
                    setMode("switch");
                  }}
                />
              )}
              {!session && (
                <>
                  <OptionPill icon="add-circle-outline" label="Book an extra Full Day or a 1-1" hint="A one-off session" onPress={() => setMode("one_off")} />
                  <OptionPill icon="calendar-outline" label="Add a regular day" hint="Every week, or every other week" onPress={() => setMode("add_regular")} />
                </>
              )}
              {session?.cancelled && <Text style={{ color: colors.muted, fontSize: 14 }}>This session is cancelled. Ask for a replacement day from the Profile tab's requests, or message us.</Text>}
            </View>
          )}

          {mode === "cancel" && (
            <View>
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.08)", padding: 14 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
                  Sessions aren&apos;t refunded — this just lets us know not to collect {dog.name}. You can cancel up to the day before.
                </Text>
              </View>
              {!session && (
                <View style={{ marginTop: 16 }}>
                  <Toggle
                    value={cancelKind}
                    onChange={(v) => {
                      setCancelKind(v);
                      if (v === "holiday") setWantReplacement(false);
                    }}
                    options={[
                      { value: "one", label: "One session" },
                      { value: "holiday", label: "A holiday" },
                    ]}
                  />
                </View>
              )}
              {cancelKind === "one" ? (
                <>
                  {!session && (
                    <>
                      <Label>Which session?</Label>
                      <Chips dates={upcoming.slice(0, 16)} selected={cancelDate?.date ?? null} onPick={setCancelDate} />
                    </>
                  )}
                  {session && cancelDate && <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 16 }}>{longDate(cancelDate.date)}</Text>}
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      setWantReplacement((v) => !v);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: wantReplacement }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 }}
                  >
                    <Ionicons name={wantReplacement ? "checkbox" : "square-outline"} size={22} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", flex: 1 }}>Ask for a replacement day</Text>
                  </Pressable>
                  {wantReplacement && (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>If we have space. The trainer confirms it or suggests another day.</Text>
                      <Label>Replacement day</Label>
                      <DateGrid availability={availability} selected={replacement} onChange={setReplacement} after={today} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Label>First and last day away</Label>
                  <DateGrid availability={availability} selected={range} onChange={setRange} after={today} range weeks={10} allowFull marked={new Set(upcoming.map((s) => s.date))} />
                  {range.length > 0 && (
                    <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 10 }}>
                      Every session from {shortDate(range[0])} to {shortDate(range[1] ?? range[0])} ({upcoming.filter((s) => s.date >= range[0] && s.date <= (range[1] ?? range[0])).length} booked).
                    </Text>
                  )}
                </>
              )}
              <Label>Anything to tell us? (optional)</Label>
              <Note value={note} onChange={setNote} placeholder="e.g. On holiday" />
              <View style={{ marginTop: 20 }}>
                <PrimaryButton title={wantReplacement ? "Cancel & ask for replacement" : "Cancel session"} onPress={submitCancel} loading={busy} />
              </View>
            </View>
          )}

          {mode === "one_off" && (
            <View>
              <Toggle
                value={service}
                onChange={setService}
                options={[
                  { value: "full_day", label: "Full Day" },
                  { value: "one_to_one", label: "1-1" },
                ]}
              />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 14 }}>
                {service === "full_day" ? `Full Day ${priceLine("full_day", member)}` : `1-1 ${priceLine("one_to_one", member)}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>We&apos;ll take this by Direct Debit once we&apos;ve confirmed your session.</Text>
              {service === "one_to_one" && (
                <>
                  <Label>Time of day</Label>
                  <Toggle
                    value={part}
                    onChange={setPart}
                    options={[
                      { value: "morning", label: "Morning" },
                      { value: "afternoon", label: "Afternoon" },
                    ]}
                  />
                </>
              )}
              <Label>Day</Label>
              <DateGrid availability={availability} selected={date} onChange={setDate} after={today} allowFull={service === "one_to_one"} />
              <Label>Anything to tell us? (optional)</Label>
              <Note value={note} onChange={setNote} placeholder="e.g. What you'd like to work on" />
              <View style={{ marginTop: 20 }}>
                <PrimaryButton title="Send request" onPress={submitOneOff} loading={busy} />
              </View>
            </View>
          )}

          {mode === "add_regular" && (
            <View>
              <Label>Which day?</Label>
              <WeekdayPicker value={day} onChange={setDay} availability={availability} />
              <Label>How often?</Label>
              <Toggle
                value={cadence}
                onChange={setCadence}
                options={[
                  { value: "weekly", label: "Every week" },
                  { value: "alternating", label: "Every other week" },
                ]}
              />
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10 }}>Green days are best — we&apos;ll confirm or suggest another day.</Text>
              <Label>Anything to tell us? (optional)</Label>
              <Note value={note} onChange={setNote} placeholder="e.g. From next month" />
              <View style={{ marginTop: 20 }}>
                <PrimaryButton title="Send request" onPress={submitRegular} loading={busy} />
              </View>
            </View>
          )}

          {mode === "switch" && (
            <View>
              {placements.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 14 }}>{dog.name} doesn&apos;t have a regular day yet.</Text>
              ) : (
                <>
                  {placements.length > 1 && (
                    <>
                      <Label>Which regular day?</Label>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {placements.map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => setPlacementId(p.id)}
                            style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: p.id === placementId ? colors.foreground : "rgba(245,245,242,0.06)" }}
                          >
                            <Text style={{ color: p.id === placementId ? colors.background : colors.foreground, fontWeight: "600" }}>{plural(p.day)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                  <View style={{ marginTop: 12 }}>
                    <Toggle
                      value={switchWhen}
                      onChange={setSwitchWhen}
                      options={[
                        { value: "week", label: "Just once" },
                        { value: "permanent", label: "For good" },
                      ]}
                    />
                  </View>
                  {switchWhen === "week" ? (
                    <>
                      <Label>Session to move</Label>
                      <Chips dates={placementSessions.slice(0, 12)} selected={moveFrom?.date ?? null} onPick={setMoveFrom} />
                      <Label>New day</Label>
                      <DateGrid availability={availability} selected={date} onChange={setDate} after={today} />
                    </>
                  ) : (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 14 }}>
                        Now {placement ? `${plural(placement.day)}${placement.cadence === "alternating" ? ", every other week" : ""}` : ""}. The new day starts from its next date once we&apos;ve confirmed.
                      </Text>
                      <Label>New day</Label>
                      <WeekdayPicker value={day} onChange={setDay} availability={availability} exclude={placement?.day ?? null} />
                    </>
                  )}
                  <Label>Anything to tell us? (optional)</Label>
                  <Note value={note} onChange={setNote} placeholder="e.g. My work days have changed" />
                  <View style={{ marginTop: 20 }}>
                    <PrimaryButton title="Send request" onPress={submitSwitch} loading={busy} />
                  </View>
                </>
              )}
            </View>
          )}
          {busy && <ActivityIndicator color={colors.muted} style={{ marginTop: 12 }} />}
        </ScrollView>
      </View>
    </Modal>
  );
}
