import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import {
  getTodayCollections,
  moveStop,
  startNextPickup,
  type CollectionStop,
  type PickupStatus,
} from "@/lib/collections";
import { signOut } from "@/lib/session";
import { colors } from "@/theme/colors";

const STATUS_LABEL: Record<PickupStatus, string> = {
  pending: "Pending",
  notified: "En route",
  collected: "Collected",
};

const STATUS_COLOR: Record<PickupStatus, string> = {
  pending: colors.paperDim,
  notified: colors.accent,
  collected: "#4ade80",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The coach's route for today's Walk & Train collections. First real piece
 * of the admin app — everything else is still the placeholder described
 * below the list. Not a live-location tracker: tapping "Start next pickup"
 * marks the current stop collected and sends the next account an
 * estimated ETA (see lib/collections.ts for how that's computed).
 */
export default function AdminHomeScreen() {
  const [stops, setStops] = useState<CollectionStop[] | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    getTodayCollections().then(setStops);
  }, []);

  useEffect(load, [load]);

  async function onStartNext() {
    if (!stops) return;
    setStarting(true);
    await startNextPickup(stops);
    await load();
    setStarting(false);
  }

  async function onMove(sessionId: string, direction: "up" | "down") {
    if (!stops) return;
    const next = await moveStop(stops, sessionId, direction);
    setStops(next);
  }

  const hasPending = stops?.some((s) => s.pickupStatus === "pending") ?? false;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <FlatList
        data={stops ?? []}
        keyExtractor={(s) => s.sessionId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Today&apos;s collections</Text>
            <Button
              title={starting ? "Sending…" : "Start next pickup"}
              onPress={onStartNext}
              loading={starting}
              disabled={!hasPending}
            />
          </View>
        }
        renderItem={({ item, index }) => (
          <StopRow
            stop={item}
            order={index + 1}
            canMoveUp={index > 0}
            canMoveDown={index < (stops?.length ?? 0) - 1}
            onMoveUp={() => onMove(item.sessionId, "up")}
            onMoveDown={() => onMove(item.sessionId, "down")}
          />
        )}
        ListEmptyComponent={
          stops === null ? (
            <ActivityIndicator style={styles.loading} color={colors.accent} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No Walk &amp; Train collections scheduled for today.</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              The rest of the admin/trainer app hasn&apos;t been built yet — this collection route planner is
              the first piece.
            </Text>
            <Button title="Log out" variant="ghost" onPress={() => void signOut()} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StopRow({
  stop,
  order,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  stop: CollectionStop;
  order: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.orderBadge}>{order}</Text>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.dogName}>{stop.dogName || "Unknown dog"}</Text>
          <Text style={[styles.statusText, { color: STATUS_COLOR[stop.pickupStatus] }]}>
            {STATUS_LABEL[stop.pickupStatus]}
          </Text>
        </View>
        <Text style={styles.ownerName}>
          {stop.ownerName} · {formatTime(stop.scheduledAt)}
        </Text>
        {stop.pickupLocation ? (
          <Text style={styles.address} numberOfLines={1}>
            📍 {stop.pickupLocation.address || `${stop.pickupLocation.lat.toFixed(4)}, ${stop.pickupLocation.lng.toFixed(4)}`}
          </Text>
        ) : (
          <Text style={styles.addressMissing}>No pickup location set</Text>
        )}
      </View>
      <View style={styles.moveCol}>
        <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6}>
          <Ionicons name="chevron-up" size={18} color={canMoveUp ? colors.paper : colors.border} />
        </Pressable>
        <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6}>
          <Ionicons name="chevron-down" size={18} color={canMoveDown ? colors.paper : colors.border} />
        </Pressable>
      </View>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    padding: H_PADDING,
    gap: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.paper,
  },
  loading: {
    marginTop: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderBadge: {
    width: 24,
    fontSize: 14,
    fontWeight: "700",
    color: colors.paperDim,
    textAlign: "center",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  dogName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.paper,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ownerName: {
    fontSize: 12,
    color: colors.paperDim,
  },
  address: {
    fontSize: 12,
    color: "rgba(245,242,234,0.8)",
  },
  addressMissing: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.paperDim,
  },
  moveCol: {
    gap: 4,
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
  footer: {
    padding: H_PADDING,
    gap: 12,
    alignItems: "center",
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.paperDim,
    textAlign: "center",
  },
});
