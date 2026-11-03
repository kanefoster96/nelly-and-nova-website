import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { GuidelinesAgreement } from "@/components/community/post-card";
import { Pressable } from "@/components/pressable";
import { acceptGuidelines, createPost, type PickedMedia, type Viewer } from "@/data/community";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

/**
 * The Kanvas Student Home composer. Collapsed: a "What's on your mind?" pill
 * with a camera button. Tapped: a card with title, words, photos/videos,
 * (for trainers) Pin to top, and on a first post the Community Guidelines.
 */
export function PostComposer({
  viewer,
  onPosted,
  onGuidelinesAccepted,
}: {
  viewer: Viewer;
  onPosted: () => void;
  onGuidelinesAccepted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assets, setAssets] = useState<PickedMedia[]>([]);
  const [pinned, setPinned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function expand() {
    animateListChange();
    setExpanded(true);
  }

  function collapse() {
    animateListChange();
    setExpanded(false);
    setTitle("");
    setBody("");
    setAssets([]);
    setPinned(false);
    setError(null);
  }

  async function pickMedia(kind: "image" | "video") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      hapticWarning();
      setError("Photo library access is needed to attach media.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ["images"] : ["videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setAssets((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? (kind === "image" ? "image/jpeg" : "video/mp4"), kind })),
    ]);
  }

  function removeAsset(index: number) {
    animateListChange();
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!body.trim() && !title.trim() && assets.length === 0) {
      hapticWarning();
      setError("Write something or add a photo/video first.");
      return;
    }
    if (!viewer.guidelinesAccepted && !agree) {
      hapticWarning();
      setError("Please agree to the Community Guidelines first.");
      return;
    }
    setError(null);
    setPosting(true);
    try {
      if (!viewer.guidelinesAccepted) {
        await acceptGuidelines(viewer.id);
        onGuidelinesAccepted();
      }
      await createPost(viewer, { title: title.trim(), body: body.trim(), media: assets, pinned });
      hapticSuccess();
      setExpanded(false);
      setTitle("");
      setBody("");
      setAssets([]);
      setPinned(false);
      onPosted();
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Could not save your post.");
    } finally {
      setPosting(false);
    }
  }

  if (!expanded) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={expand}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            ...GLASS_BORDER,
            backgroundColor: colors.surface,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <AvatarCircle name={viewer.name} avatarUrl={viewer.avatarUrl} size={32} />
          <Text style={{ color: colors.muted, fontSize: 14 }}>What&apos;s on your mind?</Text>
        </Pressable>
        <Pressable
          onPress={expand}
          hitSlop={6}
          accessibilityLabel="Add a photo or video"
          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="camera-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>
    );
  }

  const roundBtn = { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" } as const;

  return (
    <View style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AvatarCircle name={viewer.name} avatarUrl={viewer.avatarUrl} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{viewer.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Posting to Community</Text>
        </View>
      </View>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Add a title (optional)"
        placeholderTextColor={colors.muted}
        style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginTop: 14 }}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Share something…"
        placeholderTextColor={colors.muted}
        style={{ color: colors.foreground, fontSize: 14, marginTop: 6, minHeight: 60, textAlignVertical: "top" }}
      />

      {assets.length > 0 && (
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {assets.map((a, i) => (
            <View key={`${a.uri}-${i}`} style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", backgroundColor: colors.background }}>
              {a.kind === "video" ? (
                <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="videocam-outline" size={22} color={colors.muted} />
                </View>
              ) : (
                <Image source={a.uri} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              )}
              <Pressable
                onPress={() => removeAsset(i)}
                accessibilityLabel="Remove"
                style={{ position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, padding: 2 }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {viewer.isTrainer && (
        <Pressable
          onPress={() => {
            hapticSelection();
            setPinned((v) => !v);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}
        >
          <Ionicons name={pinned ? "checkbox" : "square-outline"} size={18} color={pinned ? colors.foreground : colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 12 }}>Pin to the top of the feed</Text>
        </Pressable>
      )}

      {!viewer.guidelinesAccepted && <GuidelinesAgreement checked={agree} onToggle={() => setAgree((v) => !v)} />}

      {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>{error}</Text>}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => pickMedia("image")} accessibilityLabel="Add photos" style={roundBtn}>
            <Ionicons name="camera-outline" size={17} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => pickMedia("video")} accessibilityLabel="Add videos" style={roundBtn}>
            <Ionicons name="videocam-outline" size={17} color={colors.muted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={collapse} hitSlop={8} disabled={posting}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500" }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={posting}
            style={[{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }, posting && { opacity: 0.6 }]}
          >
            {posting ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Text style={{ color: colors.accentForeground, fontSize: 14, fontWeight: "600" }}>Post</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
