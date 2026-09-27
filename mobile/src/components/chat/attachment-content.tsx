import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { VideoTile } from "@/components/community/video-tile";
import type { Attachment } from "@/data/inbox";
import { colors } from "@/theme";

/** A photo, video or file inside a chat bubble. */
export function AttachmentContent({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  if (attachment.type === "image") {
    return <Image source={attachment.url} style={{ width: 208, height: 208, borderRadius: 12 }} contentFit="cover" transition={150} />;
  }
  if (attachment.type === "video") {
    return <VideoTile uri={attachment.url} style={{ width: 208, height: 208, borderRadius: 12, backgroundColor: "#000" }} />;
  }
  const color = mine ? colors.accentForeground : colors.foreground;
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(attachment.url)} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(127,127,127,0.2)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="document-outline" size={18} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: 14, fontWeight: "600", maxWidth: 170 }}>
        {attachment.name}
      </Text>
    </Pressable>
  );
}
