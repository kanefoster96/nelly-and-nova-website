import { Image } from "expo-image";
import { Text, View } from "react-native";

import { mediaUrl } from "@/lib/media";

// Same deterministic-colour initials fallback as the Kanvas app, so a name
// always renders the same colour.
const PALETTE = ["#f59e0b", "#f43f5e", "#14b8a6", "#0ea5e9", "#8b5cf6", "#d946ef", "#22c55e", "#6366f1"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => /^[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(p));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarCircle({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const uri = mediaUrl(avatarUrl);
  if (uri) {
    return <Image source={uri} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "rgba(245,245,242,0.06)" }} contentFit="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorForName(name), alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.38 }}>{initialsForName(name)}</Text>
    </View>
  );
}
