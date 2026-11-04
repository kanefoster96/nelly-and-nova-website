import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarCircle } from "@/components/avatar-circle";
import { GlassButton } from "@/components/glass-button";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton, GroupHeading } from "@/components/trainer/cards";
import { CARD, FormScrollView, LoadingState, Tag, TextField } from "@/components/ui";
import { getLibrary, type LibPillar } from "@/data/homework";
import { deleteCard, drillCount, findDraft, getCard, homeworkTitle, publishCards, saveCardHomework, saveDraftCard, type EditCategory, type TrainerCard } from "@/data/trainer-reports";
import { formatDay, todayISO } from "@/data/trainer-schedule";
import { supabase } from "@/lib/supabase";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

const MULTILINE = { minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.surface, marginBottom: 12 } as const;

type Picked = { key: string; category: string; name: string; ref: string; pillar: string };

/**
 * The drill library as a sheet: pillar, category (tap to open), level,
 * drills with a tick. Done adds the ticked drills to the card, each under
 * its category, linked to its how-to page (as the website's report card
 * entry picks them from the library).
 */
function LibraryPicker({ visible, onClose, onAdd, already }: { visible: boolean; onClose: () => void; onAdd: (picked: Picked[]) => void; already: Set<string> }) {
  const insets = useSafeAreaInsets();
  const [library, setLibrary] = useState<LibPillar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map());

  useEffect(() => {
    if (!visible || library) return;
    getLibrary()
      .then(setLibrary)
      .catch(() => setError("Couldn't load the drill library."));
  }, [visible, library]);

  useEffect(() => {
    if (visible) setPicked(new Map());
  }, [visible]);

  function toggle(p: Picked) {
    hapticSelection();
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(p.key)) next.delete(p.key);
      else next.set(p.key, p);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}>
          <GlassButton onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </GlassButton>
          <View style={{ flex: 1 }} />
          <BigButton
            label={picked.size ? `Add ${picked.size} drill${picked.size === 1 ? "" : "s"}` : "Add"}
            disabled={picked.size === 0}
            onPress={() => {
              onAdd([...picked.values()]);
              onClose();
            }}
            style={{ minHeight: 44 }}
          />
        </View>
        <PageTitle title="Drill library" subtitle="Tick the drills to set. They link to their how-to for the owner." style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }} />
        {!library ? (
          <LoadingState error={error} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
            {library.map((pillar) => (
              <View key={pillar.id}>
                <GroupHeading>{`${pillar.name} · ${pillar.blurb}`}</GroupHeading>
                <View style={[CARD, { padding: 0, overflow: "hidden" }]}>
                  {pillar.categories.length === 0 && <Text style={{ color: colors.muted, padding: 14 }}>No categories yet.</Text>}
                  {pillar.categories.map((cat, ci) => {
                    const expanded = open === cat.id;
                    return (
                      <View key={cat.id} style={{ borderTopWidth: ci === 0 ? 0 : 1, borderTopColor: colors.border }}>
                        <Pressable
                          onPress={() => {
                            hapticSelection();
                            animateListChange();
                            setOpen(expanded ? null : cat.id);
                          }}
                          accessibilityState={{ expanded }}
                          style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 8 }}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", flex: 1 }}>{cat.name}</Text>
                          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                        </Pressable>
                        {expanded &&
                          cat.levels.map((lvl) => (
                            <View key={lvl.level} style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
                              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Level {lvl.level}</Text>
                              {lvl.drills.map((d) => {
                                const key = d.id;
                                const on = picked.has(key);
                                const set = already.has(key);
                                return (
                                  <Pressable
                                    key={key}
                                    disabled={set}
                                    onPress={() => toggle({ key, category: cat.name, name: d.name, ref: d.id, pillar: pillar.id })}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on || set, disabled: set }}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, opacity: set ? 0.5 : 1 }}
                                  >
                                    <Ionicons name={on || set ? "checkbox" : "square-outline"} size={20} color={on ? colors.success : colors.muted} />
                                    <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>{d.name}</Text>
                                    {set && <Tag label="On the card" />}
                                  </Pressable>
                                );
                              })}
                            </View>
                          ))}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/**
 * Trainer: write a dog's report card, or attach homework (from the dog's
 * page). The website's report card entry (components/reports/
 * ReportEntryModal.tsx) in the app: a summary of the day, three things they
 * did well, their biggest strength and area to improve, and homework —
 * categories with drills, picked from the drill library or typed. The
 * card's title is its categories. Save draft keeps it private; Send to
 * owner publishes it (an email and an app notification, through the
 * website). For a card that's already been sent only the homework
 * changes. `focus=homework`: homework first, the rest optional.
 */
export default function ReportCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dogId: string; cardId?: string; focus?: string }>();
  const dogId = String(params.dogId ?? "");
  const homeworkFirst = params.focus === "homework";
  const [dog, setDog] = useState<{ name: string; photoUrl: string | null } | null>(null);
  const [card, setCard] = useState<TrainerCard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date] = useState(todayISO());
  const [summary, setSummary] = useState("");
  const [wins, setWins] = useState(["", "", ""]);
  const [strength, setStrength] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [homework, setHomework] = useState<EditCategory[]>([]);
  const [showMore, setShowMore] = useState(!homeworkFirst);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<"draft" | "send" | "delete" | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [d, existing] = await Promise.all([
          supabase.from("dogs").select("name, photo_url").eq("id", dogId).maybeSingle(),
          params.cardId ? getCard(String(params.cardId)) : findDraft(dogId, todayISO()),
        ]);
        if (!live) return;
        const row = d.data as { name: string; photo_url: string | null } | null;
        setDog(row ? { name: row.name, photoUrl: row.photo_url } : null);
        if (existing) {
          setCard(existing);
          setSummary(existing.summary);
          const w = [...existing.wins];
          while (w.length < 3) w.push("");
          setWins(w);
          setStrength(existing.strength);
          setToImprove(existing.toImprove);
          setHomework(existing.homework);
          if (existing.summary || existing.wins.length) setShowMore(true);
        }
        setLoaded(true);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't load the report card.");
      }
    })();
    return () => {
      live = false;
    };
  }, [dogId, params.cardId]);

  if (!loaded || !dog) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={homeworkFirst ? "Attach homework" : "Report card"} />
        <LoadingState error={loaded && !dog ? "This dog isn't on file any more." : error} />
      </View>
    );
  }

  const sent = card?.status === "published";
  const title = homeworkTitle(homework);
  const drills = drillCount(homework);
  const already = new Set(homework.flatMap((c) => c.drills.map((d) => d.ref).filter((x): x is string => !!x)));

  function addPicked(list: Picked[]) {
    hapticSuccess();
    animateListChange();
    setHomework((prev) => {
      const next = prev.map((c) => ({ ...c, drills: [...c.drills] }));
      for (const p of list) {
        let cat = next.find((c) => c.name.trim().toLowerCase() === p.category.toLowerCase());
        if (!cat) {
          cat = { name: p.category, drills: [] };
          next.push(cat);
        }
        cat.drills.push({ name: p.name, ref: p.ref, pillar: p.pillar });
      }
      return next;
    });
  }

  const setCat = (ci: number, patch: Partial<EditCategory>) => setHomework((prev) => prev.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setDrill = (ci: number, di: number, name: string) =>
    setHomework((prev) => prev.map((c, i) => (i === ci ? { ...c, drills: c.drills.map((d, j) => (j === di ? { ...d, name, ref: d.name === name ? d.ref : null } : d)) } : c)));
  const removeDrill = (ci: number, di: number) => {
    animateListChange();
    setHomework((prev) => prev.map((c, i) => (i === ci ? { ...c, drills: c.drills.filter((_, j) => j !== di) } : c)).filter((c) => c.drills.length > 0 || c.name.trim()));
  };
  const removeCat = (ci: number) => {
    animateListChange();
    setHomework((prev) => prev.filter((_, i) => i !== ci));
  };

  function problem(): string | null {
    if (drills === 0) return "Add some homework: a category with at least one drill.";
    if (homework.some((c) => c.drills.length > 0 && !c.name.trim())) return "Give each homework category a name.";
    if (!homeworkFirst && !sent) {
      if (!summary.trim()) return "Add a summary of the day.";
      if (!wins.some((w) => w.trim())) return "Add at least one thing they did well.";
    }
    return null;
  }

  const draft = { dogId, date: card?.date ?? date, summary, wins, strength, toImprove, homework };

  async function save(send: boolean) {
    const missing = send || sent ? problem() : null;
    if (missing) {
      hapticWarning();
      Alert.alert("Nearly there", missing);
      return;
    }
    setBusy(send ? "send" : "draft");
    try {
      if (sent) {
        await saveCardHomework(card!.id, homework);
        hapticSuccess();
        Alert.alert("Homework updated", `${dog!.name}'s owner sees the change straight away.`, [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      const id = await saveDraftCard(draft, card?.id);
      if (!send) {
        hapticSuccess();
        Alert.alert("Draft saved", "Owners can't see drafts. Send it when it's ready.", [{ text: "Done", onPress: () => router.back() }]);
        return;
      }
      const res = await publishCards([id]);
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
    const missing = problem();
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
            await deleteCard(card.id);
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

  const homeworkSection = (
    <>
      <GroupHeading>Homework</GroupHeading>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
        Pick drills from the library, or add a category (e.g. Recall) and type your own. The card is titled from the categories{title ? `: ${title}` : ""}.
      </Text>
      <View style={{ gap: 10 }}>
        {homework.map((cat, ci) => (
          <View key={ci} style={CARD}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextField value={cat.name} onChangeText={(v) => setCat(ci, { name: v })} placeholder="Category, e.g. Recall" autoCapitalize="words" style={{ marginBottom: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontSize: 16, fontWeight: "700", backgroundColor: colors.background }} />
              </View>
              <Pressable onPress={() => removeCat(ci)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${cat.name || "category"}`}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
            {cat.drills.map((d, di) => (
              <View key={di} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Ionicons name={d.ref ? "library-outline" : "create-outline"} size={16} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <TextField value={d.name} onChangeText={(v) => setDrill(ci, di, v)} placeholder={`Drill ${di + 1}`} autoCapitalize="sentences" autoCorrect style={{ marginBottom: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontSize: 15, backgroundColor: colors.background }} />
                </View>
                <Pressable onPress={() => removeDrill(ci, di)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove drill">
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => {
                animateListChange();
                setCat(ci, { drills: [...cat.drills, { name: "" }] });
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}
            >
              <Ionicons name="add" size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Add a drill</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <BigButton icon="library-outline" label="From the library" onPress={() => setPicking(true)} style={{ flex: 1 }} />
        <BigButton
          icon="add"
          label="Own category"
          variant="outline"
          onPress={() => {
            animateListChange();
            setHomework((prev) => [...prev, { name: "", drills: [{ name: "" }] }]);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );

  const detailsSection = sent ? (
    !!card?.summary && (
      <View style={[CARD, { marginTop: 14 }]}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Summary (sent)</Text>
        <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{card.summary}</Text>
      </View>
    )
  ) : (
    <>
      <GroupHeading>Summary of the day{homeworkFirst ? " (optional)" : ""}</GroupHeading>
      <TextField value={summary} onChangeText={setSummary} placeholder="How the day went…" autoCapitalize="sentences" autoCorrect multiline style={MULTILINE} />
      <GroupHeading style={{ marginTop: 8 }}>Three things they did well</GroupHeading>
      {wins.map((w, i) => (
        <TextField key={i} value={w} onChangeText={(v) => setWins((prev) => prev.map((x, j) => (j === i ? v : x)))} placeholder={`Win ${i + 1}`} autoCapitalize="sentences" autoCorrect />
      ))}
      <GroupHeading style={{ marginTop: 8 }}>Biggest strength</GroupHeading>
      <TextField value={strength} onChangeText={setStrength} placeholder="e.g. Loose-lead walking" autoCapitalize="sentences" maxLength={200} />
      <GroupHeading style={{ marginTop: 8 }}>Biggest area to improve</GroupHeading>
      <TextField value={toImprove} onChangeText={setToImprove} placeholder="e.g. Settling in the crate" autoCapitalize="sentences" maxLength={200} />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={homeworkFirst ? "Attach homework" : sent ? "Report card" : "Write report card"} subtitle={formatDay(card?.date ?? date)} />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AvatarCircle name={dog.name} avatarUrl={dog.photoUrl} size={44} />
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", flex: 1 }}>{dog.name}</Text>
          {card && <Tag label={sent ? "Sent" : "Draft"} tone={sent ? colors.success : colors.warning} />}
        </View>
        {sent && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>This card&apos;s been sent: you can change its homework. A drill keeps its practice days when it&apos;s only renamed.</Text>}

        {homeworkFirst ? (
          <>
            {homeworkSection}
            {!sent && !showMore ? (
              <Pressable onPress={() => (animateListChange(), setShowMore(true))} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20 }}>
                <Ionicons name="add-circle-outline" size={18} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Add a summary and wins too</Text>
              </Pressable>
            ) : (
              detailsSection
            )}
          </>
        ) : (
          <>
            {detailsSection}
            {homeworkSection}
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
      <LibraryPicker visible={picking} onClose={() => setPicking(false)} onAdd={addPicked} already={already} />
    </View>
  );
}
