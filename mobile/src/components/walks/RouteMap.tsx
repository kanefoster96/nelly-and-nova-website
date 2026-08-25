import { useEffect, useRef } from "react";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { StyleSheet, View } from "react-native";
import type { LatLng } from "@/lib/walks";
import { colors } from "@/theme/colors";

// Tynemouth — the same sensible default the website's weather reminder uses,
// shown before a route/live location exists.
const FALLBACK_REGION: Region = { latitude: 55.017, longitude: -1.423, latitudeDelta: 0.02, longitudeDelta: 0.02 };

type RouteMapProps = {
  route: LatLng[];
  live?: LatLng | null;
  height?: number;
};

/** Draws a walk's route (and, while tracking, the live position) on a map. */
export function RouteMap({ route, live, height = 220 }: RouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const coordinates = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const livePoint = live ? { latitude: live.lat, longitude: live.lng } : null;

  useEffect(() => {
    const all = livePoint ? [...coordinates, livePoint] : coordinates;
    if (all.length === 0) return;
    if (all.length === 1) {
      mapRef.current?.animateToRegion({ ...all[0], latitudeDelta: 0.01, longitudeDelta: 0.01 }, 300);
      return;
    }
    mapRef.current?.fitToCoordinates(all, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
    // Re-fit only when the point count changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates.length, livePoint?.latitude, livePoint?.longitude]);

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={coordinates[0] ? { ...coordinates[0], latitudeDelta: 0.01, longitudeDelta: 0.01 } : FALLBACK_REGION}
      >
        {coordinates.length > 1 && <Polyline coordinates={coordinates} strokeColor={colors.accent} strokeWidth={4} />}
        {coordinates.length > 0 && <Marker coordinate={coordinates[0]} pinColor="green" title="Start" />}
        {!live && coordinates.length > 1 && (
          <Marker coordinate={coordinates[coordinates.length - 1]} pinColor="red" title="Finish" />
        )}
        {livePoint && <Marker coordinate={livePoint} title="You" />}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.fieldBg,
  },
});
