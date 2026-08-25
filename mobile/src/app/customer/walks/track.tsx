import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { RouteMap } from "@/components/walks/RouteMap";
import { activeDog, useSession } from "@/lib/session";
import {
  finishWalk,
  getHomeworkForDog,
  markHomeworkDone,
  routeDistanceMeters,
  shareWalkToCommunity,
  startWalk,
  uploadWalkPhotos,
  type HomeworkItem,
  type LatLng,
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

function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
}

export default function TrackWalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const dog = activeDog(session);

  const [phase, setPhase] = useState<Phase>("idle");
  const [kind, setKind] = useState<WalkKind>("walk");
  const [walk, setWalk] = useState<Walk | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [liveLocation, setLiveLocation] = useState<LatLng | null>(null);
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [shareToCommunity, setShareToCommunity] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const distanceMeters = routeDistanceMeters(points);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    getHomeworkForDog(dog.id).then((items) => {
      if (!cancelled) setHomework(items);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  useEffect(() => {
    if (phase !== "tracking" || startedAtMs === null) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, startedAtMs]);

  // Continuous route sampling while tracking.
  useEffect(() => {
    if (phase !== "tracking") return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (loc) => {
        const point = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLiveLocation(point);
        setPoints((prev) => [...prev, point]);
      }
    ).then((sub) => {
      if (cancelled) sub.remove();
      else subscription = sub;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [phase]);

  if (!dog) return null;

  async function start() {
    setStarting(true);
    let location: LatLng | null = null;
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
    setPoints(location ? [location] : []);
    setLiveLocation(location);
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

  async function pickPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  }

  async function save() {
    if (!walk) return;
    setSaving(true);

    const finished: Walk = {
      ...walk,
      durationSeconds: elapsed,
      distanceMeters,
      notes,
      locationName,
      sharedPostId: null,
    };

    await finishWalk(walk.id, {
      durationSeconds: elapsed,
      distanceMeters,
      notes,
      locationName,
      endLocation: liveLocation,
      points,
    });

    const photoUrls = photos.length > 0 ? await uploadWalkPhotos(walk.id, photos) : [];

    if (shareToCommunity) {
      await shareWalkToCommunity(finished, dog!.name, photoUrls);
    }

    setSaving(false);
    router.replace("/customer/walks");
  }

  return (
    <View style={styles.screen}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + 8 }]}
        hitSlop={10}
      >
        <Ionicons name="close" size={22} color={colors.paper} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === "idle" && (
          <View style={[styles.idle, { marginTop: insets.top + 56 }]}>
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
            <RouteMap route={points} live={phase === "tracking" ? liveLocation : null} height={260} />

            <View style={styles.statsRow}>
              <Stat label="Time" value={formatElapsed(elapsed)} />
              <Stat label="Distance" value={formatDistance(distanceMeters)} />
            </View>

            <Text style={styles.kindNote}>
              {kind === "walk" ? "Walk" : "Training"} with {dog.name}
            </Text>

            {phase === "tracking" && (
              <View style={styles.paddedRow}>
                <Button title="Stop" variant="secondary" onPress={stop} />
              </View>
            )}

            {homework.length > 0 && (
              <View style={styles.section}>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How did it go?</Text>

                <TextInput
                  style={styles.locationInput}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Where was this? (e.g. Tynemouth Longsands)"
                  placeholderTextColor={colors.paperDim}
                />

                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any progress or issues worth noting…"
                  placeholderTextColor={colors.paperDim}
                  multiline
                />

                <View style={styles.photoRow}>
                  {photos.map((uri) => (
                    <View key={uri} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <Pressable style={styles.photoRemove} onPress={() => removePhoto(uri)} hitSlop={6}>
                        <Ionicons name="close-circle" size={18} color={colors.paper} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable style={styles.photoAdd} onPress={pickPhotos}>
                    <Ionicons name="images-outline" size={20} color={colors.paperDim} />
                  </Pressable>
                  <Pressable style={styles.photoAdd} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={20} color={colors.paperDim} />
                  </Pressable>
                </View>

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
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  closeButton: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  content: {
    paddingBottom: 32,
  },
  idle: {
    paddingHorizontal: H_PADDING,
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
    gap: 20,
  },
  paddedRow: {
    paddingHorizontal: H_PADDING,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: H_PADDING,
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.paper,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.paperDim,
  },
  kindNote: {
    textAlign: "center",
    fontSize: 13,
    color: colors.paperDim,
  },
  section: {
    paddingHorizontal: H_PADDING,
    gap: 12,
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
  locationInput: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.paper,
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
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoThumbWrap: {
    width: 64,
    height: 64,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  photoAdd: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
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
