import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Share, Switch, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { ChipRow } from "@/components/trainer/chips";
import { ActionTile, BigButton, ChoiceCard, DetailCard } from "@/components/trainer/cards";
import { FormScrollView, LoadingState, Tag, TextField } from "@/components/ui";
import {
  bookMeetGreet,
  cameIn,
  closeNotAFit,
  DD_DONE,
  DD_LABEL,
  enquiryDogs,
  getEnquiry,
  getOnboardingProgress,
  helpWith,
  joinUrl,
  markSetUp,
  meetGreetLabel,
  postcodeArea,
  reopen,
  setTrainingDay,
  stageOf,
  STAGES,
  startEnquiryOnboarding,
  type Enquiry,
  type OnboardingProgress,
} from "@/data/onboarding-board";
import { addDays, conversationForAccount, formatShortDay, formatTime, pluralDay, todayISO, weekdayOf, type Weekday } from "@/data/trainer-schedule";
import { config } from "@/lib/config";
import { callNumber, openWhatsApp, sendEmail } from "@/lib/contact";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
/** 8am to 7:30pm, every half hour. */
const TIMES = Array.from({ length: 24 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ask first; then a tick or a buzz and an alert for how it went. */
function confirmThen(title: string, message: string, action: string, run: () => Promise<void>, destructive = false) {
  hapticWarning();
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: destructive ? "destructive" : "default", onPress: () => void run() },
  ]);
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 15, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Check({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingVertical: 8 }}>
      <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={22} color={done ? colors.success : colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>{detail}</Text>
      </View>
    </View>
  );
}

/** The next `n` dates from today, for the meet & greet. */
function nextDates(n: number): { value: string; label: string }[] {
  const today = todayISO();
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i);
    return { value: d, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatShortDay(d) };
  });
}

/** The next eight `day`s from today, for a first session. */
function nextOn(day: Weekday): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let d = todayISO();
  while (out.length < 8) {
    if (weekdayOf(d) === day) out.push({ value: d, label: formatShortDay(d) });
    d = addDays(d, 1);
  }
  return out;
}

/** "2026-11-12T14:30" in the phone's own time (the club's), as a timestamp. */
function localISO(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function londonParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/**
 * Trainer: one request on the Onboarding board — the website's
 * OnboardingBoard card in full. Who they are with Call, Email, Message
 * (their chat, once they have an account) and WhatsApp; everything they
 * told us; the meet & greet; and the next step for its stage: Book meet &
 * greet, Start onboarding (the website emails the join link and sets up
 * the Direct Debit), Set training day (holds their place on the
 * calendar), the checklist, Share the join link, Re-send it, Mark set up,
 * Not a fit, Reopen. Each one asks first.
 */
export default function OnboardingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [e, setE] = useState<Enquiry | null | undefined>(undefined);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<"meet" | "day" | "close" | null>(null);
  const [showAll, setShowAll] = useState(false);

  // The forms.
  const [meetDate, setMeetDate] = useState<string | null>(null);
  const [meetTime, setMeetTime] = useState<string | null>(null);
  const [meetNotes, setMeetNotes] = useState("");
  const [emailThem, setEmailThem] = useState(true);
  const [day, setDay] = useState<Weekday | null>(null);
  const [cadence, setCadence] = useState<"weekly" | "alternating">("weekly");
  const [firstOn, setFirstOn] = useState<string | null>(null);
  const [reason, setReason] = useState("Not a fit");

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const next = await getEnquiry(String(id));
      setE(next);
      if (next?.status === "onboarding" || (next && next.onboardingToken)) {
        const p = await getOnboardingProgress([next]).catch(() => ({}) as Record<string, OnboardingProgress>);
        setProgress(p[next.id] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this request.");
      setE((prev) => (prev === undefined ? null : prev));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!e) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Request" />
        <LoadingState error={e === null ? (error ?? "This request isn't on file any more.") : error} />
      </View>
    );
  }

  const enquiry = e;
  const first = enquiry.name.split(" ")[0] || "them";
  const stage = stageOf(enquiry);
  const dogs = enquiryDogs(enquiry);
  const dogWords = enquiry.dogNames ? enquiry.dogNames.replace(/, ([^,]*)$/, " & $1") : "their dog";
  const link = joinUrl(enquiry, config.siteUrl);

  async function act(key: string, run: () => Promise<string | void>) {
    setBusy(key);
    try {
      const message = await run();
      hapticSuccess();
      animateListChange();
      setForm(null);
      await load();
      if (message) Alert.alert("Done", message);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function openForm(which: "meet" | "day" | "close") {
    animateListChange();
    if (which === "meet") {
      const at = enquiry.meetGreetAt ? londonParts(enquiry.meetGreetAt) : null;
      setMeetDate(at?.date ?? null);
      setMeetTime(at?.time ?? null);
      setMeetNotes(enquiry.meetGreetNotes);
      setEmailThem(true);
    }
    if (which === "day") {
      setDay(enquiry.trainingDay);
      setCadence(enquiry.trainingCadence ?? "weekly");
      setFirstOn(enquiry.firstSessionOn);
    }
    if (which === "close") setReason("Not a fit");
    setForm(form === which ? null : which);
  }

  async function message() {
    if (!enquiry.accountId) return;
    setBusy("chat");
    try {
      const conversationId = await conversationForAccount(enquiry.accountId);
      router.push({ pathname: "/conversation/[id]", params: { id: conversationId } });
    } catch {
      hapticError();
      Alert.alert("Couldn't open their chat", "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function saveMeet() {
    if (!meetDate || !meetTime) {
      hapticWarning();
      Alert.alert("Nearly there", "Choose a day and a time.");
      return;
    }
    const iso = localISO(meetDate, meetTime);
    confirmThen(
      enquiry.meetGreetAt ? "Move the meet & greet?" : "Book the meet & greet?",
      `${meetGreetLabel(iso)}${emailThem ? `. ${first} gets an email with the day and time.` : "."}`,
      enquiry.meetGreetAt ? "Move it" : "Book it",
      () =>
        act("meet", async () => {
          const res = await bookMeetGreet(enquiry, iso, meetNotes, emailThem);
          if (!emailThem) return "Meet & greet booked.";
          return res.emailed ? `Meet & greet booked. ${first} has been emailed.` : "Meet & greet booked. The email didn't send, so let them know yourself.";
        }),
    );
  }

  function start(resend: boolean) {
    confirmThen(
      resend ? `Re-send ${first}'s join link?` : `Start onboarding ${first}?`,
      resend
        ? "They get the same link again by email (and in their chat, if they have an account)."
        : `They'll be emailed a link to set up their Direct Debit and register ${dogWords}.`,
      resend ? "Re-send" : "Start onboarding",
      () =>
        act(resend ? "resend" : "start", async () => {
          const r = await startEnquiryOnboarding(enquiry);
          const how = [r.emailed && "emailed", r.messaged && "messaged in their chat"].filter(Boolean).join(" and ");
          return how
            ? `${resend ? "Link re-sent" : "Onboarding started"}: ${first} has been ${how}.`
            : `${resend ? "Link ready" : "Onboarding started"}. The email didn't go, so share the join link with ${first} yourself.`;
        }),
    );
  }

  function saveDay() {
    if (!day || !firstOn) {
      hapticWarning();
      Alert.alert("Nearly there", "Choose the day and the first session.");
      return;
    }
    confirmThen(
      `${cap(day)}s for ${dogWords}?`,
      `${cadence === "alternating" ? "Every other week" : "Every week"}, first session ${formatShortDay(firstOn)}. Their place is held on the calendar, and they get reminders to register before then.`,
      "Save",
      () => act("day", async () => setTrainingDay(enquiry, day, cadence, firstOn).then(() => "Training day saved.")),
    );
  }

  function close() {
    confirmThen(`Close ${first}'s request?`, reason.trim() ? `Your note: ${reason.trim()}` : "It moves to Closed.", "Close request", () => act("close", () => closeNotAFit(enquiry, reason)), true);
  }

  const answers = Object.entries(enquiry.details ?? {}).filter(([k, v]) => v !== null && v !== "" && !["extraDogs", "company", "dogs", "help"].includes(k) && typeof v !== "object");
  const ddDone = DD_DONE.includes(progress?.directDebit ?? "");
  const dogsDone = !!progress && progress.dogs.length > 0 && progress.dogs.every((d) => d.registered);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={enquiry.name || "Request"} subtitle={`${enquiry.kind === "booking" ? "Meet & greet form" : "Contact form"} · came in ${cameIn(enquiry.createdAt)}`} />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        {/* Who, and how to reach them. */}
        <DetailCard index={0}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <AvatarCircle name={enquiry.name || enquiry.email || "?"} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{enquiry.name}</Text>
              {!!enquiry.email && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{enquiry.email}</Text>}
              {!!enquiry.phone && <Text style={{ color: colors.muted, fontSize: 13 }}>{enquiry.phone}</Text>}
            </View>
            <Tag label={STAGES.find((s) => s.value === stage)?.label ?? stage} tone={stage === "closed" ? colors.muted : colors.success} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <ActionTile icon="call" label="Call" onPress={() => callNumber(enquiry.phone)} disabled={!enquiry.phone} />
            <ActionTile icon="mail" label="Email" onPress={() => sendEmail(enquiry.email)} disabled={!enquiry.email} />
            <ActionTile icon="chatbubble-ellipses" label="Message" onPress={message} busy={busy === "chat"} disabled={!enquiry.accountId} />
            <ActionTile icon="logo-whatsapp" label="WhatsApp" onPress={() => openWhatsApp(enquiry.phone)} disabled={!enquiry.phone} />
          </View>
          {!enquiry.accountId && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Message opens once they have an account with this email.</Text>}
        </DetailCard>

        {/* What they told us. */}
        <DetailCard index={1} title="Their request" icon="document-text-outline">
          {!!enquiry.service && <Row label="Service" value={enquiry.service} />}
          {dogs.length > 0 && <Row label={dogs.length === 1 ? "Dog" : "Dogs"} value={dogs.join("\n")} />}
          {!!postcodeArea(enquiry) && <Row label="Postcode" value={String(enquiry.details.postcode ?? postcodeArea(enquiry))} />}
          {!!helpWith(enquiry) && <Row label="Help with" value={helpWith(enquiry)!} />}
          {enquiry.kind === "contact" && !!enquiry.message && <Row label="Message" value={enquiry.message} />}
          <Row label="Came in" value={cameIn(enquiry.createdAt)} last={answers.length === 0} />
          {answers.length > 0 && (
            <>
              <Pressable onPress={() => (animateListChange(), setShowAll((s) => !s))} style={{ paddingVertical: 10 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" }}>{showAll ? "Hide answers" : "Show all answers"}</Text>
              </Pressable>
              {showAll && answers.map(([k, v], i) => <Row key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} value={String(v)} last={i === answers.length - 1} />)}
            </>
          )}
        </DetailCard>

        {/* The meet & greet. */}
        {(enquiry.meetGreetAt || stage === "new" || stage === "meet_greet_booked") && (
          <DetailCard index={2} title="Meet & greet" icon="people-outline">
            {enquiry.meetGreetAt ? (
              <>
                <Text style={{ color: colors.success, fontSize: 15, fontWeight: "600" }}>{meetGreetLabel(enquiry.meetGreetAt)}</Text>
                {!!enquiry.meetGreetNotes && <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 4 }}>{enquiry.meetGreetNotes}</Text>}
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 14 }}>Not booked yet.</Text>
            )}
            {(stage === "new" || stage === "meet_greet_booked") && (
              <BigButton
                icon="calendar-outline"
                label={enquiry.meetGreetAt ? "Change meet & greet" : "Book meet & greet"}
                variant={stage === "new" ? "solid" : "outline"}
                onPress={() => openForm("meet")}
                style={{ marginTop: 14 }}
              />
            )}
            {form === "meet" && (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Day</Text>
                <ChipRow options={nextDates(28)} value={meetDate} onChange={setMeetDate} />
                <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 }}>Time</Text>
                <ChipRow options={TIMES.map((t) => ({ value: t, label: formatTime(t) }))} value={meetTime} onChange={setMeetTime} />
                <TextField
                  value={meetNotes}
                  onChangeText={setMeetNotes}
                  placeholder="Notes: address, parking, what to bring…"
                  autoCapitalize="sentences"
                  autoCorrect
                  multiline
                  style={{ minHeight: 70, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.background, marginTop: 6 }}
                />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Switch value={emailThem} onValueChange={setEmailThem} />
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>Email {first} the day and time</Text>
                </View>
                <BigButton icon="checkmark" label="Save meet & greet" onPress={saveMeet} busy={busy === "meet"} />
              </View>
            )}
          </DetailCard>
        )}

        {/* Onboarding: the checklist and its steps. */}
        {(stage === "onboarding" || stage === "set_up") && (
          <DetailCard index={3} title="Checklist" icon="checkbox-outline">
            <Check done={ddDone} label="Direct Debit" detail={progress ? (DD_LABEL[progress.directDebit] ?? progress.directDebit) : "Loading…"} />
            <Check done={!!progress?.accountLinked || !!enquiry.accountId} label="Account" detail={enquiry.accountId ? "Created and linked" : "Not created yet (or not opened the link signed in)"} />
            <Check
              done={!!enquiry.trainingDay && !!enquiry.firstSessionOn}
              label="Training day"
              detail={
                enquiry.trainingDay && enquiry.firstSessionOn
                  ? `${pluralDay(enquiry.trainingDay)}, ${enquiry.trainingCadence === "alternating" ? "every other week" : "every week"} · first session ${formatShortDay(enquiry.firstSessionOn)}`
                  : "Not set yet"
              }
            />
            <Check
              done={dogsDone}
              label="Dogs registered (health, vet, consent & waiver)"
              detail={!progress || progress.dogs.length === 0 ? "Not yet" : progress.dogs.map((d) => `${d.name}: ${d.registered ? "done" : "not yet"}`).join(" · ")}
            />

            {stage === "onboarding" && (
              <View style={{ gap: 10, marginTop: 12 }}>
                <BigButton icon="calendar-outline" label={enquiry.trainingDay ? "Change training day" : "Set training day"} onPress={() => openForm("day")} />
                {form === "day" && (
                  <View style={{ gap: 10, paddingVertical: 6 }}>
                    <ChipRow
                      options={WEEKDAYS.map((d) => ({ value: d, label: pluralDay(d) }))}
                      value={day}
                      onChange={(d) => {
                        setDay(d);
                        setFirstOn(null);
                      }}
                    />
                    <ChoiceCard icon="repeat-outline" title="Every week" selected={cadence === "weekly"} onPress={() => setCadence("weekly")} />
                    <ChoiceCard icon="swap-vertical-outline" title="Every other week" selected={cadence === "alternating"} onPress={() => setCadence("alternating")} />
                    {day && (
                      <>
                        <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>First session</Text>
                        <ChipRow options={nextOn(day)} value={firstOn} onChange={setFirstOn} />
                      </>
                    )}
                    <BigButton icon="checkmark" label="Save training day" onPress={saveDay} busy={busy === "day"} />
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <BigButton
                    icon="share-outline"
                    label="Share join link"
                    variant="outline"
                    disabled={!link}
                    onPress={() => link && Share.share({ message: `Here's everything to do before your first session: ${link}` }).catch(() => {})}
                    style={{ flex: 1 }}
                  />
                  <BigButton icon="paper-plane-outline" label="Re-send" variant="outline" onPress={() => start(true)} busy={busy === "resend"} style={{ flex: 1 }} />
                </View>
                <BigButton
                  icon="checkmark-done"
                  label="Mark set up"
                  variant="outline"
                  onPress={() =>
                    confirmThen(
                      `${first} is all set up?`,
                      ddDone && dogsDone ? "It moves to Set up." : "Not everything on the checklist is ticked yet. It moves to Set up anyway.",
                      "Mark set up",
                      () => act("setup", () => markSetUp(enquiry)),
                    )
                  }
                  busy={busy === "setup"}
                />
              </View>
            )}
          </DetailCard>
        )}

        {/* The next step. */}
        <View style={{ gap: 10, marginTop: 20 }}>
          {(stage === "new" || stage === "meet_greet_booked") && (
            <BigButton icon="paper-plane" label="Start onboarding" variant={stage === "meet_greet_booked" ? "solid" : "outline"} onPress={() => start(false)} busy={busy === "start"} />
          )}
          {(stage === "new" || stage === "meet_greet_booked") && (
            <>
              <BigButton icon="close-circle-outline" label="Not a fit" variant="outline" onPress={() => openForm("close")} />
              {form === "close" && (
                <View style={{ gap: 8 }}>
                  <TextField value={reason} onChangeText={setReason} placeholder="A note for yourself (optional)" autoCapitalize="sentences" autoCorrect />
                  <BigButton label="Close request" onPress={close} busy={busy === "close"} />
                </View>
              )}
            </>
          )}
          {(stage === "set_up" || stage === "closed") && (
            <BigButton
              icon="refresh"
              label="Reopen"
              variant="outline"
              onPress={() => confirmThen(`Reopen ${first}'s request?`, "It goes back to New.", "Reopen", () => act("reopen", () => reopen(enquiry)))}
              busy={busy === "reopen"}
            />
          )}
          {stage === "closed" && !!enquiry.closedReason && <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>Closed: {enquiry.closedReason}</Text>}
        </View>
      </FormScrollView>
    </View>
  );
}
