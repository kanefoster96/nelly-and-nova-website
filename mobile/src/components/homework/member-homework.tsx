import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { CARD, LoadingState, PrimaryButton, SectionLabel, Tag } from "@/components/ui";
import { getMyDogs, type Dog } from "@/data/dogs";
import { formatDate } from "@/data/inbox";
import {
  getDogProgress,
  getReportCards,
  HOMEWORK_TARGET_DAYS,
  logHomeworkDay,
  markReportsSeen,
  todayUK,
  windowOpen,
  type DogProgress,
  type ReportBundle,
  type ReportCard,
} from "@/data/reports";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

import { DogProgressCard } from "./dog-progress";

const GREEN_EDGE = "rgba(34,197,94,0.35)";
const GREEN_FILL = "rgba(34,197,94,0.1)";

function shortDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

/** The drills, by category. A drill from the library opens its how-to page. */
function HomeworkList({ report }: { report: ReportCard }) {
  const router = useRouter();
  return (
    <View style={{ gap: 14 }}>
      {report.homework.map((cat) => (
        <View key={cat.id} style={{ gap: 2 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 4 }}>{cat.name}</Text>
          {cat.drills.map((d) => {
            const row = (
              <>
                <Ionicons name="ellipse-outline" size={14} color={colors.muted} style={{ marginTop: 2 }} />
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1, lineHeight: 20 }}>{d.name}</Text>
                {d.ref && <Ionicons name="chevron-forward" size={15} color={colors.muted} style={{ marginTop: 2 }} />}
              </>
            );
            return d.ref ? (
              <Pressable
                key={d.id}
                onPress={() => {
                  hapticSelection();
                  router.push({ pathname: "/drill/[id]", params: { id: d.ref! } });
                }}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 }}
              >
                {row}
              </Pressable>
            ) : (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 }}>
                {row}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** "Days practised · 1 of 3", a green bar and a chip per day. */
function DaysPractised({ days }: { days: string[] }) {
  const pct = Math.min(days.length, HOMEWORK_TARGET_DAYS) / HOMEWORK_TARGET_DAYS;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.foreground, fontSize: 14 }}>Days practised</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          {days.length} of {HOMEWORK_TARGET_DAYS}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 6, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: "100%", backgroundColor: colors.success, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {Array.from({ length: HOMEWORK_TARGET_DAYS }, (_, i) =>
          days[i] ? (
            <Text key={i} style={{ color: colors.success, fontSize: 12, borderWidth: 1, borderColor: GREEN_EDGE, backgroundColor: GREEN_FILL, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
              ✓ {shortDay(days[i])}
            </Text>
          ) : (
            <Text key={i} style={{ color: colors.muted, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              Day {i + 1}
            </Text>
          )
        )}
      </View>
    </View>
  );
}

/**
 * Member: Homework. For each dog, its latest report card (what went well,
 * the summary), this week's homework with "I practised today" (3 separate
 * days within 14), its Skills & levels, then earlier cards. Live from
 * Supabase; opening it clears the "new report card" mark.
 */
export function MemberHomework() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [progress, setProgress] = useState<Record<string, DogProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [b, myDogs] = await Promise.all([getReportCards(), getMyDogs(userId)]);
      setBundle(b);
      setDogs(myDogs);
      const entries = await Promise.all(myDogs.map(async (d) => [d.id, await getDogProgress(d.id)] as const));
      setProgress(Object.fromEntries(entries));
    } catch {
      setError("Could not load your homework.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Seen once shown.
  const unseen = bundle?.cards.filter((c) => c.isNew).map((c) => c.id).join(",") ?? "";
  useEffect(() => {
    if (unseen) void markReportsSeen(unseen.split(","));
  }, [unseen]);

  async function practised(card: ReportCard) {
    const today = todayUK();
    setBusyId(card.id);
    try {
      await logHomeworkDay(card, today);
      hapticSuccess();
      setBundle((b) => (b ? { ...b, progress: { ...b.progress, [card.id]: [...(b.progress[card.id] ?? []), today].sort() } } : b));
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save today's practice", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!bundle) return <LoadingState error={error} />;

  const today = todayUK();
  const multiDog = dogs.length > 1;
  // A section per dog with cards or skills; a dog with neither still shows its skills.
  const sections = dogs.length
    ? dogs.map((d) => ({ dog: d as Dog | null, cards: bundle.cards.filter((c) => c.dogId === d.id) }))
    : [{ dog: null, cards: bundle.cards }];
  let index = 0;

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
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
      <PageTitle title="Homework" subtitle="Your trainer's report card after each session, and the homework to practise on 3 days." style={{ marginBottom: 8 }} />
      {error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}

      {sections.map(({ dog, cards }) => {
        const [latest, ...earlier] = cards;
        const days = latest ? bundle.progress[latest.id] ?? [] : [];
        const doneToday = days.includes(today);
        const complete = days.length >= HOMEWORK_TARGET_DAYS;
        const open = latest ? windowOpen(latest, today) : false;
        const dogProgress = dog ? progress[dog.id] : undefined;
        return (
          <View key={dog?.id ?? "all"}>
            {multiDog && dog && <SectionLabel>{dog.name}</SectionLabel>}

            {!latest ? (
              <Appear index={index++} style={[CARD, { marginTop: multiDog ? 0 : 16, alignItems: "center", paddingVertical: 28 }]}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>Nothing yet</Text>
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center" }}>
                  {dog ? `${dog.name}'s` : "Your"} report card after each session will appear here.
                </Text>
              </Appear>
            ) : (
              <>
                <Appear index={index++} style={[CARD, { marginTop: multiDog ? 0 : 16 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>Report card · {formatDate(latest.date)}</Text>
                    {latest.isNew && <Tag label="New" solid />}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginTop: 6 }}>{latest.focus}</Text>
                  {!!latest.summary && <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{latest.summary}</Text>}
                  {latest.wins.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                      {latest.wins.map((w, i) => (
                        <Text key={i} style={{ color: colors.success, fontSize: 12, borderWidth: 1, borderColor: GREEN_EDGE, backgroundColor: GREEN_FILL, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
                          ✓ {w}
                        </Text>
                      ))}
                    </View>
                  )}
                </Appear>

                <SectionLabel>This week&apos;s homework</SectionLabel>
                <Appear index={index++} style={[CARD, { gap: 16 }]}>
                  <HomeworkList report={latest} />
                  <DaysPractised days={days} />
                  {complete ? (
                    <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600" }}>Homework complete, great work! 🐾</Text>
                  ) : !open ? (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>The 14 days to log this homework are up.</Text>
                  ) : (
                    <PrimaryButton
                      title={doneToday ? "Practised today ✓" : "I practised today"}
                      disabled={doneToday}
                      loading={busyId === latest.id}
                      onPress={() => practised(latest)}
                    />
                  )}
                </Appear>
              </>
            )}

            {dogProgress && (
              <>
                <SectionLabel>Skills &amp; levels</SectionLabel>
                <Appear index={index++}>
                  <DogProgressCard progress={dogProgress} />
                </Appear>
              </>
            )}

            {earlier.length > 0 && <SectionLabel>Earlier report cards</SectionLabel>}
            <View style={{ gap: 10 }}>
              {earlier.map((report) => (
                <Appear key={report.id} index={index++} style={[CARD, { gap: 10 }]}>
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {formatDate(report.date)} · practised {Math.min((bundle.progress[report.id] ?? []).length, HOMEWORK_TARGET_DAYS)} of {HOMEWORK_TARGET_DAYS} days
                    </Text>
                    <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginTop: 2 }}>{report.focus}</Text>
                  </View>
                  <HomeworkList report={report} />
                </Appear>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
