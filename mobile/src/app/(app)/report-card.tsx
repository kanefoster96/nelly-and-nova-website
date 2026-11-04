import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { ReportDetails, ReportHomework, ReportLoading, useReportDraft } from "@/components/trainer/report-card-editor";
import { FormScrollView, Tag } from "@/components/ui";
import { formatDay, todayISO } from "@/data/trainer-schedule";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

/**
 * Trainer: write a dog's report card, or attach homework (from the dog's
 * page). The website's report card entry (components/reports/
 * ReportEntryModal.tsx) in the app: a summary of the day, three things they
 * did well, their biggest strength and area to improve, and homework —
 * categories with drills, picked from the drill library or typed. The
 * card's title is its categories. Save draft keeps it private; Send to
 * owner publishes it (an email and an app notification, through the
 * website). For a card that's already been sent only the homework
 * changes. `focus=homework`: homework first, the rest optional. The
 * editor itself is shared with the end-of-day reports
 * (components/trainer/report-card-editor.tsx).
 */
export default function ReportCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dogId: string; cardId?: string; focus?: string }>();
  const dogId = String(params.dogId ?? "");
  const homeworkFirst = params.focus === "homework";
  const [date] = useState(todayISO());
  const draft = useReportDraft({ dogId, date, cardId: params.cardId ? String(params.cardId) : null });
  const [showMore, setShowMore] = useState(!homeworkFirst);
  const [busy, setBusy] = useState<"draft" | "send" | "delete" | null>(null);

  const { dog, card, sent } = draft;
  if (!draft.loaded || !dog) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={homeworkFirst ? "Attach homework" : "Report card"} />
        <ReportLoading draft={draft} />
      </View>
    );
  }
  const written = showMore || !!draft.summary || draft.wins.some((w) => w.trim());

  async function save(send: boolean) {
    const missing = send || sent ? draft.problem(homeworkFirst) : null;
    if (missing) {
      hapticWarning();
      Alert.alert("Nearly there", missing);
      return;
    }
    setBusy(send ? "send" : "draft");
    try {
      if (sent) {
        await draft.saveHomework();
        hapticSuccess();
        Alert.alert("Homework updated", `${dog!.name}'s owner sees the change straight away.`, [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      if (!send) {
        await draft.saveDraft();
        hapticSuccess();
        Alert.alert("Draft saved", "Owners can't see drafts. Send it when it's ready.", [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      const res = await draft.send();
      hapticSuccess();
      Alert.alert(
        "Sent",
        res.notified > 0 ? `${dog!.name}'s owner has been emailed and notified.` : `${dog!.name}'s owner will see it next time they open the app.`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function confirmSend() {
    const missing = draft.problem(homeworkFirst);
    if (missing) {
      hapticWarning();
      Alert.alert("Nearly there", missing);
      return;
    }
    hapticWarning();
    if (sent) {
      Alert.alert(`Update ${dog!.name}'s homework?`, "Their owner sees the change straight away.", [
        { text: "Cancel", style: "cancel" },
        { text: "Update", onPress: () => save(false) },
      ]);
      return;
    }
    Alert.alert(
      homeworkFirst ? `Send ${dog!.name}'s homework?` : `Send ${dog!.name}'s report card?`,
      "Their owner gets an email and an app notification, and the homework goes on their Homework page to practise on 3 days.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => save(true) },
      ],
    );
  }

  function confirmDelete() {
    if (!card) return;
    hapticWarning();
    Alert.alert(sent ? "Delete this report card?" : "Delete this draft?", sent ? "The owner will no longer see it, or its homework." : "It hasn't been sent, so the owner won't notice.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          try {
            await draft.remove();
            hapticSuccess();
            router.back();
          } catch (err) {
            hapticError();
            Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={homeworkFirst ? "Attach homework" : sent ? "Report card" : "Write report card"} subtitle={formatDay(draft.date)} />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AvatarCircle name={dog.name} avatarUrl={dog.photoUrl} size={44} />
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", flex: 1 }}>{dog.name}</Text>
          {card && <Tag label={sent ? "Sent" : "Draft"} tone={sent ? colors.success : colors.warning} />}
        </View>
        {sent && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>This card&apos;s been sent: you can change its homework. A drill keeps its practice days when it&apos;s only renamed.</Text>}

        {homeworkFirst ? (
          <>
            <ReportHomework draft={draft} />
            {!sent && !written ? (
              <Pressable onPress={() => (animateListChange(), setShowMore(true))} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20 }}>
                <Ionicons name="add-circle-outline" size={18} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Add a summary and wins too</Text>
              </Pressable>
            ) : (
              <ReportDetails draft={draft} optional />
            )}
          </>
        ) : (
          <>
            <ReportDetails draft={draft} />
            <ReportHomework draft={draft} />
          </>
        )}

        <View style={{ gap: 10, marginTop: 28 }}>
          <BigButton icon="paper-plane" label={sent ? "Save homework" : homeworkFirst ? "Send homework" : "Send to owner"} onPress={confirmSend} busy={busy === "send"} disabled={busy !== null && busy !== "send"} />
          {!sent && <BigButton icon="save-outline" label="Save draft" variant="outline" onPress={() => save(false)} busy={busy === "draft"} disabled={busy !== null && busy !== "draft"} />}
          {card && (
            <Pressable onPress={confirmDelete} disabled={busy !== null} style={{ alignItems: "center", paddingVertical: 10 }}>
              {busy === "delete" ? <ActivityIndicator color={colors.muted} /> : <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>{sent ? "Delete report card" : "Delete draft"}</Text>}
            </Pressable>
          )}
        </View>
      </FormScrollView>
    </View>
  );
}
