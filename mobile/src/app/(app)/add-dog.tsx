import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, ChoiceCard, GroupHeading } from "@/components/trainer/cards";
import { ChipRow } from "@/components/trainer/chips";
import { PersonPicker } from "@/components/trainer/person-picker";
import { CARD, FormScrollView, Tag, TextField } from "@/components/ui";
import { holderNameFor, listOpenRequests, pickedAddress, type Picked } from "@/data/people";
import {
  addOneOffDay,
  addOneToOne,
  addRegularPlace,
  bookDayMeetGreet,
  formatDay,
  formatMinutes,
  formatShortDay,
  formatTime,
  getTrainerCalendar,
  isFullDay,
  notifyBooked,
  ONE_TO_ONE_MINUTES,
  pluralDay,
  sendOnboarding,
  todayISO,
  weekdayOf,
  type BookingTarget,
} from "@/data/trainer-schedule";
import { firstName } from "@/lib/contact";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

type Mode = "dog" | "one_to_one" | "meet_greet";
type Plan = "one_off" | "weekly" | "alternating";

/** 8am to 6pm, every half hour: the times a 1-1 or a meet & greet can start. */
const TIMES = Array.from({ length: 21 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const TIME_OPTIONS = TIMES.map((t) => ({ value: t, label: formatTime(t) }));
const MINUTE_OPTIONS = ONE_TO_ONE_MINUTES.map((m) => ({ value: String(m), label: formatMinutes(m) }));

const MULTILINE = { minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.surface } as const;

const TITLES: Record<Mode, string> = { dog: "Add new dog", one_to_one: "Add a 1-1", meet_greet: "Add a meet & greet" };
const SERVICE: Record<Mode, string> = { dog: "Full Day Training", one_to_one: "1-1 Training", meet_greet: "Full Day Training" };

/** A tick box on its own line: "Let Sam know in the app". */
function Toggle({ on, label, note, onChange }: { on: boolean; label: string; note?: string; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onChange(!on);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}
    >
      <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.success : colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{label}</Text>
        {!!note && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{note}</Text>}
      </View>
    </Pressable>
  );
}

/** Who's been chosen, with Change. */
function PickedCard({ picked, onChange }: { picked: Picked; onChange: () => void }) {
  const isCustomer = picked.type === "customer";
  const name = isCustomer ? (picked.dog?.name ?? picked.customer.name) : picked.request.name;
  const photo = isCustomer ? (picked.dog?.photoUrl ?? null) : null;
  const sub = isCustomer
    ? [picked.dog ? picked.customer.name : picked.customer.dogs.length ? "No dog chosen" : "No dogs yet", picked.customer.email].filter(Boolean).join(" · ")
    : [picked.request.dogNames, picked.isNew ? "New request" : "Request", picked.request.email].filter(Boolean).join(" · ");
  return (
    <View style={[CARD, { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }]}>
      <AvatarCircle name={name} avatarUrl={photo} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
            {name}
          </Text>
          {isCustomer && picked.dog && <Tag label={picked.dog.registered ? "Registered" : "Not registered"} tone={picked.dog.registered ? colors.success : colors.warning} />}
          {!isCustomer && !picked.request.accountId && <Tag label="No app yet" />}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel="Choose someone else" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>Change</Text>
      </Pressable>
    </View>
  );
}

/**
 * Trainer: add to a day on the calendar, from the day's three buttons:
 *  - mode "dog" (Add new dog): Full Day Training just this day, or a
 *    regular place every week or every other week from this date.
 *  - mode "one_to_one" (Add a 1-1): a time and how long.
 *  - mode "meet_greet" (Add a meet & greet): a time, where (filled in from
 *    their account or request) and a note.
 * Each starts with who it's for (components/trainer/person-picker.tsx): a
 * customer and their dog, an open request, or someone new (saved as a
 * request). Booked on their account, it shows in their app, and they're
 * told ("📅 1-1 booked for Tue 10 Nov, 2:00pm") through the website. A
 * regular place for a request can send their join link at the same time
 * (Send onboarding: the website emails it and holds the place). `enquiry`
 * picks a request ahead (the Onboard button on a day's meet & greet).
 */
export default function AddDogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date: string; mode?: string; enquiry?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date)) ? String(params.date) : todayISO();
  const weekday = weekdayOf(date);
  const mode: Mode = params.mode === "meet_greet" ? "meet_greet" : params.mode === "one_to_one" || !weekday ? "one_to_one" : "dog";

  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());

  const [plan, setPlan] = useState<Plan | null>(null);
  const [sendLink, setSendLink] = useState(true);
  const [time, setTime] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("60");
  const [address, setAddress] = useState("");
  const addressEdited = useRef(false);
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [emailThem, setEmailThem] = useState(true);
  const [saving, setSaving] = useState(false);

  // Straight to choosing who, once the page has slid in (a sheet can't open mid-push on iOS).
  useEffect(() => {
    if (params.enquiry) return;
    const t = setTimeout(() => setPickerOpen(true), 450);
    return () => clearTimeout(t);
  }, [params.enquiry]);

  // Who's in already (Full Day: those dogs can't be added twice), and a request picked ahead.
  useEffect(() => {
    if (mode !== "meet_greet") {
      getTrainerCalendar(date, date)
        .then((rows) => setAlreadyIn(new Set(rows.filter((r) => (mode === "one_to_one" ? r.kind === "one_to_one" : isFullDay(r)) && r.dogId).map((r) => r.dogId!))))
        .catch(() => {});
    }
    if (params.enquiry) {
      listOpenRequests()
        .then((list) => {
          const r = list.find((x) => x.id === params.enquiry);
          if (r) choose({ type: "request", request: r });
          else setPickerOpen(true);
        })
        .catch(() => setPickerOpen(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode, params.enquiry]);

  function choose(p: Picked) {
    animateListChange();
    setPicked(p);
    if (!addressEdited.current) setAddress(pickedAddress(p) ?? "");
    // A request that's already onboarding has had its link: don't send it again by default.
    if (p.type === "request") setSendLink(p.request.status !== "onboarding");
  }

  const isRequest = picked?.type === "request";
  const accountId = picked ? (picked.type === "customer" ? picked.customer.accountId : picked.request.accountId) : null;
  const ownerFirst = picked ? firstName(picked.type === "customer" ? picked.customer.name : picked.request.name) || "them" : "them";
  const email = picked ? (picked.type === "customer" ? picked.customer.email : picked.request.email) : null;
  const linkSends = mode === "dog" && isRequest && (plan === "weekly" || plan === "alternating") && sendLink;

  function target(): BookingTarget {
    if (!picked) throw new Error("Choose who it's for.");
    if (picked.type === "customer") {
      return { accountId: picked.customer.accountId, dogId: picked.dog?.id ?? null, holderName: picked.dog ? null : picked.customer.name };
    }
    return { accountId: picked.request.accountId, dogId: null, enquiryId: picked.request.id, holderName: holderNameFor(picked.request) };
  }

  /** "Sam's been told in the app." — what happened after the booking. */
  function toldLine(res: { notified: boolean; emailed: boolean } | null): string {
    if (!res) return "";
    const how = [res.notified && "in the app", res.emailed && "by email"].filter(Boolean).join(" and ");
    if (how) return ` ${ownerFirst.replace(/^./, (c) => c.toUpperCase())} has been told ${how}.`;
    return accountId ? " The notification didn't go, so let them know yourself." : " They don't have the app yet, so it'll show once they sign up.";
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (!picked) throw new Error("Choose who it's for.");
      if (mode === "one_to_one") {
        if (!time) throw new Error("Pick a time.");
        const id = await addOneToOne({ date, time, durationMin: Number(minutes) || null, target: target(), notes });
        const res = notify && accountId ? await notifyBooked("one_to_one", id) : null;
        hapticSuccess();
        Alert.alert("1-1 booked", `${formatDay(date)} at ${formatTime(time)}.${toldLine(res)}`, [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      if (mode === "meet_greet") {
        if (!time) throw new Error("Pick a time.");
        const id = await bookDayMeetGreet({
          date,
          time,
          enquiryId: picked.type === "request" ? picked.request.id : null,
          accountId: picked.type === "customer" ? picked.customer.accountId : null,
          dogId: picked.type === "customer" ? (picked.dog?.id ?? null) : null,
          address,
          notes,
        });
        const sendEmail = emailThem && !!email;
        const res = (notify && accountId) || sendEmail ? await notifyBooked("meet_greet", id, { email: sendEmail, notify }) : null;
        hapticSuccess();
        Alert.alert("Meet & greet booked", `${formatDay(date)} at ${formatTime(time)}.${toldLine(res)}`, [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      // Full Day Training.
      if (!plan) throw new Error("Choose just this day, every week or every other week.");
      if (plan === "one_off") {
        const id = await addOneOffDay(date, target());
        const res = notify && accountId ? await notifyBooked("full_day_one_off", id) : null;
        hapticSuccess();
        Alert.alert("Added for the day", `${formatDay(date)}.${toldLine(res)}`, [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      if (linkSends && picked.type === "request") {
        const result = await sendOnboarding(picked.request.id, date, plan);
        hapticSuccess();
        const sentBy = [result.emailed ? "by email" : null, result.messaged ? "in their chat" : null].filter(Boolean).join(" and ");
        Alert.alert(
          "Link sent — their place is held",
          `${sentBy ? `${picked.request.name} has the join link ${sentBy}.` : `The link didn't go out automatically${result.joinUrl ? `: send them ${result.joinUrl}` : ""}.`} Their ${pluralDay(weekday!)} place is held from ${formatShortDay(date)}${plan === "alternating" ? ", every other week" : ""}, and ${picked.request.dogNames || "their dog"} fills in once they register.`,
          [{ text: "Done", onPress: () => router.back() }],
        );
        return;
      }
      const id = await addRegularPlace(date, plan, target());
      const res = notify && accountId ? await notifyBooked("full_day", id) : null;
      hapticSuccess();
      Alert.alert(
        "Regular place added",
        `Every ${plan === "alternating" ? "other " : ""}${weekday!.replace(/^./, (c) => c.toUpperCase())} from ${formatShortDay(date)}.${toldLine(res)}`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      const nearly = /^(Pick|Choose)/.test(message);
      if (nearly) hapticWarning();
      else hapticError();
      Alert.alert(nearly ? "Nearly there" : "That didn't go through", message);
    } finally {
      setSaving(false);
    }
  }

  const weekdayName = weekday?.replace(/^./, (c) => c.toUpperCase());
  const saveLabel =
    mode === "one_to_one"
      ? "Book 1-1"
      : mode === "meet_greet"
        ? "Book meet & greet"
        : linkSends
          ? "Send link and hold the place"
          : plan === "one_off"
            ? "Add for this day"
            : plan
              ? `Add every ${plan === "alternating" ? "other " : ""}${weekdayName}`
              : "Add dog";
  const dogIn = picked?.type === "customer" && picked.dog && alreadyIn.has(picked.dog.id);
  const unregistered = picked?.type === "customer" && picked.dog && !picked.dog.registered;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={TITLES[mode]} subtitle={formatDay(date)} />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <GroupHeading style={{ marginTop: 8 }}>Who</GroupHeading>
        {picked ? (
          <PickedCard picked={picked} onChange={() => setPickerOpen(true)} />
        ) : (
          <BigButton icon="search" label="Choose a customer or request" variant="outline" onPress={() => setPickerOpen(true)} />
        )}
        {dogIn && <Text style={{ color: colors.warning, fontSize: 13, marginTop: 8 }}>{picked.type === "customer" && picked.dog?.name} is already in that day.</Text>}
        {unregistered && mode !== "meet_greet" && (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
            {picked.type === "customer" && picked.dog?.name} isn&apos;t registered yet: they&apos;re flagged on Today until the consent & waiver is signed.
          </Text>
        )}

        {mode === "dog" && (
          <>
            <GroupHeading>When</GroupHeading>
            <View style={{ gap: 10 }}>
              <ChoiceCard icon="today-outline" title="Just this day (one-off)" description={formatDay(date)} selected={plan === "one_off"} onPress={() => (hapticSelection(), setPlan("one_off"))} />
              <ChoiceCard icon="repeat-outline" title="Every week from this date" description={`Every ${weekdayName}, from ${formatShortDay(date)}`} selected={plan === "weekly"} onPress={() => (hapticSelection(), setPlan("weekly"))} />
              <ChoiceCard icon="swap-vertical-outline" title="Every other week from this date" description={`Alternate ${pluralDay(weekday!)}, from ${formatShortDay(date)}`} selected={plan === "alternating"} onPress={() => (hapticSelection(), setPlan("alternating"))} />
            </View>
            {isRequest && (plan === "weekly" || plan === "alternating") && (
              <View style={{ marginTop: 10 }}>
                <Toggle
                  on={sendLink}
                  onChange={setSendLink}
                  label="Send their join link now"
                  note="Emails them the link to set up their Direct Debit and register their dog. Leave it off to just hold the place; you can start onboarding later."
                />
              </View>
            )}
            {picked?.type === "customer" && !picked.dog && (
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 10 }}>The place is held under {picked.customer.name}&apos;s name until they register a dog.</Text>
            )}
          </>
        )}

        {(mode === "one_to_one" || mode === "meet_greet") && (
          <>
            <GroupHeading>Time</GroupHeading>
            <ChipRow options={TIME_OPTIONS} value={time} onChange={setTime} />
          </>
        )}

        {mode === "one_to_one" && (
          <>
            <GroupHeading>How long</GroupHeading>
            <ChipRow options={MINUTE_OPTIONS} value={minutes} onChange={setMinutes} />
            <GroupHeading>Notes</GroupHeading>
            <TextField value={notes} onChangeText={setNotes} placeholder="What it's for (optional)" autoCapitalize="sentences" autoCorrect multiline style={MULTILINE} />
          </>
        )}

        {mode === "meet_greet" && (
          <>
            <GroupHeading>Where</GroupHeading>
            <TextField
              value={address}
              onChangeText={(v) => {
                addressEdited.current = true;
                setAddress(v);
              }}
              placeholder="Their address, or where you're meeting"
              autoCapitalize="words"
              textContentType="fullStreetAddress"
              style={{ ...MULTILINE, minHeight: 0, marginBottom: 0 }}
            />
            <GroupHeading>Note for them</GroupHeading>
            <TextField value={notes} onChangeText={setNotes} placeholder="e.g. Bring their favourite treats (optional)" autoCapitalize="sentences" autoCorrect multiline style={MULTILINE} />
            {!!email && <Toggle on={emailThem} onChange={setEmailThem} label={`Email ${ownerFirst} the day and time`} />}
          </>
        )}

        {!!accountId && !linkSends && <Toggle on={notify} onChange={setNotify} label={`Let ${ownerFirst} know in the app`} note="A notification on their phone. It's in their Schedule either way." />}

        {picked && (mode !== "dog" || plan) && <BigButton label={saveLabel} icon={linkSends ? "paper-plane" : "add"} onPress={save} busy={saving} disabled={!!dogIn} style={{ marginTop: 24 }} />}
      </FormScrollView>
      <PersonPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={choose} service={SERVICE[mode]} allowNoDog={mode === "meet_greet"} alreadyIn={mode === "dog" ? alreadyIn : undefined} />
    </View>
  );
}
