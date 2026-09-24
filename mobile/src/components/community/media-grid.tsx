import { Image } from "expo-image";
import { View } from "react-native";

import { VideoTile } from "@/components/community/video-tile";
import type { MediaItem } from "@/data/community";
import { mediaUrl } from "@/lib/media";

/** Edge to edge: one item full width, several in a two-up square grid. */
export function MediaGrid({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    const item = media[0];
    const uri = mediaUrl(item.url)!;
    return (
      <View style={{ marginTop: 12, overflow: "hidden" }}>
        {item.type === "video" ? (
          <VideoTile uri={uri} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }} />
        ) : (
          <Image source={uri} style={{ width: "100%", aspectRatio: 4 / 3 }} contentFit="cover" transition={150} />
        )}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 2, overflow: "hidden" }}>
      {media.map((item, i) =>
        item.type === "video" ? (
          <VideoTile key={i} uri={mediaUrl(item.url)!} style={{ width: "49.5%", aspectRatio: 1, backgroundColor: "#000" }} />
        ) : (
          <Image key={i} source={mediaUrl(item.url)} style={{ width: "49.5%", aspectRatio: 1 }} contentFit="cover" transition={150} />
        )
      )}
    </View>
  );
}
