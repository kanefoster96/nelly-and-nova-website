import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass-button";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { BigButton, GroupHeading } from "@/components/trainer/cards";
import { CARD, LoadingState, Tag, TextField } from "@/components/ui";
import { getLibrary, type LibPillar } from "@/data/homework";
import { deleteCard, drillCount, findDraft, getCard, homeworkTitle, publishCards, saveCardHomework, saveDraftCard, type EditCategory, type TrainerCard } from "@/data/trainer-reports";
import { supabase } from "@/lib/supabase";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

/*
 * Writing a report card, shared by the report card page (report-card.tsx:
 * one dog, from its page) and the end-of-day reports (write-reports.tsx: a
 * step for each dog who came). useReportDraft holds the card — loaded from
 * a card, or the dog's draft for the date, or new — and saves it the
 * website's way (data/trainer-reports.ts); ReportDetails and
 * ReportHomework are its two halves.
 */

const MULTILINE = { minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.surface, marginBottom: 12 } as const;

type Picked = { key: string; category: string; name: string; ref: string; pillar: string };

/**
 * The drill library as a sheet: pillar, category (tap to open), level,
 * drills with a tick. Done adds the ticked drills to the card, each under
 * its category, linked to its how-to page (as the website's report card
 * entry picks them from the library).
 */
export function LibraryPicker({ visible, onClose, onAdd, already }: { visible: boolean; onClose: () => void; onAdd: (picked: Picked[]) => void; already: Set<string> }) {
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


export type ReportDraft = ReturnType<typeof useReportDraft>;

/**
 * One dog's report card being written: the card (from `cardId`, else the
 * dog's draft for `date`, else new), its fields, and saving it.
 */
export function useReportDraft({ dogId, date, cardId }: { dogId: string; date: string; cardId?: string | null }) {
  const [dog, setDog] = useState<{ name: string; photoUrl: string | null; accountId: string | null } | null>(null);
  const [card, setCard] = useState<TrainerCard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [wins, setWins] = useState(["", "", ""]);
  const [strength, setStrength] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [homework, setHomework] = useState<EditCategory[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError(null);
    setCard(null);
    setSummary("");
    setWins(["", "", ""]);
    setStrength("");
    setToImprove("");
    setHomework([]);
    setTouched(false);
    (async () => {
      try {
        const [d, existing] = await Promise.all([
          supabase.from("dogs").select("name, photo_url, account_id").eq("id", dogId).maybeSingle(),
          cardId ? getCard(cardId) : findDraft(dogId, date),
        ]);
        if (!live) return;
        const row = d.data as { name: string; photo_url: string | null; account_id: string | null } | null;
        setDog(row ? { name: row.name, photoUrl: row.photo_url, accountId: row.account_id } : null);
        if (existing) {
          setCard(existing);
          setSummary(existing.summary);
          const w = [...existing.wins];
          while (w.length < 3) w.push("");
          setWins(w);
          setStrength(existing.strength);
          setToImprove(existing.toImprove);
          setHomework(existing.homework);
        }
        setLoaded(true);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't load the report card.");
      }
    })();
    return () => {
      live = false;
    };
  }, [dogId, date, cardId]);

  const sent = card?.status === "published";
  const drills = drillCount(homework);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    setTouched(true);
    set(v);
  };

  /** What's missing before it can go: homework always; a summary and a win unless it's homework only. */
  function problem(homeworkOnly = false): string | null {
    if (drills === 0) return "Add some homework: a category with at least one drill.";
    if (homework.some((c) => c.drills.length > 0 && !c.name.trim())) return "Give each homework category a name.";
    if (!homeworkOnly && !sent) {
      if (!summary.trim()) return "Add a summary of the day.";
      if (!wins.some((w) => w.trim())) return "Add at least one thing they did well.";
    }
    return null;
  }

  /** Is there anything written? (Skipping an empty card saves nothing.) */
  const hasContent = !!(summary.trim() || wins.some((w) => w.trim()) || strength.trim() || toImprove.trim() || drills > 0);

  /** Save as a draft (owners can't see drafts). Returns the card id. */
  async function saveDraft(): Promise<string> {
    const id = await saveDraftCard({ dogId, date: card?.date ?? date, summary, wins, strength, toImprove, homework }, card?.id);
    if (!card) setCard({ id, dogId, status: "draft", date, title: homeworkTitle(homework), summary, wins, strength, toImprove, homework, practisedDays: 0, comments: 0 });
    setTouched(false);
    return id;
  }

  /** Save and send to the owner (an email and an app notification). */
  async function send(): Promise<{ notified: number }> {
    const id = await saveDraft();
    const res = await publishCards([id]);
    setCard((c) => (c ? { ...c, id, status: "published" } : c));
    return { notified: res.notified };
  }

  /** A card that's been sent: only its homework changes. */
  async function saveHomework(): Promise<void> {
    if (!card) return;
    await saveCardHomework(card.id, homework);
    setTouched(false);
  }

  async function remove(): Promise<void> {
    if (card) await deleteCard(card.id);
  }

  return {
    dogId,
    date: card?.date ?? date,
    dog,
    card,
    loaded,
    error,
    sent,
    drills,
    touched,
    hasContent,
    summary,
    setSummary: edit(setSummary),
    wins,
    setWin: (i: number, v: string) => {
      setTouched(true);
      setWins((prev) => prev.map((x, j) => (j === i ? v : x)));
    },
    strength,
    setStrength: edit(setStrength),
    toImprove,
    setToImprove: edit(setToImprove),
    homework,
    setHomework: (next: EditCategory[] | ((prev: EditCategory[]) => EditCategory[])) => {
      setTouched(true);
      setHomework(next);
    },
    problem,
    saveDraft,
    send,
    saveHomework,
    remove,
  };
}

/** While a card loads (or can't). */
export function ReportLoading({ draft }: { draft: ReportDraft }) {
  return <LoadingState error={draft.loaded && !draft.dog ? "This dog isn't on file any more." : draft.error} />;
}

/** The day: a summary, three wins, biggest strength and area to improve. A sent card shows its summary. */
export function ReportDetails({ draft, optional = false }: { draft: ReportDraft; optional?: boolean }) {
  if (draft.sent) {
    return draft.card?.summary ? (
      <View style={[CARD, { marginTop: 14 }]}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Summary (sent)</Text>
        <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{draft.card.summary}</Text>
      </View>
    ) : null;
  }
  return (
    <>
      <GroupHeading>Summary of the day{optional ? " (optional)" : ""}</GroupHeading>
      <TextField value={draft.summary} onChangeText={draft.setSummary} placeholder="How the day went…" autoCapitalize="sentences" autoCorrect multiline style={MULTILINE} />
      <GroupHeading style={{ marginTop: 8 }}>Three things they did well</GroupHeading>
      {draft.wins.map((w, i) => (
        <TextField key={i} value={w} onChangeText={(v) => draft.setWin(i, v)} placeholder={`Win ${i + 1}`} autoCapitalize="sentences" autoCorrect />
      ))}
      <GroupHeading style={{ marginTop: 8 }}>Biggest strength</GroupHeading>
      <TextField value={draft.strength} onChangeText={draft.setStrength} placeholder="e.g. Loose-lead walking" autoCapitalize="sentences" maxLength={200} />
      <GroupHeading style={{ marginTop: 8 }}>Biggest area to improve</GroupHeading>
      <TextField value={draft.toImprove} onChangeText={draft.setToImprove} placeholder="e.g. Settling in the crate" autoCapitalize="sentences" maxLength={200} />
    </>
  );
}

/** The homework: categories with drills, from the drill library or typed. */
export function ReportHomework({ draft }: { draft: ReportDraft }) {
  const [picking, setPicking] = useState(false);
  const { homework, setHomework } = draft;
  const title = homeworkTitle(homework);
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

  return (
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
      <LibraryPicker visible={picking} onClose={() => setPicking(false)} onAdd={addPicked} already={already} />
    </>
  );
}
