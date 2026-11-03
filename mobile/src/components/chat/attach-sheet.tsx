import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Modal, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/pressable";
import type { StagedAttachment } from "@/components/chat/staged-attachments";
import { hapticError } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

/*
 * The composer's "Add to message" sheet, after the Kanvas app's: Camera at
 * the top, then rows for the photo picker and Files, and — for a trainer in
 * an owner's chat — Nelly & Nova's versions of Kanvas's share rows. Nothing
 * here sends a photo: what's chosen waits in the tray above the text field.
 *
 * (Kanvas's strip of recent photos needs expo-media-library and
 * react-native-view-shot, native modules this build doesn't have, so the
 * system photo picker does that job here.)
 */

function stagedKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A photo or video from the system picker or the camera, ready for the tray. */
function stageFromPicker(asset: ImagePicker.ImagePickerAsset): StagedAttachment {
  const isVideo = asset.type === "video" || asset.type === "pairedVideo" || !!asset.mimeType?.startsWith("video/");
  return {
    key: stagedKey(),
    uri: asset.uri,
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
    type: isVideo ? "video" : "image",
    name: asset.fileName ?? (isVideo ? "Video.mp4" : "Photo.jpg"),
    // A video file won't draw in <Image> on iPhone, so the tray shows a tile there.
    previewUri: isVideo ? (Platform.OS === "ios" ? null : asset.uri) : asset.uri,
    durationMs: isVideo ? (asset.duration ?? null) : null,
  };
}

function stageFromDocument(asset: DocumentPicker.DocumentPickerAsset): StagedAttachment {
  return { key: stagedKey(), uri: asset.uri, mimeType: asset.mimeType ?? "application/octet-stream", type: "file", name: asset.name, previewUri: null };
}

export type ShareRow = { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

export function AttachSheet({
  visible,
  onClose,
  onAdd,
  limit,
  shareRows = [],
}: {
  visible: boolean;
  onClose: () => void;
  /** Everything chosen, in order — the caller stages it and closes the sheet. */
  onAdd: (items: StagedAttachment[]) => void;
  /** How many more can be staged. */
  limit: number;
  /** Trainer, an owner's chat: onboarding, meet & greet and review links. */
  shareRows?: ShareRow[];
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Bumped each time the sheet opens, so a slow pick that finishes after the
  // sheet was closed doesn't land in the tray uninvited.
  const sessionRef = useRef(0);
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // The backdrop fades with the Modal; the sheet itself slides up from the bottom.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => slide.setValue(0), 350);
      return () => clearTimeout(timer);
    }
    sessionRef.current += 1;
    setBusy(false);
    setMessage(null);
    Animated.timing(slide, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [visible, slide]);

  function add(items: StagedAttachment[], session: number) {
    if (items.length === 0 || session !== sessionRef.current || !visibleRef.current) return;
    onAdd(items);
  }

  async function openCamera() {
    if (busy) return;
    const session = sessionRef.current;
    setMessage(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera is off", "Allow Nelly & Nova to use the camera in Settings, then try again.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      setBusy(true);
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.8 });
      setBusy(false);
      if (result.canceled || result.assets.length === 0) return;
      add([stageFromPicker(result.assets[0])], session);
    } catch {
      setBusy(false);
      hapticError();
      setMessage("Couldn't open the camera — please try again.");
    }
  }

  async function openPhotoPicker() {
    if (busy) return;
    const session = sessionRef.current;
    setMessage(null);
    setBusy(true);
    try {
      // The system photo picker needs no library permission of its own.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, limit),
        orderedSelection: true,
        quality: 0.8,
      });
      setBusy(false);
      if (result.canceled || result.assets.length === 0) return;
      add(result.assets.map(stageFromPicker), session);
    } catch {
      setBusy(false);
      hapticError();
      setMessage("Couldn't open your photos — please try again.");
    }
  }

  async function openFiles() {
    if (busy) return;
    const session = sessionRef.current;
    setMessage(null);
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });
      setBusy(false);
      if (result.canceled || result.assets.length === 0) return;
      add(result.assets.map(stageFromDocument), session);
    } catch {
      setBusy(false);
      hapticError();
      setMessage("Couldn't open Files — please try again.");
    }
  }

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [480, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable backdrop onPress={onClose} accessibilityLabel="Close" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderBottomWidth: 0,
            ...GLASS_BORDER,
            paddingBottom: Math.max(insets.bottom, 12) + 4,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(245,245,242,0.25)" }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 }}>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={8}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(245,245,242,0.08)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontSize: 16, fontWeight: "600" }}>Add to message</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
            <Tile icon="camera-outline" label="Camera" onPress={openCamera} disabled={busy} />
            <Tile icon="images-outline" label="Photos" onPress={openPhotoPicker} disabled={busy} />
            <Tile icon="document-outline" label="Files" onPress={openFiles} disabled={busy} />
          </View>

          {message && <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 16, paddingTop: 10 }}>{message}</Text>}

          <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 16, backgroundColor: "rgba(245,245,242,0.05)", overflow: "hidden" }}>
            <SheetRow icon="images-outline" label="Photos & videos" onPress={openPhotoPicker} disabled={busy} />
            <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 56 }} />
            <SheetRow icon="document-outline" label="Files" onPress={openFiles} disabled={busy} />
            {shareRows.map((row) => (
              <View key={row.key}>
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 56 }} />
                <SheetRow icon={row.icon} label={row.label} onPress={row.onPress} disabled={busy} />
              </View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Tile({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{ flex: 1, height: 92, borderRadius: 16, backgroundColor: "rgba(245,245,242,0.08)", alignItems: "center", justifyContent: "center", gap: 6, opacity: disabled ? 0.6 : 1 }}
    >
      <Ionicons name={icon} size={28} color={colors.foreground} />
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

function SheetRow({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
      <Ionicons name={icon} size={22} color={colors.foreground} />
      <Text style={{ color: colors.foreground, fontSize: 16, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}
