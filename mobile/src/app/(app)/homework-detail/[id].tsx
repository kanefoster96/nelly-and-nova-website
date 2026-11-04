import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { VideoTile } from "@/components/community/video-tile";
import { Celebration, CompleteSheet, dayLabel, ProgressRing, Skeleton } from "@/components/homework/homework-ui";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { CARD } from "@/components/ui";
import { getHomework, shortDate, videoLink, type CompleteResult, type Homework, type HomeworkDay } from "@/data/homework/assigned";
import { HOMEWORK_TARGET_DAYS } from "@/data/reports";
import { animateListChange } from "@/lib/layout-animation";
import { mediaUrl } from "@/lib/media";
import { colors } from "@/theme";

const SECTION = { color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 26, marginBottom: 10 } as const;

/**
 * One homework: how to do it (the drills' instructions, the trainer's
 * videos and photos), the trainer's notes from the report card, and a
 * timeline of the days done with the owner's notes and videos. Videos are
 * deleted once the homework is complete; their notes and dates stay.
 */
export default function HomeworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [h, setH] = useState<Homework | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getHomework();
      setH(list.find((x) => x.card.id === id) ?? null);
    } catch {
      setH((prev) => prev ?? null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function saved(_: Homework, result: CompleteResult) {
    setSheet(false);
    animateListChange();
    setH((prev) => (prev ? { ...prev, days: [...prev.days, { date: result.date, note: null, videoPath: null, videoRemoved: false }], doneToday: true, complete: result.complete } : prev));
    if (result.complete && h) setTimeout(() => setCelebrate(`${h.card.focus} complete!`), 450);
    void load();
  }

  if (h === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Skeleton height={14} width={140} radius={6} />
          <Skeleton height={30} width={"70%"} radius={8} />
          <Skeleton height={120} />
          <Skeleton height={200} />
        </View>
      </View>
    );
  }
  if (h === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Homework not found" subtitle="It may have been changed by your trainer." />
      </View>
    );
  }

  const drills = h.card.homework.flatMap((c) => c.drills.map((d) => ({ ...d, category: c.name })));
  const trainerNotes = drills.filter((d) => d.note);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }}>
        <Appear style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              {h.card.dogName ? `${h.card.dogName} · ` : ""}Report card · {shortDate(h.card.date)}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800", marginTop: 4 }}>{h.card.focus}</Text>
            <Text style={{ color: h.complete ? colors.success : colors.muted, fontSize: 14, marginTop: 4 }}>{h.complete ? "Completed" : dayLabel(h)}</Text>
          </View>
          <ProgressRing done={h.days.length} size={72} stroke={6} />
        </Appear>

        {!h.complete && (
          <Appear index={1} style={{ marginTop: 18 }}>
            {h.doneToday ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 25, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.08)" }}>
                <Ionicons name="checkmark" size={18} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 15, fontWeight: "700" }}>Done today</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>· Come back tomorrow</Text>
              </View>
            ) : (
              <Pressable onPress={() => setSheet(true)} style={{ height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accentForeground} />
                <Text style={{ color: colors.accentForeground, fontSize: 16, fontWeight: "700" }}>Complete today</Text>
                <Text style={{ color: "rgba(10,10,10,0.6)", fontSize: 14 }}>· {dayLabel(h)}</Text>
              </Pressable>
            )}
          </Appear>
        )}

        <Text style={SECTION}>How to do it</Text>
        <View style={{ gap: 12 }}>
          {drills.map((d) => {
            const blocks = d.ref ? h.blocks[d.ref] ?? [] : [];
            return (
              <View key={d.id} style={[CARD, { gap: 10 }]}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{d.category}</Text>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: -6 }}>{d.name}</Text>
                {blocks.map((b) =>
                  b.type === "heading" ? (
                    <Text key={b.id} style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                      {b.text}
                    </Text>
                  ) : b.type === "paragraph" ? (
                    <Text key={b.id} style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>
                      {b.text}
                    </Text>
                  ) : b.type === "image" ? (
                    <Image key={b.id} source={mediaUrl(b.url)} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 12 }} contentFit="cover" />
                  ) : (
                    <VideoTile key={b.id} uri={mediaUrl(b.url)!} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#000" }} />
                  ),
                )}
                {blocks.length === 0 && !d.note && <Text style={{ color: colors.muted, fontSize: 14 }}>Your trainer will have shown you this one in your session. Message us if you&apos;d like a reminder.</Text>}
              </View>
            );
          })}
        </View>

        {(h.card.summary || h.card.wins.length > 0 || trainerNotes.length > 0) && (
          <>
            <Text style={SECTION}>From your trainer</Text>
            <View style={[CARD, { gap: 10 }]}>
              {!!h.card.summary && <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>{h.card.summary}</Text>}
              {trainerNotes.map((d) => (
                <View key={d.id}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{d.name}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>{d.note}</Text>
                </View>
              ))}
              {h.card.wins.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {h.card.wins.map((w, i) => (
                    <Text key={i} style={{ color: colors.success, fontSize: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
                      ✓ {w}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <Text style={SECTION}>Your days</Text>
        <View style={{ paddingLeft: 4 }}>
          {Array.from({ length: Math.max(HOMEWORK_TARGET_DAYS, h.days.length) }, (_, i) => {
            const day = h.days[i];
            return <TimelineDay key={i} n={i + 1} day={day} last={i === Math.max(HOMEWORK_TARGET_DAYS, h.days.length) - 1} complete={h.complete} />;
          })}
        </View>
      </ScrollView>
      <CompleteSheet homework={sheet ? h : null} onClose={() => setSheet(false)} onDone={saved} />
      <Celebration title={celebrate} onFinish={() => setCelebrate(null)} />
    </View>
  );
}

function TimelineDay({ n, day, last, complete }: { n: number; day?: HomeworkDay; last: boolean; complete: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: day ? colors.success : "rgba(245,242,234,0.08)" }}>
          {day ? <Ionicons name="checkmark" size={16} color={colors.background} /> : <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{n}</Text>}
        </View>
        {!last && <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: day ? "rgba(34,197,94,0.4)" : colors.border }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 18, gap: 6 }}>
        <Text style={{ color: day ? colors.foreground : colors.muted, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
          Day {n}
          {day ? ` · ${shortDate(day.date)}` : ""}
        </Text>
        {day?.note ? <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{day.note}</Text> : null}
        {day?.videoPath ? <DayVideo path={day.videoPath} /> : null}
        {day && !day.videoPath && day.videoRemoved ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="videocam-off-outline" size={15} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Video removed after completion</Text>
          </View>
        ) : null}
        {!day && !complete ? <Text style={{ color: colors.muted, fontSize: 13 }}>Still to do</Text> : null}
      </View>
    </View>
  );
}

function DayVideo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    videoLink(path).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (url === undefined) return <Skeleton height={160} radius={12} />;
  if (!url) return <Text style={{ color: colors.muted, fontSize: 13 }}>Video unavailable</Text>;
  return <VideoTile uri={url} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#000" }} />;
}
