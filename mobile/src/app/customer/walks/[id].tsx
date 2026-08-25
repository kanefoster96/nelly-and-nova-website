import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Button } from "@/components/Button";
import { RouteMap } from "@/components/walks/RouteMap";
import { activeDog, useSession } from "@/lib/session";
import { getWalkDetail, shareWalkToCommunity, type WalkDetail } from "@/lib/walks";
import { colors } from "@/theme/colors";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDistance(meters: number | null): string {
  if (!meters) return "—";
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
}

function formatPace(meters: number | null, seconds: number | null): string {
  if (!meters || !seconds || meters < 50) return "—";
  const minsPerKm = seconds / 60 / (meters / 1000);
  const m = Math.floor(minsPerKm);
  const s = Math.round((minsPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function WalkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const dog = activeDog(session);
  const { width } = useWindowDimensions();

  const [detail, setDetail] = useState<WalkDetail | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getWalkDetail(id).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function share() {
    if (!detail || !dog) return;
    setSharing(true);
    const { error } = await shareWalkToCommunity(
      detail.walk,
      dog.name,
      detail.photos.map((p) => p.url)
    );
    setSharing(false);
    if (!error) {
      setDetail({ ...detail, walk: { ...detail.walk, sharedPostId: "shared" } });
    }
  }

  if (detail === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Walk not found.</Text>
      </View>
    );
  }

  const { walk, route, photos, homeworkDone } = detail;
  const photoSize = width / 3;

  return (
    <ScrollView style={styles.screen}>
      <RouteMap route={route} height={260} />

      <View style={styles.body}>
        <Text style={styles.date}>{formatDate(walk.startedAt)}</Text>
        {walk.locationName ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.paperDim} />
            <Text style={styles.locationText}>{walk.locationName}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Stat label="Duration" value={formatDuration(walk.durationSeconds)} />
          <Stat label="Distance" value={formatDistance(walk.distanceMeters)} />
          <Stat label="Pace" value={formatPace(walk.distanceMeters, walk.durationSeconds)} />
        </View>

        {walk.notes ? <Text style={styles.notes}>{walk.notes}</Text> : null}

        {homeworkDone.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Homework practiced</Text>
            {homeworkDone.map((h) => (
              <View key={h.id} style={styles.homeworkRow}>
                <Ionicons name="checkbox" size={18} color={colors.accent} />
                <Text style={styles.homeworkText}>{h.drillName}</Text>
              </View>
            ))}
          </View>
        )}

        {!walk.sharedPostId && (
          <Button title={sharing ? "Sharing…" : "Share to community"} onPress={share} loading={sharing} />
        )}
        {walk.sharedPostId && (
          <View style={styles.sharedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.sharedBadgeText}>Shared to the community</Text>
          </View>
        )}
      </View>

      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={{ width: photoSize, height: photoSize }}
              contentFit="cover"
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  emptyText: {
    fontSize: 14,
    color: colors.paperDim,
  },
  body: {
    paddingHorizontal: H_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  date: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.paper,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -8,
  },
  locationText: {
    fontSize: 13,
    color: colors.paperDim,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingVertical: 16,
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.paper,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.paperDim,
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(245,242,234,0.9)",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  homeworkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  homeworkText: {
    fontSize: 14,
    color: colors.paper,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  sharedBadgeText: {
    fontSize: 13,
    color: colors.paperDim,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
