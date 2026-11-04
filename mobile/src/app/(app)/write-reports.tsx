import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { ReportDetails, ReportHomework, ReportLoading, useReportDraft } from "@/components/trainer/report-card-editor";
import { CARD, FormScrollView, LoadingState, Tag } from "@/components/ui";
import { presentDogs } from "@/data/attendance";
import { getRouteStops } from "@/data/route";
import { formatDay, todayISO } from "@/data/trainer-schedule";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

type Outcome = "sent" | "skipped" | "draft";
type QueueDog = { id: string; name: string; photoUrl: string | null; alreadySent: boolean };
type Step = "card" | "homework";

/** The dogs who came (the register; else the pick-ups ticked off), with any card already sent for the day. */
async function loadQueue(date: string): Promise<QueueDog[]> {
  let ids = await presentDogs(date).catch(() => [] as string[]);
  if (ids.length === 0) {
    const stops = await getRouteStops(date).catch(() => null);
    ids = stops ? [...stops.pickup.values()].filter((s) => s.status === "done").sort((a, b) => a.position - b.position).map((s) => s.dogId) : [];
  }
  if (ids.length === 0) return [];
  const [dogs, cards] = await Promise.all([
    supabase.from("dogs").select("id, name, photo_url").in("id", ids),
    supabase.from("report_cards").select("dog_id").eq("session_date", date).eq("status", "published").in("dog_id", ids),
  ]);
  if (dogs.error) throw new Error(dogs.error.message);
  const byId = new Map(((dogs.data ?? []) as { id: string; name: string; photo_url: string | null }[]).map((d) => [d.id, d]));
  const sent = new Set(((cards.data ?? []) as { dog_id: string }[]).map((c) => c.dog_id));
  return ids.filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id)!.name, photoUrl: byId.get(id)!.photo_url, alreadySent: sent.has(id) }));
}

/** "Dog 2 of 5", and a bar with a segment per dog: sent, skipped, this one. */
function Progress({ queue, index, outcomes }: { queue: QueueDog[]; index: number; outcomes: Record<string, Outcome> }) {
  return (
    <View style={{ gap: 8, marginBottom: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }} accessibilityLiveRegion="polite">
        Dog {index + 1} of {queue.length}
      </Text>
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {queue.map((d, i) => {
          const o = outcomes[d.id];
          const bg = o === "sent" ? colors.success : o === "skipped" || o === "draft" ? "rgba(245,245,242,0.25)" : i === index ? colors.accent : "rgba(245,245,242,0.08)";
          return <View key={d.id} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: bg }} />;
        })}
      </View>
    </View>
  );
}

/**
 * One dog's report: the report card, then its homework, then Send. Skip
 * saves what's written as a draft and moves on. `leave` is set to save the
 * draft if the page is closed part way.
 */
function DogStep({
  dog,
  date,
  onDone,
  leave,
}: {
  dog: QueueDog;
  date: string;
  onDone: (o: Outcome) => void;
  leave: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const draft = useReportDraft({ dogId: dog.id, date });
  const [step, setStep] = useState<Step>("card");
  const [busy, setBusy] = useState<"next" | "send" | "skip" | null>(null);

  // Closing the page part way keeps what's written.
  useEffect(() => {
    leave.current = async () => {
      if (draft.touched && draft.hasContent && !draft.sent) await draft.saveDraft().catch(() => undefined);
    };
  });

  if (!draft.loaded || !draft.dog) return <ReportLoading draft={draft} />;
  const first = (draft.dog.name || "").trim();

  async function next() {
    setBusy("next");
    try {
      if (draft.touched && draft.hasContent) await draft.saveDraft();
      animateListChange();
      setStep("homework");
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save the draft", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    setBusy("skip");
    try {
      const keep = draft.hasContent && !draft.sent;
      if (keep && draft.touched) await draft.saveDraft();
      onDone(keep || draft.card ? "draft" : "skipped");
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save the draft", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const missing = draft.problem();
    if (missing) {
      hapticWarning();
      // Missing the summary or a win: back to the card.
      if (!/homework/i.test(missing)) setStep("card");
      Alert.alert("Nearly there", missing);
      return;
    }
    setBusy("send");
    try {
      await draft.send();
      hapticSuccess();
      onDone("sent");
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
        <AvatarCircle name={draft.dog.name} avatarUrl={draft.dog.photoUrl} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }} numberOfLines={1}>
            {draft.dog.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{draft.sent ? "Already sent" : step === "card" ? "1 · Report card" : "2 · Homework, then send"}</Text>
        </View>
        {draft.card && <Tag label={draft.sent ? "Sent" : "Draft"} tone={draft.sent ? colors.success : colors.warning} />}
      </View>

      {draft.sent ? (
        <>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 16 }}>{first}&apos;s report card for today has already gone to their owner.</Text>
          <BigButton icon="arrow-forward" label="Next dog" onPress={() => onDone("sent")} style={{ marginTop: 24 }} />
        </>
      ) : step === "card" ? (
        <>
          <ReportDetails draft={draft} />
          <View style={{ gap: 10, marginTop: 24 }}>
            <BigButton icon="arrow-forward" label="Next: attach homework" onPress={next} busy={busy === "next"} disabled={busy !== null && busy !== "next"} />
            <BigButton icon="play-skip-forward-outline" label="Skip" variant="outline" onPress={skip} busy={busy === "skip"} disabled={busy !== null && busy !== "skip"} />
          </View>
        </>
      ) : (
        <>
          <ReportHomework draft={draft} />
          <View style={{ gap: 10, marginTop: 24 }}>
            <BigButton icon="paper-plane" label={`Send ${first}'s report`} onPress={send} busy={busy === "send"} disabled={busy !== null && busy !== "send"} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <BigButton icon="arrow-back" label="Report card" variant="outline" onPress={() => (animateListChange(), setStep("card"))} disabled={busy !== null} style={{ flex: 1 }} />
              <BigButton icon="play-skip-forward-outline" label="Skip" variant="outline" onPress={skip} busy={busy === "skip"} disabled={busy !== null && busy !== "skip"} style={{ flex: 1 }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
              Their owner gets an email and an app notification, and the homework goes on their Homework page. Skip keeps what you&apos;ve written as a draft.
            </Text>
          </View>
        </>
      )}
    </FormScrollView>
  );
}

/**
 * Trainer: "Write today's reports", from Today. A step for each dog who
 * came (marked present on the register, or a 1-1 done): the report card →
 * attach homework → Send → the next dog, with "Dog 2 of 5" and a bar along
 * the top. Skip moves on and keeps a draft (data/trainer-reports.ts: owners
 * can't see drafts); a card already sent today is passed over. At the end,
 * how many went, and a way back to the skipped ones.
 */
export default function WriteReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date)) ? String(params.date) : todayISO();
  const [queue, setQueue] = useState<QueueDog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [finished, setFinished] = useState(false);
  const leave = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    loadQueue(date)
      .then((q) => {
        setQueue(q);
        const sent: Record<string, Outcome> = {};
        for (const d of q) if (d.alreadySent) sent[d.id] = "sent";
        setOutcomes(sent);
        const start = q.findIndex((d) => !d.alreadySent);
        if (start < 0) setFinished(q.length > 0);
        else setIndex(start);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load today's dogs."));
  }, [date]);

  function done(o: Outcome) {
    if (!queue) return;
    const dog = queue[index];
    const nextOutcomes = { ...outcomes, [dog.id]: o };
    setOutcomes(nextOutcomes);
    leave.current = null;
    const nextIndex = queue.findIndex((d, i) => i > index && !nextOutcomes[d.id]);
    animateListChange();
    if (nextIndex < 0) setFinished(true);
    else setIndex(nextIndex);
  }

  function backToSkipped() {
    if (!queue) return;
    const i = queue.findIndex((d) => outcomes[d.id] !== "sent");
    if (i < 0) return;
    setOutcomes((prev) => {
      const next: Record<string, Outcome> = {};
      for (const [k, v] of Object.entries(prev)) if (v === "sent") next[k] = v;
      return next;
    });
    animateListChange();
    setIndex(i);
    setFinished(false);
  }

  async function close() {
    await leave.current?.();
    router.back();
  }

  const sentNow = queue ? queue.filter((d) => outcomes[d.id] === "sent" && !d.alreadySent).length : 0;
  const sentAll = queue ? queue.filter((d) => outcomes[d.id] === "sent").length : 0;
  const notSent = queue ? queue.filter((d) => outcomes[d.id] !== "sent") : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Today's reports" subtitle={formatDay(date)} onBack={close} />
      {!queue ? (
        <LoadingState error={error} />
      ) : queue.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={[CARD, { alignItems: "center", paddingVertical: 28, marginTop: 8 }]}>
            <Ionicons name="clipboard-outline" size={30} color={colors.muted} />
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 10 }}>No one on the register yet</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, textAlign: "center", lineHeight: 20 }}>
              Tap Picked up for each dog on Today (or Done on a 1-1), and they&apos;ll be here to write up.
            </Text>
          </View>
          <BigButton label="Back to Today" variant="outline" onPress={() => router.back()} style={{ marginTop: 20 }} />
        </View>
      ) : finished ? (
        <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          <Appear index={0} style={[CARD, { alignItems: "center", paddingVertical: 28, marginTop: 8 }]}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800", marginTop: 10 }}>
              {sentNow === 0 ? "No reports sent" : `${sentNow} report${sentNow === 1 ? "" : "s"} sent`}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 20 }}>
              {sentAll === queue.length
                ? `That's every dog from today. Lovely work!`
                : `${sentAll} of ${queue.length} done today. ${notSent.length} skipped: anything written is saved as a draft.`}
            </Text>
          </Appear>
          <View style={[CARD, { paddingVertical: 4, marginTop: 14 }]}>
            {queue.map((d, i) => {
              const o = outcomes[d.id];
              return (
                <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <AvatarCircle name={d.name} avatarUrl={d.photoUrl} size={34} />
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Tag label={o === "sent" ? (d.alreadySent ? "Sent earlier" : "Sent") : o === "draft" ? "Draft" : "Skipped"} tone={o === "sent" ? colors.success : o === "draft" ? colors.warning : undefined} />
                </View>
              );
            })}
          </View>
          <View style={{ gap: 10, marginTop: 24 }}>
            <BigButton icon="checkmark" label="Back to Today" onPress={() => router.back()} />
            {notSent.length > 0 && <BigButton icon="refresh" label={`Write the ${notSent.length} skipped`} variant="outline" onPress={backToSkipped} />}
          </View>
        </FormScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Progress queue={queue} index={index} outcomes={outcomes} />
          </View>
          <DogStep key={queue[index].id} dog={queue[index]} date={date} onDone={done} leave={leave} />
        </View>
      )}
    </View>
  );
}
