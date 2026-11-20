import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, ChoiceCard, GroupHeading } from "@/components/trainer/cards";
import { ChipRow } from "@/components/trainer/chips";
import { LoadingState } from "@/components/ui";
import { getDogMemberships, membershipPrice, startFullDayMembership, startOneToOneMembership, startOnlineMembership, type Membership, type MembershipService } from "@/data/memberships";
import { ONE_TO_ONE_SLOTS, pounds, TRAINING_DAYS, type SlotTime, type Weekday } from "@/data/sessions";
import { addDays, formatShortDay, pluralDay, todayISO, weekdayOf } from "@/data/trainer-schedule";
import { supabase } from "@/lib/supabase";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

type Dog = { id: string; name: string; accountId: string | null; ownerName: string | null };

/** The next eight `day`s from `from` (inclusive). */
function nextOn(day: Weekday, from: string): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let d = from;
  while (out.length < 8) {
    if (weekdayOf(d) === day) out.push({ value: d, label: formatShortDay(d) });
    d = addDays(d, 1);
  }
  return out;
}

const SERVICES: { value: MembershipService; title: string; icon: "paw-outline" | "person-outline" | "phone-portrait-outline"; hint: string }[] = [
  { value: "full_day", title: "Full Day Training", icon: "paw-outline", hint: `A regular day, Monday to Thursday · ${membershipPrice("full_day")}` },
  { value: "one_to_one", title: "1-1 Training", icon: "person-outline", hint: `Every week or every other week, 12–1pm or 1–2pm · ${membershipPrice("one_to_one")}` },
  { value: "online", title: "Online Training", icon: "phone-portrait-outline", hint: `Homework from us every week · ${membershipPrice("online")}` },
];

/**
 * Trainer: put a customer on a membership, for any of the three services.
 * From a 1-1 on Today ("Start 1-1 membership": its booking comes along, so
 * today's session is £90, or the difference is owed back if it's paid),
 * or from a dog's page. A Full Day membership is a regular place, made as
 * a day's "Add a regular place" makes it; 1-1 and Online go through the
 * database (data/memberships.ts). The owner is told each time.
 */
export default function StartMembershipScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ dogId: string; service?: string; bookingId?: string; date?: string; time?: string }>();
  const today = todayISO();
  const fromBooking = typeof params.bookingId === "string" && params.bookingId.length > 0 ? params.bookingId : null;
  const bookingDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date ?? "")) ? String(params.date) : null;

  const [dog, setDog] = useState<Dog | null>(null);
  const [current, setCurrent] = useState<Membership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<MembershipService>(params.service === "full_day" || params.service === "online" ? params.service : "one_to_one");
  const startDay = (bookingDate && weekdayOf(bookingDate)) || "monday";
  const [day, setDay] = useState<Weekday>(TRAINING_DAYS.includes(startDay) ? startDay : "monday");
  const [cadence, setCadence] = useState<"weekly" | "alternating">("weekly");
  const [time, setTime] = useState<SlotTime>(String(params.time ?? "").startsWith("13") ? "13:00" : "12:00");
  const [startOn, setStartOn] = useState<string | null>(bookingDate && bookingDate >= today ? bookingDate : null);
  const [goals, setGoals] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error: e } = await supabase.from("dogs").select("id, name, account_id").eq("id", String(params.dogId)).maybeSingle();
        if (e || !data) throw new Error("That dog isn't on file.");
        const row = data as { id: string; name: string; account_id: string | null };
        const [owner, memberships] = await Promise.all([
          row.account_id ? supabase.from("profiles").select("owner_name").eq("id", row.account_id).maybeSingle() : Promise.resolve({ data: null }),
          getDogMemberships(row.id).catch(() => [] as Membership[]),
        ]);
        if (!live) return;
        setDog({ id: row.id, name: row.name, accountId: row.account_id, ownerName: (owner.data as { owner_name: string | null } | null)?.owner_name ?? null });
        setCurrent(memberships);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't load the dog.");
      }
    })();
    return () => {
      live = false;
    };
  }, [params.dogId]);

  const dates = useMemo(() => nextOn(day, today), [day, today]);
  // Keep the start date on the chosen day.
  useEffect(() => {
    if (!startOn || weekdayOf(startOn) !== day) setStartOn(bookingDate && weekdayOf(bookingDate) === day && bookingDate >= today ? bookingDate : null);
  }, [day, startOn, bookingDate, today]);

  if (!isTrainer) return <Redirect href="/community" />;
  if (!dog) return <LoadingState error={error} />;

  const has = (s: MembershipService) => current.some((m) => m.service === s);
  const owner = dog.ownerName?.split(" ")[0] || "the owner";

  async function start() {
    if (!dog) return;
    if (!dog.accountId) return Alert.alert("No owner's account yet", `${dog.name} needs to be on an owner's account first.`);
    if (service !== "online" && !startOn) return Alert.alert("Pick the first session");
    setBusy(true);
    try {
      let message: string;
      if (service === "one_to_one") {
        const r = await startOneToOneMembership({ dogId: dog.id, day, cadence, time, startOn: startOn!, bookingId: fromBooking });
        message =
          r.refundPence > 0
            ? `${dog.name} is on 1-1 membership from ${formatShortDay(r.firstOn)}. Refund ${pounds(r.refundPence)} to ${owner} in GoCardless: it's on Requests as a to-do.`
            : `${dog.name} is on 1-1 membership from ${formatShortDay(r.firstOn)}, at £90 a session. ${owner} has been told.`;
      } else if (service === "online") {
        await startOnlineMembership(dog.id, goals);
        message = `${dog.name} is on Online Training. Send their homework from Menu → Online Training.`;
      } else {
        await startFullDayMembership({ dogId: dog.id, accountId: dog.accountId, startOn: startOn!, cadence });
        message = `${dog.name} is on Full Day Training, ${pluralDay(day)}${cadence === "alternating" ? " every other week" : ""}, from ${formatShortDay(startOn!)}.`;
      }
      hapticSuccess();
      Alert.alert("Membership started", message, [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Start membership" subtitle={`${dog.name}${dog.ownerName ? ` · ${dog.ownerName}` : ""}`} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <View style={{ gap: 10 }}>
          {SERVICES.map((s) => (
            <ChoiceCard
              key={s.value}
              icon={s.icon}
              title={s.title}
              description={has(s.value) && s.value !== "full_day" ? `${dog.name} already has this membership.` : s.hint}
              selected={service === s.value}
              disabled={has(s.value) && s.value !== "full_day"}
              onPress={() => setService(s.value)}
            />
          ))}
        </View>

        {service !== "online" && (
          <>
            <GroupHeading>How often</GroupHeading>
            <ChipRow
              value={cadence}
              onChange={setCadence}
              options={[
                { value: "weekly", label: "Every week" },
                { value: "alternating", label: "Every other week" },
              ]}
            />
            <GroupHeading>Day</GroupHeading>
            <ChipRow value={day} onChange={setDay} options={TRAINING_DAYS.map((d) => ({ value: d, label: pluralDay(d) }))} />
            {service === "one_to_one" && (
              <>
                <GroupHeading>Time</GroupHeading>
                <ChipRow value={time} onChange={setTime} options={ONE_TO_ONE_SLOTS.map((s) => ({ value: s.time, label: s.label }))} />
              </>
            )}
            <GroupHeading>First session</GroupHeading>
            <ChipRow value={startOn} onChange={setStartOn} options={dates} />
          </>
        )}

        {service === "one_to_one" && fromBooking && (
          <View style={{ marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.08)", padding: 14 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
              Today&apos;s 1-1 moves to the member price of £90. If it&apos;s already been paid at £120, the £30 difference goes on Requests as a refund to do in GoCardless.
            </Text>
          </View>
        )}

        {service === "online" && (
          <>
            <GroupHeading>Their goals</GroupHeading>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>What they&apos;d like to work on. You can change these on the Online board.</Text>
            <View style={{ gap: 8 }}>
              {goals.map((g, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    value={g}
                    onChangeText={(t) => setGoals((list) => list.map((x, j) => (j === i ? t : x)))}
                    placeholder={i === 0 ? "e.g. Loose-lead walking" : "Another goal"}
                    placeholderTextColor={colors.muted}
                    maxLength={200}
                    style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, backgroundColor: colors.surface }}
                  />
                  {goals.length > 1 && (
                    <Pressable onPress={() => setGoals((list) => list.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove goal">
                      <Ionicons name="close-circle" size={22} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
              {goals.length < 20 && (
                <Pressable onPress={() => setGoals((list) => [...list, ""])} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Add a goal</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        <BigButton icon="ribbon-outline" label={service === "one_to_one" && fromBooking ? "Start 1-1 membership" : "Start membership"} busy={busy} onPress={start} style={{ marginTop: 24 }} />
      </ScrollView>
    </View>
  );
}
