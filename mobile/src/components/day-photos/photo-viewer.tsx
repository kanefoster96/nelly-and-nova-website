import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Modal, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass-button";
import { dayHeading, type DayPhoto } from "@/data/day-photos";
import { hapticSelection } from "@/lib/haptics";

/**
 * Photos from a dog's day, full screen on black: swipe between them, the
 * day and "3 of 8" underneath, and a round glass close button. Used by the
 * owner's Profile tab and the trainer's "Today's photos".
 */
export function PhotoViewer({ photos, start, onClose }: { photos: DayPhoto[]; start: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start ?? 0);
  const open = start !== null && photos.length > 0;
  const current = photos[Math.min(index, photos.length - 1)];

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const n = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (n !== index) {
      hapticSelection();
      setIndex(n);
    }
  }

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} onShow={() => setIndex(start ?? 0)}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {open && (
          <FlatList
            data={photos}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(start ?? 0, photos.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item }) => (
              <View style={{ width, height, justifyContent: "center" }}>
                {item.url ? (
                  <Image source={{ uri: item.url, cacheKey: item.path }} style={{ width, height }} contentFit="contain" transition={150} accessibilityLabel={`Photo from ${dayHeading(item.takenOn)}`} />
                ) : (
                  <Text style={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}>This photo couldn&apos;t be loaded.</Text>
                )}
              </View>
            )}
          />
        )}
        <View style={{ position: "absolute", top: insets.top + 8, right: 16 }}>
          <GlassButton onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color="#f5f2ea" />
          </GlassButton>
        </View>
        {current && (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 16, alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(18,18,18,0.8)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ color: "#f5f2ea", fontSize: 13, fontWeight: "600" }}>
                {dayHeading(current.takenOn)}
                {photos.length > 1 ? ` · ${Math.min(index, photos.length - 1) + 1} of ${photos.length}` : ""}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
