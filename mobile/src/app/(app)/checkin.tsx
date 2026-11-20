import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";

import { DogSwitcher } from "@/components/dog-switcher";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { CARD, LoadingState } from "@/components/ui";
import { MAX_VIDEO_SECONDS, type PickedVideo } from "@/data/homework/assigned";
import { DRILL_RATINGS, getCheckinForms, OVERALL, OVERALL_LABEL, REPLY_PROMISE, submitCheckin, weekLabel, type CheckinForm, type DrillRating, type WeekOverall } from "@/data/memberships";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors } from "@/theme";

const RATING_TONE: Record<DrillRating, string> = { great: colors.success, ok: colors.foreground, struggled: colors.warning };

function Pills<T extends string>({ options, value, onChange, tone }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T | null) => void; tone?: (v: T) => string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        const c = tone?.(o.value) ?? colors.foreground;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticSelection();
              onChange(on ? null : o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? c : colors.border, backgroundColor: on ? c : "transparent" }}
          >
            <Text style={{ color: on ? colors.background : colors.foreground, fontSize: 14, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Online Training's weekly check-in (the Sunday evening push opens it).
 * Optional and quick: tap how each of this week's drills went, how the
 * week was, anything new or worrying, and a short video if they like (up
 * to 30 seconds, compressed, into the homework videos bucket). The
 * trainers see it as a card in chat ("Weekly check-in: Bella") and on
 * their Online board. No reply needed.
 */
export default function CheckinScreen() {
  const router = useRouter();
  const [forms, setForms] = useState<CheckinForm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, DrillRating>>({});
  const [overall, setOverall] = useState<WeekOverall | null>(null);
  const [note, setNote] = useState("");
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");

  const load = useCallback(async () => {
    try {
      setForms(await getCheckinForms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your check-in.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!forms) return <LoadingState error={error} />;
  const form = forms.find((f) => f.dogId === selected) ?? forms.find((f) => !f.done) ?? forms[0] ?? null;

  function choose(id: string) {
    setSelected(id);
    setRatings({});
    setOverall(null);
    setNote("");
    setVideo(null);
  }

  async function pick(from: "camera" | "library") {
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
      // As homework videos: up to 30 seconds, compressed to 720p.
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["videos"],
        videoMaxDuration: MAX_VIDEO_SECONDS,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        allowsEditing: from === "library",
        quality: 0.7,
      };
      const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (a.duration && a.duration > (MAX_VIDEO_SECONDS + 0.5) * 1000) {
        hapticWarning();
        Alert.alert("That video's too long", "Videos can be up to 30 seconds. Please trim it in Photos and try again.");
        return;
      }
      setVideo({ uri: a.uri, name: a.fileName ?? "Check-in video.mp4", mimeType: a.mimeType ?? "video/mp4", durationMs: a.duration ?? null, size: a.fileSize ?? null });
    } catch {
      hapticError();
      Alert.alert("Couldn't open that", "Please try again.");
    }
  }

  async function send() {
    if (!form) return;
    if (!overall && !note.trim() && !video && Object.keys(ratings).length === 0) return Alert.alert("Tap how it went", "Or add a note.");
    try {
      await submitCheckin({ dogId: form.dogId, ratings, overall, note, video, onStage: setStage });
      hapticSuccess();
      setStage("idle");
      setVideo(null);
      await load();
    } catch (err) {
      hapticError();
      setStage("idle");
      Alert.alert("That didn't send", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Weekly check-in" subtitle={form ? `${weekLabel(form.weekOf)} · optional, under a minute` : null} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 14 }}>
        {!form ? (
          <View style={[CARD, { alignItems: "center", paddingVertical: 28 }]}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Nothing to check in</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center" }}>Weekly check-ins are for Online Training. {REPLY_PROMISE}</Text>
          </View>
        ) : (
          <>
            {forms.length > 1 && <DogSwitcher dogs={forms.map((f) => ({ id: f.dogId, name: f.dogName }))} selected={form.dogId} onSelect={choose} />}
            {form.done ? (
              <View style={[CARD, { alignItems: "center", paddingVertical: 28, gap: 6 }]}>
                <Ionicons name="checkmark-circle" size={34} color={colors.success} />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>Thanks! {form.dogName} is checked in</Text>
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                  {form.done.overall ? `${OVERALL_LABEL[form.done.overall]}. ` : ""}There&apos;s nothing else to do: your homework for next week will be in the Homework tab.
                </Text>
                <BigButton label="Back to Homework" variant="outline" onPress={() => router.navigate("/homework")} style={{ marginTop: 10, alignSelf: "stretch" }} />
              </View>
            ) : (
              <>
                {form.drills.length > 0 ? (
                  <View style={[CARD, { gap: 14 }]}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>How did each drill go?</Text>
                    {form.drills.map((d) => (
                      <View key={d.itemId} style={{ gap: 8 }}>
                        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{d.name}</Text>
                        <Pills
                          options={DRILL_RATINGS}
                          value={ratings[d.itemId] ?? null}
                          tone={(v) => RATING_TONE[v]}
                          onChange={(v) =>
                            setRatings((prev) => {
                              const next = { ...prev };
                              if (v) next[d.itemId] = v;
                              else delete next[d.itemId];
                              return next;
                            })
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[CARD, { gap: 10 }]}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>How was {form.dogName}&apos;s week?</Text>
                  <Pills options={OVERALL} value={overall} onChange={setOverall} tone={(v) => (v === "great" ? colors.success : v === "tough" ? colors.warning : colors.foreground)} />
                </View>

                <View style={[CARD, { gap: 10 }]}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Anything new or worrying? (optional)</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g. Barking at the postman again"
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={2000}
                    style={{ minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.foreground, fontSize: 15, textAlignVertical: "top" }}
                  />
                  {video ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="videocam" size={18} color={colors.success} />
                      <Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }} numberOfLines={1}>
                        Video added{video.durationMs ? ` · ${Math.round(video.durationMs / 1000)}s` : ""}
                      </Text>
                      <Pressable onPress={() => setVideo(null)} hitSlop={8}>
                        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <BigButton icon="videocam-outline" label="Record a video" variant="outline" onPress={() => pick("camera")} style={{ flex: 1, minHeight: 44 }} />
                      <BigButton icon="images-outline" label="Choose" variant="outline" onPress={() => pick("library")} style={{ flex: 1, minHeight: 44 }} />
                    </View>
                  )}
                  <Text style={{ color: colors.muted, fontSize: 12 }}>A short video (up to 30 seconds) if you&apos;d like us to see something.</Text>
                </View>

                <BigButton
                  icon="send-outline"
                  label={stage === "uploading" ? "Uploading the video…" : stage === "saving" ? "Sending…" : "Send check-in"}
                  busy={stage !== "idle"}
                  onPress={send}
                />
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>No reply needed. {REPLY_PROMISE}</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
