import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/Button";
import { activeDog, useSession } from "@/lib/session";
import {
  finishWalk,
  getHomeworkForDog,
  markHomeworkDone,
  shareWalkToCommunity,
  startWalk,
  type HomeworkItem,
  type Walk,
  type WalkKind,
} from "@/lib/walks";
import { colors } from "@/theme/colors";

type Phase = "idle" | "tracking" | "finished";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function TrackWalkScreen() {
  const router = useRouter();
  const session = useSession();
  const dog = activeDog(session);

  const [phase, setPhase] = useState<Phase>("idle");
  const [kind, setKind] = useState<WalkKind>("walk");
  const [walk, setWalk] = useState<Walk | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [shareToCommunity, setShareToCommunity] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    getHomeworkForDog(dog.id).then((items) => {
      if (!cancelled) setHomework(items);
    });
    return () => {
      cancelled = true;
    };
    // `dog` is a fresh object every render — key off its id instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  useEffect(() => {
    if (phase !== "tracking" || startedAtMs === null) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, startedAtMs]);

  if (!dog) return null;

  async function start() {
    setStarting(true);
    let location: { lat: number; lng: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      // Best-effort — the walk still tracks fine without a location.
    }

    const created = await startWalk({ dogId: dog!.id, kind, location });
    setStarting(false);
    if (!created) return;

    setWalk(created);
    setStartedAtMs(Date.now());
    setElapsed(0);
    setPhase("tracking");
  }

  function stop() {
    setPhase("finished");
  }

  async function toggleHomework(item: HomeworkItem) {
    if (doneIds.has(item.id) || !walk) return;
    setDoneIds(new Set(doneIds).add(item.id));
    await markHomeworkDone(dog!.id, item.id, walk.id);
  }

  async function save() {
    if (!walk) return;
    setSaving(true);
    await finishWalk(walk.id, { durationSeconds: elapsed, notes });
    if (shareToCommunity) {
      await shareWalkToCommunity({ ...walk, durationSeconds: elapsed, notes }, dog!.name);
    }
    setSaving(false);
    router.replace("/customer/walks");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {phase === "idle" && (
        <View style={styles.idle}>
          <Text style={styles.heading}>Start a session with {dog.name}</Text>

          <View style={styles.kindToggle}>
            {(["walk", "training"] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.kindOption, kind === k && styles.kindOptionActive]}
              >
                <Text style={[styles.kindLabel, kind === k && styles.kindLabelActive]}>
                  {k === "walk" ? "Walk" : "Training"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button title={starting ? "Starting…" : "Start"} onPress={start} loading={starting} />
        </View>
      )}

      {phase !== "idle" && (
        <View style={styles.tracking}>
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          <Text style={styles.kindNote}>{kind === "walk" ? "Walk" : "Training"} with {dog.name}</Text>

          {phase === "tracking" && <Button title="Stop" variant="secondary" onPress={stop} />}

          {homework.length > 0 && (
            <View style={styles.homeworkSection}>
              <Text style={styles.sectionTitle}>Homework</Text>
              {homework.map((item) => {
                const done = doneIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={styles.homeworkRow}
                    onPress={() => toggleHomework(item)}
                    disabled={done}
                  >
                    <Ionicons
                      name={done ? "checkbox" : "square-outline"}
                      size={22}
                      color={done ? colors.accent : colors.paperDim}
                    />
                    <View style={styles.homeworkText}>
                      <Text style={[styles.homeworkName, done && styles.homeworkNameDone]}>
                        {item.drillName}
                      </Text>
                      {item.note ? <Text style={styles.homeworkNote}>{item.note}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {phase === "finished" && (
            <View style={styles.finishForm}>
              <Text style={styles.sectionTitle}>How did it go?</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any progress or issues worth noting…"
                placeholderTextColor={colors.paperDim}
                multiline
              />

              <View style={styles.shareRow}>
                <Text style={styles.shareLabel}>Share to community</Text>
                <Switch
                  value={shareToCommunity}
                  onValueChange={setShareToCommunity}
                  trackColor={{ false: colors.fieldBg, true: colors.accent }}
                  thumbColor={colors.paper}
                />
              </View>

              {saving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Button title="Save" onPress={save} />
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 24,
  },
  idle: {
    gap: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.paper,
  },
  kindToggle: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  kindOption: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  kindOptionActive: {
    backgroundColor: colors.accent,
  },
  kindLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paperDim,
  },
  kindLabelActive: {
    color: colors.accentInk,
  },
  tracking: {
    gap: 24,
    alignItems: "center",
  },
  timer: {
    fontSize: 56,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.paper,
  },
  kindNote: {
    fontSize: 14,
    color: colors.paperDim,
    marginTop: -16,
  },
  homeworkSection: {
    alignSelf: "stretch",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  homeworkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 12,
  },
  homeworkText: {
    flex: 1,
  },
  homeworkName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  homeworkNameDone: {
    color: colors.paperDim,
    textDecorationLine: "line-through",
  },
  homeworkNote: {
    marginTop: 2,
    fontSize: 12,
    color: colors.paperDim,
  },
  finishForm: {
    alignSelf: "stretch",
    gap: 14,
  },
  notesInput: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: colors.paper,
    textAlignVertical: "top",
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
});
