import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text } from "react-native";

import { Screen } from "@/components/Screen";
import { Button, EmptyState, Loading, Pill } from "@/components/ui";
import { getDrill } from "@/data/homework";
import { mediaUrl } from "@/lib/media";
import { useAsync } from "@/lib/useAsync";
import { colors, radius } from "@/theme";

export default function DrillPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsync(() => getDrill(id), [id]);

  if (loading) return <Loading />;
  if (!data) return <EmptyState title="Drill not found" />;
  const { drill, category, level } = data;

  return (
    <Screen>
      <Stack.Screen options={{ title: drill.name }} />
      <Pill label={`${category} · Level ${level}`} />
      <Text style={styles.title}>{drill.name}</Text>
      {drill.blocks.length === 0 ? <Text style={styles.body}>No how-to written yet.</Text> : null}
      {drill.blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return <Text key={b.id} style={styles.heading}>{b.text}</Text>;
          case "paragraph":
            return <Text key={b.id} style={styles.body}>{b.text}</Text>;
          case "image":
            return <Image key={b.id} source={mediaUrl(b.url)} style={styles.image} contentFit="cover" />;
          case "video":
            return <Button key={b.id} variant="secondary" label="▶ Watch video" onPress={() => WebBrowser.openBrowserAsync(mediaUrl(b.url)!)} />;
        }
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.paper, fontSize: 26, fontWeight: "800" },
  heading: { color: colors.paper, fontSize: 19, fontWeight: "700" },
  body: { color: colors.paper, fontSize: 16, lineHeight: 24 },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.inkSoft },
});
