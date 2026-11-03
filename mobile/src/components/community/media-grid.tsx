import { Image } from "expo-image";
import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { ImageViewer, type ImageCaption } from "@/components/community/image-viewer";
import { Pressable } from "@/components/pressable";
import { VideoTile } from "@/components/community/video-tile";
import type { MediaItem } from "@/data/community";
import { mediaUrl } from "@/lib/media";

/**
 * Edge to edge, as in the Kanvas app: one item full width, several in a
 * two-up square grid. A tap on a photo opens it full screen; one viewer per
 * post, so a swipe moves through that post's photos (videos stay in the grid).
 */
export function MediaGrid({ media, caption }: { media: MediaItem[]; caption?: ImageCaption }) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const photos = media.filter((m) => m.type === "image").map((m) => mediaUrl(m.url)!);

  if (media.length === 0) return null;

  const photo = (url: string, style: StyleProp<ViewStyle>, key?: number) => (
    <Pressable key={key} onPress={() => setOpenUrl(url)} accessibilityLabel="Open photo" style={style}>
      <Image source={url} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
    </Pressable>
  );
  const viewer = openUrl && (
    <ImageViewer images={photos} initialIndex={Math.max(0, photos.indexOf(openUrl))} caption={caption} onClose={() => setOpenUrl(null)} />
  );

  if (media.length === 1) {
    const item = media[0];
    const uri = mediaUrl(item.url)!;
    return (
      <View style={{ marginTop: 12, overflow: "hidden" }}>
        {item.type === "video" ? (
          <VideoTile uri={uri} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }} />
        ) : (
          photo(uri, { width: "100%", aspectRatio: 4 / 3 })
        )}
        {viewer}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 2, overflow: "hidden" }}>
      {media.map((item, i) =>
        item.type === "video" ? (
          <VideoTile key={i} uri={mediaUrl(item.url)!} style={{ width: "49.5%", aspectRatio: 1, backgroundColor: "#000" }} />
        ) : (
          photo(mediaUrl(item.url)!, { width: "49.5%", aspectRatio: 1 }, i)
        )
      )}
      {viewer}
    </View>
  );
}
