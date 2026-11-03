import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";

import { Pressable } from "@/components/pressable";
import type { Attachment } from "@/data/inbox";
import { colors } from "@/theme";

/* The composer's tray, copied from the Kanvas app's components/chat/staged-attachments.tsx. */

/** How many photos, videos and files can wait in the composer at once. */
export const MAX_STAGED = 10;

/**
 * A photo, video or file chosen in the composer but not sent yet. It goes
 * when the person taps Send, each as its own message (the backend holds one
 * attachment per message).
 */
export type StagedAttachment = {
  key: string;
  /** A local file:// (or content://) URI the upload can read. */
  uri: string;
  mimeType: string;
  type: Attachment["type"];
  name: string | null;
  /** What to show in the tray: the photo itself, or a frame of the video when we can get one. Null shows an icon. */
  previewUri: string | null;
  /** Videos only, in milliseconds, when known. */
  durationMs?: number | null;
};

const TILE = 64;

export function formatDuration(ms: number | null | undefined): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        position: "absolute",
        top: -7,
        right: -7,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.foreground,
        borderWidth: 2,
        borderColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="close" size={13} color={colors.background} />
    </Pressable>
  );
}

function MediaTile({ item, onRemove }: { item: StagedAttachment; onRemove: () => void }) {
  // A video frame that won't load (an iPhone .mov, say) falls back to an icon.
  const [previewFailed, setPreviewFailed] = useState(false);
  const isVideo = item.type === "video";
  const showPreview = !!item.previewUri && !previewFailed;
  const duration = isVideo ? formatDuration(item.durationMs) : null;

  return (
    <View style={{ width: TILE, height: TILE }}>
      <View
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "rgba(245,245,242,0.08)",
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showPreview ? (
          <Image source={{ uri: item.previewUri! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setPreviewFailed(true)} />
        ) : (
          <Ionicons name={isVideo ? "videocam-outline" : "image-outline"} size={24} color={colors.muted} />
        )}
        {isVideo && (
          <View
            style={{
              position: "absolute",
              left: 4,
              bottom: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 8,
              paddingHorizontal: 4,
              paddingVertical: 1,
            }}
          >
            <Ionicons name="play" size={10} color="#fff" />
            {duration && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>{duration}</Text>}
          </View>
        )}
      </View>
      <RemoveButton onPress={onRemove} label={isVideo ? "Remove video" : "Remove photo"} />
    </View>
  );
}

function FileTile({ item, onRemove }: { item: StagedAttachment; onRemove: () => void }) {
  return (
    <View style={{ height: TILE, maxWidth: 168 }}>
      <View
        style={{
          height: TILE,
          borderRadius: 12,
          backgroundColor: "rgba(245,245,242,0.08)",
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingRight: 14,
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(245,245,242,0.1)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="document-text-outline" size={18} color={colors.foreground} />
        </View>
        <Text numberOfLines={2} style={{ color: colors.foreground, fontSize: 12, flexShrink: 1, maxWidth: 108 }}>
          {item.name ?? "File"}
        </Text>
      </View>
      <RemoveButton onPress={onRemove} label={`Remove ${item.name ?? "file"}`} />
    </View>
  );
}

/**
 * The tray above the composer's text field: what's been chosen to go with
 * the next message, each with a ✕ to take it out again.
 */
export function StagedAttachments({
  items,
  onRemove,
  note,
}: {
  items: StagedAttachment[];
  onRemove: (key: string) => void;
  /** A muted line under the tray (e.g. a coach sending by text, where attachments still go in-app). */
  note?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, alignItems: "center" }}
      >
        {items.map((item) =>
          item.type === "file" ? (
            <FileTile key={item.key} item={item} onRemove={() => onRemove(item.key)} />
          ) : (
            <MediaTile key={item.key} item={item} onRemove={() => onRemove(item.key)} />
          ),
        )}
      </ScrollView>
      {!!note && <Text style={{ color: colors.muted, fontSize: 11, paddingHorizontal: 14, paddingTop: 4 }}>{note}</Text>}
    </View>
  );
}
