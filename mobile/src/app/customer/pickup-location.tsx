import { useState } from "react";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { RouteMap } from "@/components/walks/RouteMap";
import { setPickupLocation, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Where this account is collected from for Walk & Train. The address is
 * typed by hand (no geocoding key to look it up automatically); "Use my
 * current location" only fills in the coordinates, which is what the
 * coach's route planner actually needs.
 */
export default function PickupLocationScreen() {
  const router = useRouter();
  const session = useSession();

  const [address, setAddress] = useState(session?.pickupLocation?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    session?.pickupLocation ? { lat: session.pickupLocation.lat, lng: session.pickupLocation.lng } : null
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!coords) return;
    setSaving(true);
    await setPickupLocation({ address: address.trim(), lat: coords.lat, lng: coords.lng });
    setSaving(false);
    router.back();
  }

  return (
    <View style={styles.screen}>
      <RouteMap route={coords ? [coords] : []} height={220} />

      <View style={styles.body}>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 12 High Street, Tynemouth"
          placeholderTextColor={colors.paperDim}
        />

        <Pressable style={styles.locateRow} onPress={useCurrentLocation} disabled={locating}>
          <Ionicons name="locate-outline" size={18} color={colors.accent} />
          <Text style={styles.locateText}>
            {locating ? "Getting your location…" : coords ? "Update pin to my current location" : "Use my current location"}
          </Text>
          {locating && <ActivityIndicator size="small" color={colors.accent} />}
        </Pressable>

        <Text style={styles.hint}>
          This is where the coach collects your dog from for Walk &amp; Train. The pin is what the route
          planner uses — the address is just for your own reference.
        </Text>

        <Button title={saving ? "Saving…" : "Save"} onPress={save} loading={saving} disabled={!coords} />
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
  body: {
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    gap: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(245,242,234,0.9)",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.paper,
  },
  locateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locateText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.paperDim,
  },
});
