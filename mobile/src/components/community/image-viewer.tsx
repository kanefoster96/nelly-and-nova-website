import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/pressable";
import { hapticError } from "@/lib/haptics";

/** Who posted the photo and what they said with it — shown under the picture. */
export type ImageCaption = { title: string; subtitle?: string | null; body?: string | null };

/**
 * Photos on their own, as the Kanvas app does it: full screen on black,
 * swipe between one post's photos with a "2 of 4" counter, pinch to zoom
 * (iOS), the poster and their words along the bottom, and a tap on the
 * picture to clear all that away. The ⋯ menu shares the photo. (Kanvas's
 * "Save to Photos" needs expo-media-library, which this build doesn't
 * ship — left out so the change goes over the air.) Mount it only while open.
 */
export function ImageViewer({
  images,
  initialIndex = 0,
  caption,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  caption?: ImageCaption;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(initialIndex, images.length - 1));
  const [chrome, setChrome] = useState(true);
  const listRef = useRef<FlatList<string>>(null);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  async function share() {
    try {
      const url = images[index];
      await Share.share({ url, message: url });
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't share", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function openMenu() {
    Alert.alert("Photo", undefined, [
      { text: "Share…", onPress: share },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(uri, i) => `${i}:${uri}`}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            // iOS pinch-to-zoom comes free with a ScrollView; Android gets a
            // plain full-screen view.
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              contentContainerStyle={{ width, height, alignItems: "center", justifyContent: "center" }}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Pressable backdrop onPress={() => setChrome((v) => !v)}>
                <Image source={item} style={{ width, height }} contentFit="contain" />
              </Pressable>
            </ScrollView>
          )}
        />

        {chrome && (
          <>
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                paddingTop: insets.top + 8,
                paddingBottom: 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(0,0,0,0.45)",
              }}
            >
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={iconButton}>
                <Ionicons name="close" size={26} color="#fff" />
              </Pressable>
              {images.length > 1 && (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                  {index + 1} of {images.length}
                </Text>
              )}
              <Pressable onPress={openMenu} hitSlop={12} accessibilityLabel="Photo options" style={iconButton}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
              </Pressable>
            </View>

            {caption && (
              <View
                pointerEvents="box-none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: insets.bottom + 20,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  gap: 4,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>{caption.title}</Text>
                {!!caption.subtitle && <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{caption.subtitle}</Text>}
                {!!caption.body && (
                  <Text numberOfLines={4} style={{ color: "#fff", fontSize: 15, lineHeight: 21, marginTop: 6 }}>
                    {caption.body}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const iconButton = { width: 40, height: 40, alignItems: "center", justifyContent: "center" } as const;
