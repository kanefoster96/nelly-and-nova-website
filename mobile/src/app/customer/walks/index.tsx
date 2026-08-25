import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { activeDog, useSession } from "@/lib/session";
import { getWalks, type Walk } from "@/lib/walks";
import { colors } from "@/theme/colors";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function WalksListScreen() {
  const router = useRouter();
  const session = useSession();
  const dog = activeDog(session);
  const [walks, setWalks] = useState<Walk[] | null>(null);

  const load = useCallback(() => {
    if (!dog) return;
    getWalks(dog.id).then(setWalks);
    // `dog` is a fresh object every render — key off its id instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  useEffect(load, [load]);
  // Refresh whenever this screen regains focus (e.g. after saving a walk).
  useFocusEffect(load);

  if (!dog) return null;

  return (
    <FlatList
      style={styles.screen}
      data={walks ?? []}
      keyExtractor={(w) => w.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Button title="Start a walk" onPress={() => router.push("/customer/walks/track")} />
        </View>
      }
      renderItem={({ item }) => <WalkRow walk={item} />}
      ListEmptyComponent={
        walks !== null ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No walks logged yet for {dog.name} — start one above.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

function WalkRow({ walk }: { walk: Walk }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={walk.kind === "training" ? "school-outline" : "paw-outline"}
          size={20}
          color={colors.accent}
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowKind}>{walk.kind === "training" ? "Training" : "Walk"}</Text>
          <Text style={styles.rowMeta}>
            {formatDate(walk.startedAt)}
            {walk.durationSeconds ? ` · ${formatDuration(walk.durationSeconds)}` : ""}
          </Text>
        </View>
        {walk.notes ? (
          <Text style={styles.rowNotes} numberOfLines={2}>
            {walk.notes}
          </Text>
        ) : null}
        {walk.sharedPostId ? (
          <View style={styles.sharedBadge}>
            <Ionicons name="people-outline" size={12} color={colors.paperDim} />
            <Text style={styles.sharedBadgeText}>Shared to community</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    padding: H_PADDING,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: H_PADDING,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fieldBg,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  rowKind: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.paper,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.paperDim,
  },
  rowNotes: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.85)",
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  sharedBadgeText: {
    fontSize: 11,
    color: colors.paperDim,
  },
  empty: {
    paddingHorizontal: 32,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
    textAlign: "center",
  },
});
