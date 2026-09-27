import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { VideoTile } from "@/components/community/video-tile";
import { ScreenHeader } from "@/components/screen-header";
import { LoadingState, Tag } from "@/components/ui";
import { getDrill } from "@/data/homework";
import { mediaUrl } from "@/lib/media";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

/** A drill's blog-style page: headings, paragraphs, photos and videos. */
export default function DrillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsync(() => getDrill(id), [id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={data?.drill.name ?? "Drill"} />
      {loading ? (
        <LoadingState />
      ) : !data ? (
        <LoadingState error="This drill couldn't be found." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 14 }}>
          <View style={{ flexDirection: "row" }}>
            <Tag label={`${data.category} · Level ${data.level}`} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>{data.drill.name}</Text>
          {data.drill.blocks.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>No how-to written for this drill yet.</Text>}
          {data.drill.blocks.map((b) => {
            switch (b.type) {
              case "heading":
                return (
                  <Text key={b.id} style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 6 }}>
                    {b.text}
                  </Text>
                );
              case "paragraph":
                return (
                  <Text key={b.id} style={{ color: colors.foreground, fontSize: 15, lineHeight: 23 }}>
                    {b.text}
                  </Text>
                );
              case "image":
                return <Image key={b.id} source={mediaUrl(b.url)} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 14 }} contentFit="cover" />;
              case "video":
                return <VideoTile key={b.id} uri={mediaUrl(b.url)!} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: "#000" }} />;
            }
          })}
        </ScrollView>
      )}
    </View>
  );
}
