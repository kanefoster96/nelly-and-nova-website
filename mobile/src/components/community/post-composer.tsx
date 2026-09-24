import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { createPost, type MediaItem, type Post } from "@/data/community";
import { colors } from "@/theme";

import type { Viewer } from "./feed-screen";

/**
 * Collapsed: a "What's on your mind?" pill with a camera button. Tapped: a
 * card with title, text, photos/videos, and (for trainers) Pin to top.
 */
export function PostComposer({ viewer, onPosted }: { viewer: Viewer; onPosted: (post: Post) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function collapse() {
    setExpanded(false);
    setTitle("");
    setBody("");
    setMedia([]);
    setPinned(false);
    setError(null);
  }

  async function pickMedia(kind: "image" | "video") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [kind === "image" ? "images" : "videos"],
      allowsMultipleSelection: kind === "image",
      quality: 0.8,
    });
    if (result.canceled) return;
    setExpanded(true);
    setMedia((prev) => [...prev, ...result.assets.map((a) => ({ type: kind, url: a.uri }) as MediaItem)]);
  }

  async function handleSubmit() {
    if (!body.trim() && !title.trim() && media.length === 0) {
      setError("Write something or add a photo first.");
      return;
    }
    setError(null);
    setPosting(true);
    try {
      const post = await createPost(viewer, { title: title.trim(), body: body.trim(), media, pinned });
      collapse();
      onPosted(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your post.");
    } finally {
      setPosting(false);
    }
  }

  if (!expanded) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => setExpanded(true)}
          style={({ pressed }) => [
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 10,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <AvatarCircle name={viewer.name} avatarUrl={viewer.avatarUrl} size={32} />
          <Text style={{ color: colors.muted, fontSize: 14 }}>What&apos;s on your mind?</Text>
        </Pressable>
        <Pressable
          onPress={() => pickMedia("image")}
          hitSlop={6}
          accessibilityLabel="Add a photo"
          style={({ pressed }) => [
            { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="camera-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>
    );
  }

  const roundBtn = { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" } as const;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18, padding: 16 }}>
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
        autoFocus
        placeholder="Share something…"
        placeholderTextColor={colors.muted}
        style={{ color: colors.foreground, fontSize: 14, marginTop: 6, minHeight: 60, textAlignVertical: "top" }}
      />

      {media.length > 0 && (
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {media.map((m, i) => (
            <View key={`${m.url}-${i}`} style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", backgroundColor: colors.background }}>
              {m.type === "video" ? (
                <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="videocam-outline" size={22} color={colors.muted} />
                </View>
              ) : (
                <Image source={m.url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              )}
              <Pressable
                onPress={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
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
        <Pressable onPress={() => setPinned((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
          <Ionicons name={pinned ? "checkbox" : "square-outline"} size={18} color={pinned ? colors.foreground : colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 12 }}>Pin to the top of the feed</Text>
        </Pressable>
      )}

      {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>{error}</Text>}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => pickMedia("image")} accessibilityLabel="Add photos" style={({ pressed }) => [roundBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="camera-outline" size={17} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => pickMedia("video")} accessibilityLabel="Add a video" style={({ pressed }) => [roundBtn, pressed && { opacity: 0.7 }]}>
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
            style={({ pressed }) => [
              { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
              posting && { opacity: 0.6 },
              pressed && { opacity: 0.8 },
            ]}
          >
            {posting ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Text style={{ color: colors.accentForeground, fontSize: 14, fontWeight: "600" }}>Post</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
