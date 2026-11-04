import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";

import { PhotoViewer } from "@/components/day-photos/photo-viewer";
import { Pressable } from "@/components/pressable";
import { BigButton, DetailCard } from "@/components/trainer/cards";
import { addDayPhotos, deleteDayPhoto, getDayPhotos, type DayPhoto } from "@/data/day-photos";
import { todayLondon } from "@/data/sessions";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

/** JPEG quality for the upload: about a tenth of the original's size, still sharp on a phone. */
const QUALITY = 0.5;
const MAX_AT_ONCE = 20;

/**
 * Trainer, on a dog's page (app/(app)/dog/[id].tsx): "Today's photos" and
 * "Add photo". Take one with the camera, or choose several from the
 * library; they're compressed, uploaded to the private day-photos bucket
 * and show on the owner's Profile tab. The owner gets "📸 New photos of
 * Bella" once a day, with the first batch (data/day-photos.ts). Tap a photo
 * to see it, hold it to delete it.
 */
export function AddDayPhoto({ dogId, dogName }: { dogId: string; dogName: string }) {
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setPhotos(await getDayPhotos(dogId, { on: todayLondon() }));
    } catch {
      // Keep what's shown.
    }
  }, [dogId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: QUALITY,
        exif: false,
        allowsMultipleSelection: from === "library",
        selectionLimit: MAX_AT_ONCE,
        orderedSelection: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || r.assets.length === 0) return;
      const assets = r.assets.slice(0, MAX_AT_ONCE);
      setProgress({ done: 0, total: assets.length });
      const added = await addDayPhotos(
        dogId,
        assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height, mimeType: a.mimeType })),
        (done, total) => setProgress({ done, total }),
      );
      setProgress(null);
      animateListChange();
      await load();
      if (added === assets.length) {
        hapticSuccess();
      } else if (added > 0) {
        hapticWarning();
        Alert.alert("Some didn't upload", `${added} of ${assets.length} photos went up. Try the others again in a moment.`);
      } else {
        hapticError();
        Alert.alert("The photos didn't upload", "Check your connection and try again.");
      }
    } catch {
      setProgress(null);
      hapticError();
      Alert.alert("Couldn't add the photos", "Please try again.");
    }
  }

  function choose() {
    Alert.alert(`Add photos of ${dogName}`, `They show on ${dogName}'s owner's Profile, and they get a notification.`, [
      { text: "Take a photo", onPress: () => void pick("camera") },
      { text: "Choose from library", onPress: () => void pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function remove(photo: DayPhoto) {
    hapticWarning();
    Alert.alert("Delete this photo?", `It comes off ${dogName}'s day for their owner too.`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDayPhoto(photo);
            animateListChange();
            setPhotos((list) => list.filter((p) => p.id !== photo.id));
          } catch (err) {
            hapticError();
            Alert.alert("Couldn't delete it", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  const busy = progress !== null;

  return (
    <DetailCard title="Today's photos" icon="camera-outline">
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginBottom: 14 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => {
                hapticSelection();
                setViewing(i);
              }}
              onLongPress={() => remove(p)}
              accessibilityRole="imagebutton"
              accessibilityHint="Hold to delete"
              style={{ width: 84, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: colors.background, borderWidth: 1, ...GLASS_BORDER }}
            >
              {p.url ? <Image source={{ uri: p.url, cacheKey: p.path }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 14 }}>None yet today. Photos you add show on {dogName}&apos;s owner&apos;s Profile.</Text>
      )}
      <BigButton
        icon="camera"
        label={busy ? (progress!.total > 1 ? `Uploading ${Math.min(progress!.done + 1, progress!.total)} of ${progress!.total}…` : "Uploading…") : "Add photo"}
        onPress={choose}
        busy={busy}
      />
      {photos.length > 0 && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Hold a photo to delete it.</Text>}
      <PhotoViewer photos={photos} start={viewing} onClose={() => setViewing(null)} />
    </DetailCard>
  );
}
