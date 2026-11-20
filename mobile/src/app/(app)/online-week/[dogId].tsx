import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, GroupHeading } from "@/components/trainer/cards";
import { LibraryPicker } from "@/components/trainer/report-card-editor";
import { CARD } from "@/components/ui";
import { sendWeekHomework, type WeekDrill } from "@/data/memberships";
import { getCard } from "@/data/trainer-reports";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

const INPUT = { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, backgroundColor: colors.surface } as const;
const MULTILINE = { ...INPUT, minHeight: 90, textAlignVertical: "top" } as const;

/**
 * Trainer: "Send this week's homework" for an online member (from the
 * Online board). Drills from the homework library (or typed), notes for
 * the week, and a short review of last week. Sending publishes it as this
 * week's homework (an 'online_week' report card): it shows in the owner's
 * Homework tab, done on 3 days as any homework, and they're told
 * ("📚 Your homework for this week is ready").
 */
export default function OnlineWeekScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ dogId: string; name?: string; last?: string }>();
  const dogId = String(params.dogId);
  const name = params.name ? String(params.name) : "their dog";
  const [drills, setDrills] = useState<WeekDrill[]>([]);
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState("");
  const [typed, setTyped] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);

  if (!isTrainer) return <Redirect href="/community" />;

  const already = new Set(drills.map((d) => d.ref).filter((x): x is string => !!x));

  function addPicked(list: { category: string; name: string; ref: string; pillar: string }[]) {
    animateListChange();
    setDrills((prev) => [...prev, ...list.map((p) => ({ category: p.category, name: p.name, ref: p.ref, pillar: p.pillar }))]);
  }

  function addTyped() {
    const t = typed.trim();
    if (!t) return;
    animateListChange();
    setDrills((prev) => [...prev, { category: "This week", name: t }]);
    setTyped("");
  }

  async function copyLast() {
    if (!params.last) return;
    setCopying(true);
    try {
      const card = await getCard(String(params.last));
      const from = (card?.homework ?? []).flatMap((c) => c.drills.map((d) => ({ category: c.name, name: d.name, ref: d.ref ?? null, pillar: d.pillar ?? null })));
      if (from.length === 0) return Alert.alert("Nothing to copy", "Last week's homework had no drills.");
      animateListChange();
      setDrills(from);
    } catch {
      Alert.alert("Couldn't load last week's homework");
    } finally {
      setCopying(false);
    }
  }

  async function send() {
    if (drills.length === 0) return Alert.alert("Add at least one drill");
    setBusy(true);
    try {
      await sendWeekHomework({ dogId, drills, notes, review });
      hapticSuccess();
      Alert.alert("Homework sent", `${name}'s homework for this week is in their Homework tab, and they've been told.`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="This week's homework" subtitle={name} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <GroupHeading>Drills</GroupHeading>
        {drills.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 10 }}>Pick drills from the library, or type your own.</Text>
        ) : (
          <View style={[CARD, { paddingVertical: 4, marginBottom: 10 }]}>
            {drills.map((d, i) => (
              <View key={`${d.ref ?? d.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Ionicons name={d.ref ? "library-outline" : "create-outline"} size={16} color={colors.muted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15 }}>{d.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{d.category}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    animateListChange();
                    setDrills((prev) => prev.filter((_, j) => j !== i));
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${d.name}`}
                >
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput value={typed} onChangeText={setTyped} onSubmitEditing={addTyped} placeholder="Type a drill" placeholderTextColor={colors.muted} returnKeyType="done" style={[INPUT, { flex: 1 }]} />
          <Pressable onPress={addTyped} accessibilityLabel="Add drill" style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <BigButton icon="library-outline" label="From the library" variant="outline" onPress={() => setPicking(true)} style={{ flex: 1 }} />
          {!!params.last && <BigButton icon="copy-outline" label="Last week's" variant="outline" busy={copying} onPress={copyLast} style={{ flex: 1 }} />}
        </View>

        <GroupHeading>Notes for the week</GroupHeading>
        <TextInput value={notes} onChangeText={setNotes} placeholder="e.g. Little and often: 5 minutes, twice a day." placeholderTextColor={colors.muted} multiline maxLength={4000} style={MULTILINE} />

        <GroupHeading>How last week went</GroupHeading>
        <TextInput
          value={review}
          onChangeText={setReview}
          placeholder={`A short review of ${name}'s last week (optional)`}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          style={MULTILINE}
        />

        <BigButton icon="send-outline" label="Send this week's homework" busy={busy} onPress={send} style={{ marginTop: 24 }} />
      </ScrollView>
      <LibraryPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onAdd={(list) => {
          setPicking(false);
          addPicked(list);
        }}
        already={already}
      />
    </View>
  );
}
