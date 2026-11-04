import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { DogSwitcher } from "@/components/dog-switcher";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { CARD } from "@/components/ui";
import { getMyDogs, type Dog } from "@/data/dogs";
import { getHomework, monthLabel, shortDate, type CompleteResult, type Homework } from "@/data/homework/assigned";
import { HOMEWORK_TARGET_DAYS, markReportsSeen } from "@/data/reports";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

import { Celebration, CompleteSheet, dayLabel, ProgressRing, Skeleton } from "./homework-ui";

type Filter = "all" | "todo" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "done", label: "Completed" },
];

/** The first couple of lines of how to do it. */
function shortInstructions(h: Homework): string {
  const text = h.instructions.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/**
 * Member: Homework. Each report card's homework is done on 3 different
 * days, once a day, and stays in To do until it's done (nothing expires).
 *   To do        what's still to finish, newest first: a ring for the days
 *                done, "Complete today" (a sheet to add a video or a note
 *                for the trainer), or "Done today" until tomorrow.
 *   All homework every homework they've had, newest first, by month, with
 *                a search (title, skills, instructions, the trainer's and
 *                their own notes) and All · To do · Completed.
 * Tapping any homework opens its page: instructions, the trainer's videos
 * and photos, and the days done with their notes and videos.
 */
export function MemberHomework() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [list, setList] = useState<Homework[] | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetFor, setSheetFor] = useState<Homework | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [hw, myDogs] = await Promise.all([getHomework(), getMyDogs(userId)]);
      setList(hw);
      setDogs(myDogs);
      setError(null);
    } catch {
      setError("Couldn't load your homework. Pull down to try again.");
      setList((l) => l ?? []);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // New report cards are seen once their homework is shown.
  const unseen = list?.filter((h) => h.card.isNew).map((h) => h.card.id).join(",") ?? "";
  useEffect(() => {
    if (unseen) void markReportsSeen(unseen.split(","));
  }, [unseen]);

  const dogId = selected ?? dogs[0]?.id ?? null;
  const mine = useMemo(() => (list ?? []).filter((h) => dogs.length <= 1 || !dogId || h.card.dogId === dogId), [list, dogs.length, dogId]);
  const toDo = mine.filter((h) => !h.complete);
  const q = query.trim().toLowerCase();
  const shown = mine.filter((h) => (filter === "all" ? true : filter === "todo" ? !h.complete : h.complete)).filter((h) => !q || h.haystack.includes(q));
  const months: { label: string; items: Homework[] }[] = [];
  for (const h of shown) {
    const label = monthLabel(h.card.date);
    const last = months[months.length - 1];
    if (last?.label === label) last.items.push(h);
    else months.push({ label, items: [h] });
  }

  function saved(h: Homework, result: CompleteResult) {
    setSheetFor(null);
    animateListChange();
    setJustDone(h.card.id);
    setList((prev) =>
      (prev ?? []).map((x) =>
        x.card.id === h.card.id
          ? { ...x, days: [...x.days, { date: result.date, note: null, videoPath: null, videoRemoved: false }], doneToday: true, complete: result.complete }
          : x,
      ),
    );
    if (result.complete) setTimeout(() => setCelebrate(`${h.card.focus} complete!`), 450);
    void load();
  }

  const open = (h: Homework) => {
    hapticSelection();
    router.push({ pathname: "/homework-detail/[id]", params: { id: h.card.id } } as never);
  };
  const dogName = dogs.find((d) => d.id === dogId)?.name;
  let index = 0;

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.foreground}
        />
      }
    >
      <PageTitle title="Homework" subtitle="Complete each one on 3 different days." style={{ marginBottom: 16 }} />
      {dogs.length > 1 && dogId && <DogSwitcher dogs={dogs} selected={dogId} onSelect={setSelected} />}
      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      {list === null ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={18} width={90} radius={6} />
          <Skeleton height={168} />
          <Skeleton height={168} />
          <Skeleton height={18} width={130} radius={6} style={{ marginTop: 16 }} />
          <Skeleton height={44} radius={22} />
          <Skeleton height={64} />
        </View>
      ) : mine.length === 0 ? (
        <Appear style={[CARD, { alignItems: "center", paddingVertical: 32, gap: 8 }]}>
          <Ionicons name="school-outline" size={30} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>No homework yet</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
            After each session, {dogName ? `${dogName}'s` : "your"} report card and homework will appear here.
          </Text>
        </Appear>
      ) : (
        <>
          <SectionHeader title="To do" count={toDo.length} />
          {toDo.length === 0 ? (
            <Appear index={index++} style={[CARD, { alignItems: "center", paddingVertical: 26, gap: 6, borderColor: "rgba(34,197,94,0.3)" }]}>
              <Ionicons name="checkmark-circle" size={30} color={colors.success} />
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>All done</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>New homework arrives with {dogName ? `${dogName}'s` : "your"} next report card.</Text>
            </Appear>
          ) : (
            <View style={{ gap: 12 }}>
              {toDo.map((h) => (
                <Appear key={h.card.id} index={index++}>
                  <ToDoCard homework={h} highlight={justDone === h.card.id} onOpen={() => open(h)} onComplete={() => setSheetFor(h)} />
                </Appear>
              ))}
            </View>
          )}

          <SectionHeader title="All homework" count={mine.length} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: 23, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, paddingHorizontal: 16 }}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search homework"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search homework"
              style={{ flex: 1, color: colors.foreground, fontSize: 16, paddingVertical: 0 }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    if (on) return;
                    hapticSelection();
                    animateListChange();
                    setFilter(f.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.foreground : colors.border, backgroundColor: on ? colors.foreground : "transparent" }}
                >
                  <Text style={{ color: on ? colors.background : colors.foreground, fontSize: 14, fontWeight: on ? "700" : "500" }}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {months.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 6 }}>
              <Ionicons name="search-outline" size={26} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center" }}>
                {q ? `No homework matches “${query.trim()}”` : filter === "done" ? "Nothing completed yet." : "Nothing to do here."}
              </Text>
            </View>
          ) : (
            months.map((m) => (
              <View key={m.label} style={{ marginTop: 18 }}>
                <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{m.label}</Text>
                <View style={{ borderRadius: 16, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, overflow: "hidden" }}>
                  {m.items.map((h, i) => (
                    <Pressable key={h.card.id} onPress={() => open(h)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                      {h.complete ? (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="checkmark" size={20} color={colors.success} />
                        </View>
                      ) : (
                        <ProgressRing done={h.days.length} size={36} stroke={3.5} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                          {h.card.focus}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {shortDate(h.card.date)} · {h.complete ? "Completed" : dayLabel(h)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}
        </>
      )}

      <CompleteSheet homework={sheetFor} onClose={() => setSheetFor(null)} onDone={saved} />
      <Celebration title={celebrate} onFinish={() => setCelebrate(null)} />
    </ScrollView>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, marginBottom: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
      {count > 0 && (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(245,242,234,0.1)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "700" }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function ToDoCard({ homework: h, highlight, onOpen, onComplete }: { homework: Homework; highlight: boolean; onOpen: () => void; onComplete: () => void }) {
  const skills = [...new Set(h.card.homework.map((c) => c.name))];
  const text = shortInstructions(h);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={[CARD, { gap: 12, borderColor: highlight ? "rgba(34,197,94,0.4)" : colors.border }]}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Report card · {shortDate(h.card.date)}</Text>
            {h.card.isNew && (
              <View style={{ backgroundColor: colors.foreground, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: colors.background, fontSize: 9, fontWeight: "800" }}>NEW</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 4 }}>{h.card.focus}</Text>
          {!!text && (
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }} numberOfLines={2}>
              {text}
            </Text>
          )}
        </View>
        <ProgressRing done={h.days.length} />
      </View>
      {skills.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {skills.map((s) => (
            <Text key={s} style={{ color: colors.foreground, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              {s}
            </Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 5 }}>
        {Array.from({ length: HOMEWORK_TARGET_DAYS }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < h.days.length ? colors.success : colors.border }} />
        ))}
      </View>
      {h.doneToday ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.08)", justifyContent: "center" }}>
          <Ionicons name="checkmark" size={18} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 15, fontWeight: "700" }}>Done today</Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>· Come back tomorrow</Text>
        </View>
      ) : (
        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          accessibilityLabel={`Complete today: ${dayLabel(h)}`}
          style={{ height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.accentForeground} />
          <Text style={{ color: colors.accentForeground, fontSize: 15, fontWeight: "700" }}>Complete today</Text>
          <Text style={{ color: "rgba(10,10,10,0.6)", fontSize: 14 }}>· {dayLabel(h)}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
