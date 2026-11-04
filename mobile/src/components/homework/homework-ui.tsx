import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Linking, Modal, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { Pressable } from "@/components/pressable";
import { completeToday, MAX_VIDEO_SECONDS, type CompleteResult, type Homework, type PickedVideo } from "@/data/homework/assigned";
import { HOMEWORK_TARGET_DAYS } from "@/data/reports";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors, glass, GLASS_BORDER } from "@/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills a third for each day done, animating when it changes. */
export function ProgressRing({ done, size = 56, stroke = 5 }: { done: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.min(done, HOMEWORK_TARGET_DAYS);
  const progress = useRef(new Animated.Value(shown / HOMEWORK_TARGET_DAYS)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: shown / HOMEWORK_TARGET_DAYS, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [shown, progress]);
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  const complete = shown >= HOMEWORK_TARGET_DAYS;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityLabel={`Day ${shown} of ${HOMEWORK_TARGET_DAYS}`}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={colors.success} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      {complete ? (
        <Ionicons name="checkmark" size={size * 0.42} color={colors.success} />
      ) : (
        <Text style={{ color: colors.foreground, fontSize: size * 0.27, fontWeight: "800" }}>
          {shown}/{HOMEWORK_TARGET_DAYS}
        </Text>
      )}
    </View>
  );
}

/** Pulsing grey blocks while the page loads. */
export function Skeleton({ height, width = "100%", radius = 16, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: object }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: "rgba(245,242,234,0.07)", opacity: pulse }, style]} />;
}

/** "Day 2 of 3" for the next day, or where it stands. */
export function dayLabel(h: Homework): string {
  if (h.complete) return "Complete";
  if (h.doneToday) return `Day ${h.days.length} of ${HOMEWORK_TARGET_DAYS} done`;
  return `Day ${h.days.length + 1} of ${HOMEWORK_TARGET_DAYS}`;
}

/**
 * "Complete today": the sheet that records the day. Two optional extras for
 * the trainer: a short video (30 seconds at most) and a note. Save records
 * the day with them, Skip extras records it without.
 */
export function CompleteSheet({
  homework,
  onClose,
  onDone,
}: {
  homework: Homework | null;
  onClose: () => void;
  onDone: (h: Homework, result: CompleteResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!homework) return;
    setNote("");
    setVideo(null);
    setStage("idle");
    setError(null);
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [homework, slide]);

  if (!homework) return null;
  const day = homework.days.length + 1;
  const busy = stage !== "idle";

  async function pick(from: "camera" | "library") {
    setError(null);
    try {
      if (from === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera is off", "Allow Nelly & Nova to use the camera in Settings, then try again.", [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]);
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["videos"],
        videoMaxDuration: MAX_VIDEO_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        // Library videos: iOS's own trimmer, held to 30 seconds.
        allowsEditing: from === "library",
        quality: 0.7,
      };
      const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (a.duration && a.duration > (MAX_VIDEO_SECONDS + 0.5) * 1000) {
        hapticWarning();
        setError("Videos can be up to 30 seconds — please trim it in Photos and try again.");
        return;
      }
      hapticSelection();
      setVideo({ uri: a.uri, name: a.fileName ?? "Homework video.mp4", mimeType: a.mimeType ?? "video/mp4", durationMs: a.duration ?? null, size: a.fileSize ?? null });
    } catch {
      hapticError();
      setError("Couldn't open that. Please try again.");
    }
  }

  async function save(withExtras: boolean) {
    if (!homework) return;
    setError(null);
    try {
      const result = await completeToday(homework, {
        note: withExtras ? note : undefined,
        video: withExtras ? video : null,
        onStage: setStage,
      });
      hapticSuccess();
      onDone(homework, result);
    } catch (e) {
      hapticError();
      setStage("idle");
      setError(e instanceof Error ? e.message : "Couldn't save today. Please try again.");
    }
  }

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable backdrop onPress={busy ? undefined : onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Pressable
            backdrop
            onPress={() => {}}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, ...GLASS_BORDER, paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16 }}
          >
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 }}>
              <ProgressRing done={homework.days.length} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>Nice work!</Text>
                <Text style={{ color: colors.muted, fontSize: 15, marginTop: 2 }} numberOfLines={2}>
                  Day {day} of {HOMEWORK_TARGET_DAYS} for {homework.card.focus}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 22, marginBottom: 8 }}>Add for your trainer (optional)</Text>
            {video ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", padding: 12 }}>
                <Ionicons name="videocam" size={20} color={colors.success} />
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  Video added{video.durationMs ? ` · ${Math.round(video.durationMs / 1000)}s` : ""}
                </Text>
                {!busy && (
                  <Pressable onPress={() => setVideo(null)} hitSlop={10} accessibilityLabel="Remove the video">
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <SheetButton icon="videocam-outline" label="Record a video" onPress={() => pick("camera")} disabled={busy} />
                <SheetButton icon="film-outline" label="Choose a video" onPress={() => pick("library")} disabled={busy} />
              </View>
            )}
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
              Up to 30 seconds, so your trainer can help. Videos are kept until this homework is complete, then deleted.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              editable={!busy}
              multiline
              maxLength={2000}
              placeholder="Add a note, e.g. how it went or where you got stuck"
              placeholderTextColor={colors.muted}
              style={{ marginTop: 14, minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, paddingTop: 12, color: colors.foreground, fontSize: 15, textAlignVertical: "top", backgroundColor: colors.background }}
            />
            {(note.trim() || video) && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Sent to the trainers in your chat, so they can reply there.</Text>}
            {error && <Text style={{ color: colors.danger, fontSize: 14, marginTop: 10 }}>{error}</Text>}

            <View style={{ marginTop: 18, gap: 10 }}>
              <Pressable
                onPress={() => save(true)}
                disabled={busy}
                style={{ height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: busy ? 0.75 : 1 }}
              >
                {busy && <ActivityIndicator color={colors.accentForeground} />}
                <Text style={{ color: colors.accentForeground, fontSize: 16, fontWeight: "700" }}>{stage === "uploading" ? "Uploading video…" : stage === "saving" ? "Saving…" : "Save"}</Text>
              </Pressable>
              {!busy && (
                <Pressable onPress={() => save(false)} style={{ height: 46, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 15 }}>Skip extras</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function SheetButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 14, ...glass }}>
      <Ionicons name={icon} size={22} color={colors.foreground} />
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const BURST = 14;

/** "Sit complete!": a check that pops in with a burst of dots, then fades. RN Animated only. */
export function Celebration({ title, onFinish }: { title: string | null; onFinish: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;

  useEffect(() => {
    if (!title) return;
    pop.setValue(0);
    burst.setValue(0);
    fade.setValue(0);
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(900),
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    anim.start(() => finish.current());
    return () => anim.stop();
  }, [title, pop, burst, fade]);

  if (!title) return null;
  const dotColors = [colors.success, colors.warning, colors.foreground, "#60a5fa"];
  return (
    <Modal visible transparent animationType="none" onRequestClose={onFinish}>
      <Pressable backdrop onPress={onFinish} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", opacity: fade }}>
          <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
            {Array.from({ length: BURST }, (_, i) => {
              const angle = (i / BURST) * Math.PI * 2;
              const dist = 90 + (i % 3) * 18;
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: "absolute",
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: dotColors[i % dotColors.length],
                    opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                      { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                      { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) },
                    ],
                  }}
                />
              );
            })}
            <Animated.View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: colors.success,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
              }}
            >
              <Ionicons name="checkmark" size={64} color={colors.background} />
            </Animated.View>
          </View>
          <Animated.Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", marginTop: 28, textAlign: "center", paddingHorizontal: 32, transform: [{ scale: pop }] }}>{title}</Animated.Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 8 }}>3 of 3 days. Brilliant work!</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
