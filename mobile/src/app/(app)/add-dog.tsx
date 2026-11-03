import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, ChoiceCard, GroupHeading } from "@/components/trainer/cards";
import { FormScrollView, Tag, TextField } from "@/components/ui";
import {
  addOneOffDay,
  addOneToOne,
  addRegularPlace,
  formatDay,
  formatShortDay,
  formatTime,
  getTrainerCalendar,
  isFullDay,
  listOnboardingRequests,
  listRegisteredDogs,
  pluralDay,
  sendOnboarding,
  todayISO,
  weekdayOf,
  type OnboardingRequest,
  type RegisteredDog,
} from "@/data/trainer-schedule";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

type Path = "registered" | "onboard";
type Plan = "one_off" | "weekly" | "alternating";

/** 8am to 6pm, every half hour: the times a 1-1 can start. */
const TIMES = Array.from({ length: 21 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const STATUS_LABEL: Record<OnboardingRequest["status"], string> = {
  new: "New",
  meet_greet_booked: "Meet & greet booked",
  onboarding: "Onboarding",
};

function ListBox({ children }: { children: React.ReactNode }) {
  return <View style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" }}>{children}</View>;
}

function PickRow({
  title,
  subtitle,
  avatar,
  selected,
  disabledNote,
  onPress,
  first,
}: {
  title: string;
  subtitle?: string | null;
  avatar?: { name: string; url: string | null };
  selected: boolean;
  disabledNote?: string;
  onPress: () => void;
  first: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabledNote}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabledNote }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        backgroundColor: selected ? "rgba(34,197,94,0.08)" : "transparent",
        opacity: disabledNote ? 0.45 : 1,
      }}
    >
      {avatar && <AvatarCircle name={avatar.name} avatarUrl={avatar.url} size={36} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {disabledNote ? (
        <Tag label={disabledNote} />
      ) : (
        <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.success : colors.muted} />
      )}
    </Pressable>
  );
}

/** Search the registered dogs and pick one. Dogs already in that day are shown but can't be picked. */
function DogPicker({ dogs, selected, onSelect, alreadyIn }: { dogs: RegisteredDog[] | null; selected: RegisteredDog | null; onSelect: (d: RegisteredDog) => void; alreadyIn: Set<string> }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (dogs ?? []).filter((d) => !q || d.name.toLowerCase().includes(q) || (d.ownerName ?? "").toLowerCase().includes(q) || (d.breed ?? "").toLowerCase().includes(q));
    return list.slice(0, 40);
  }, [dogs, query]);

  if (!dogs) return <ActivityIndicator color={colors.foreground} style={{ marginVertical: 20 }} />;
  if (dogs.length === 0) return <Text style={{ color: colors.muted, fontSize: 14 }}>No registered dogs yet. A dog counts as registered once its owner has signed the waiver.</Text>;
  return (
    <View>
      <TextField value={query} onChangeText={setQuery} placeholder="Search by dog, owner or breed" autoCapitalize="words" returnKeyType="search" />
      <ListBox>
        {shown.length === 0 && <Text style={{ color: colors.muted, fontSize: 14, padding: 14 }}>No dog matches “{query.trim()}”.</Text>}
        {shown.map((d, i) => (
          <PickRow
            key={d.id}
            first={i === 0}
            title={d.name}
            subtitle={[d.breed, d.ownerName].filter(Boolean).join(" · ")}
            avatar={{ name: d.name, url: d.photoUrl }}
            selected={selected?.id === d.id}
            disabledNote={alreadyIn.has(d.id) ? "Already in" : undefined}
            onPress={() => {
              hapticSelection();
              onSelect(d);
            }}
          />
        ))}
      </ListBox>
      {(dogs.length > shown.length && !query.trim()) && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Showing the first {shown.length} A–Z. Search to find the rest.</Text>}
    </View>
  );
}

/**
 * Trainer: add to a day on the calendar (from the day's Add new dog or Add
 * a 1-1).
 *  - mode "dog": either a registered dog (just this day, every week, or
 *    every other week from this date) or Send onboarding for a meet &
 *    greet request — the website emails the join link and holds the place,
 *    and the dog's name fills in once they register. `enquiry` picks a
 *    request ahead (the Onboard button on a day's meet & greet).
 *  - mode "one_to_one": a time and a registered dog, or a name.
 */
export default function AddDogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date: string; mode?: string; enquiry?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date)) ? String(params.date) : todayISO();
  const weekday = weekdayOf(date);
  const oneToOne = params.mode === "one_to_one" || !weekday;

  const [path, setPath] = useState<Path | null>(params.enquiry ? "onboard" : null);
  const [dogs, setDogs] = useState<RegisteredDog[] | null>(null);
  const [requests, setRequests] = useState<OnboardingRequest[] | null>(null);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dog, setDog] = useState<RegisteredDog | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [request, setRequest] = useState<string | null>(params.enquiry ?? null);
  const [cadence, setCadence] = useState<"weekly" | "alternating" | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [who, setWho] = useState<"dog" | "name">("dog");
  const [holderName, setHolderName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // The dogs, the day (who's in already), and the open requests.
  useEffect(() => {
    listRegisteredDogs()
      .then(setDogs)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load the dogs."));
    getTrainerCalendar(date, date)
      .then((rows) => setAlreadyIn(new Set(rows.filter((r) => (oneToOne ? r.kind === "one_to_one" : isFullDay(r)) && r.dogId).map((r) => r.dogId!))))
      .catch(() => {});
    if (!oneToOne) {
      listOnboardingRequests()
        .then(setRequests)
        .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load the meet & greet requests."));
    }
  }, [date, oneToOne]);

  function choosePath(p: Path) {
    hapticSelection();
    animateListChange();
    setPath(p);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (oneToOne) {
        if (!time) throw new Error("Pick a time.");
        if (who === "dog" && !dog) throw new Error("Pick the dog.");
        if (who === "name" && !holderName.trim()) throw new Error("Add a name for the 1-1.");
        await addOneToOne({ date, time, dog: who === "dog" ? dog : null, holderName: who === "name" ? holderName : null, notes });
        hapticSuccess();
        router.back();
        return;
      }
      if (path === "registered") {
        if (!dog) throw new Error("Pick the dog.");
        if (!plan) throw new Error("Choose just this day, every week or every other week.");
        if (plan === "one_off") await addOneOffDay(date, dog);
        else await addRegularPlace(date, plan, dog);
        hapticSuccess();
        router.back();
        return;
      }
      if (path === "onboard") {
        const req = requests?.find((r) => r.id === request);
        if (!request) throw new Error("Pick the meet & greet request.");
        if (!cadence) throw new Error("Choose every week or every other week.");
        const result = await sendOnboarding(request, date, cadence);
        hapticSuccess();
        const who = req?.name ?? "They";
        const sentBy = [result.emailed ? "by email" : null, result.messaged ? "in their chat" : null].filter(Boolean).join(" and ");
        Alert.alert(
          "Link sent — their place is held",
          `${sentBy ? `${who} has the join link ${sentBy}.` : `The link didn't go out automatically${result.joinUrl ? `: send them ${result.joinUrl}` : ""}.`} Their ${pluralDay(weekday!)} place is held from ${formatShortDay(date)}${cadence === "alternating" ? ", every other week" : ""}, and ${req?.dogNames || "their dog"} fills in once they register.`,
          [{ text: "Done", onPress: () => router.back() }],
        );
        return;
      }
      throw new Error("Choose a registered dog or Send onboarding.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      if (/^(Pick|Choose|Add a name)/.test(message)) hapticWarning();
      else hapticError();
      Alert.alert(/^(Pick|Choose|Add a name)/.test(message) ? "Nearly there" : "That didn't go through", message);
    } finally {
      setSaving(false);
    }
  }

  const saveLabel = oneToOne
    ? "Add 1-1"
    : path === "onboard"
      ? "Send onboarding link"
      : plan === "one_off"
        ? "Add for this day"
        : plan
          ? `Add every ${plan === "alternating" ? "other " : ""}${weekday?.replace(/^./, (c) => c.toUpperCase())}`
          : "Add dog";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={oneToOne ? "Add a 1-1" : "Add new dog"} subtitle={formatDay(date)} />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        {loadError && <Text style={{ color: colors.danger, marginBottom: 12 }}>{loadError}</Text>}

        {oneToOne ? (
          <>
            <GroupHeading style={{ marginTop: 8 }}>Time</GroupHeading>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {TIMES.map((t) => {
                const on = time === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      hapticSelection();
                      setTime(t);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : "transparent" }}
                  >
                    <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 14, fontWeight: "700" }}>{formatTime(t)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <GroupHeading>Who</GroupHeading>
            <View style={{ gap: 10, marginBottom: 14 }}>
              <ChoiceCard icon="paw-outline" title="A registered dog" selected={who === "dog"} onPress={() => (hapticSelection(), setWho("dog"))} />
              <ChoiceCard icon="create-outline" title="Someone not signed up yet" description="Type their name and their dog's." selected={who === "name"} onPress={() => (hapticSelection(), setWho("name"))} />
            </View>
            {who === "dog" ? (
              <DogPicker dogs={dogs} selected={dog} onSelect={setDog} alreadyIn={alreadyIn} />
            ) : (
              <TextField value={holderName} onChangeText={setHolderName} placeholder="e.g. Sam Taylor — Biscuit" autoCapitalize="words" />
            )}

            <GroupHeading>Notes</GroupHeading>
            <TextField value={notes} onChangeText={setNotes} placeholder="What it's for (optional)" autoCapitalize="sentences" autoCorrect multiline style={{ minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.surface }} />
          </>
        ) : (
          <>
            <GroupHeading style={{ marginTop: 8 }}>How</GroupHeading>
            <View style={{ gap: 10 }}>
              <ChoiceCard
                icon="paw-outline"
                title="Add a registered dog"
                description="A dog that's signed up: for this day, or a regular place from it."
                selected={path === "registered"}
                onPress={() => choosePath("registered")}
              />
              <ChoiceCard
                icon="paper-plane-outline"
                title="Send onboarding"
                description={`After a meet & greet: emails them the join link and holds a ${pluralDay(weekday!)} place. Their dog's name fills in once they register.`}
                selected={path === "onboard"}
                onPress={() => choosePath("onboard")}
              />
            </View>

            {path === "registered" && (
              <>
                <GroupHeading>Dog</GroupHeading>
                <DogPicker dogs={dogs} selected={dog} onSelect={setDog} alreadyIn={alreadyIn} />
                <GroupHeading>When</GroupHeading>
                <View style={{ gap: 10 }}>
                  <ChoiceCard icon="today-outline" title="Just this day (one-off)" description={formatDay(date)} selected={plan === "one_off"} onPress={() => (hapticSelection(), setPlan("one_off"))} />
                  <ChoiceCard icon="repeat-outline" title="Every week from this date" description={`Every ${weekday!.replace(/^./, (c) => c.toUpperCase())}, from ${formatShortDay(date)}`} selected={plan === "weekly"} onPress={() => (hapticSelection(), setPlan("weekly"))} />
                  <ChoiceCard icon="swap-vertical-outline" title="Every other week from this date" description={`Alternate ${pluralDay(weekday!)}, from ${formatShortDay(date)}`} selected={plan === "alternating"} onPress={() => (hapticSelection(), setPlan("alternating"))} />
                </View>
              </>
            )}

            {path === "onboard" && (
              <>
                <GroupHeading>Meet & greet request</GroupHeading>
                {!requests ? (
                  <ActivityIndicator color={colors.foreground} style={{ marginVertical: 20 }} />
                ) : requests.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 14 }}>No open meet & greet requests.</Text>
                ) : (
                  <ListBox>
                    {requests.map((r, i) => (
                      <PickRow
                        key={r.id}
                        first={i === 0}
                        title={r.name}
                        subtitle={[r.dogNames, STATUS_LABEL[r.status]].filter(Boolean).join(" · ")}
                        avatar={{ name: r.name, url: null }}
                        selected={request === r.id}
                        onPress={() => {
                          hapticSelection();
                          setRequest(r.id);
                        }}
                      />
                    ))}
                  </ListBox>
                )}
                <GroupHeading>How often</GroupHeading>
                <View style={{ gap: 10 }}>
                  <ChoiceCard icon="repeat-outline" title="Every week" description={`Every ${weekday!.replace(/^./, (c) => c.toUpperCase())}, from ${formatShortDay(date)}`} selected={cadence === "weekly"} onPress={() => (hapticSelection(), setCadence("weekly"))} />
                  <ChoiceCard icon="swap-vertical-outline" title="Every other week" description={`Alternate ${pluralDay(weekday!)}, from ${formatShortDay(date)}`} selected={cadence === "alternating"} onPress={() => (hapticSelection(), setCadence("alternating"))} />
                </View>
              </>
            )}
          </>
        )}

        {(oneToOne || path) && <BigButton label={saveLabel} icon={path === "onboard" && !oneToOne ? "paper-plane" : "add"} onPress={save} busy={saving} style={{ marginTop: 28 }} />}
      </FormScrollView>
    </View>
  );
}
