import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";

import { Appear } from "@/components/appear";
import { PhotoViewer } from "@/components/day-photos/photo-viewer";
import { Pressable } from "@/components/pressable";
import { byDay, dayHeading, getDayPhotos, type DayPhoto } from "@/data/day-photos";
import { todayLondon } from "@/data/sessions";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

const LABEL = { color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 } as const;
const DAYS_SHOWN = 4;

function Thumb({ photo, size, onPress }: { photo: DayPhoto; size: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={`Photo from ${dayHeading(photo.takenOn)}`} style={{ width: size, height: size, borderRadius: 14, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, ...GLASS_BORDER }}>
      {photo.url ? <Image source={{ uri: photo.url, cacheKey: photo.path }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} /> : null}
    </Pressable>
  );
}

/**
 * Owner, on the Profile tab: photos the trainers took of their dog. Today's
 * in a strip, "Today with Nelly & Nova", then earlier days as a timeline
 * by date. Tapping one opens it full screen, to swipe through that day.
 * Nothing shows until there's a photo. Kept 90 days.
 */
export function DayPhotos({ dogId, dogName }: { dogId: string; dogName: string }) {
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [viewing, setViewing] = useState<{ list: DayPhoto[]; start: number } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      getDayPhotos(dogId)
        .then((p) => live && setPhotos(p))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [dogId]),
  );

  if (photos.length === 0) return null;

  const today = todayLondon();
  const days = byDay(photos);
  const todays = days.find((d) => d.date === today)?.photos ?? [];
  const earlier = days.filter((d) => d.date !== today);
  const shown = showAll ? earlier : earlier.slice(0, DAYS_SHOWN);
  // Three across beside the timeline: the page's 20pt sides, the dot column and its gap (22), two 6pt gaps.
  const thumb = Math.floor((width - 40 - 22 - 12) / 3);

  function open(list: DayPhoto[], start: number) {
    hapticSelection();
    setViewing({ list, start });
  }

  return (
    <Appear style={{ marginTop: 28 }}>
      {todays.length > 0 && (
        <View style={{ marginBottom: earlier.length ? 22 : 0 }}>
          <Text style={[LABEL, { marginBottom: 10 }]}>Today with Nelly &amp; Nova</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {todays.map((p, i) => (
              <Thumb key={p.id} photo={p} size={132} onPress={() => open(todays, i)} />
            ))}
          </ScrollView>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
            {todays.length === 1 ? "A photo" : `${todays.length} photos`} of {dogName} from today.
          </Text>
        </View>
      )}

      {earlier.length > 0 && (
        <View style={{ gap: 16 }}>
          <Text style={LABEL}>{dogName}&apos;s days with us</Text>
          {shown.map((d) => (
            <View key={d.date} style={{ flexDirection: "row", gap: 12 }}>
              {/* The timeline: a dot per day on a thin line. */}
              <View style={{ width: 10, alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.foreground, marginTop: 5 }} />
                <View style={{ flex: 1, width: 1, backgroundColor: colors.border, marginTop: 4 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>
                  {dayHeading(d.date, today)} <Text style={{ color: colors.muted, fontWeight: "400" }}>· {d.photos.length === 1 ? "1 photo" : `${d.photos.length} photos`}</Text>
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {d.photos.slice(0, 6).map((p, i) => (
                    <Thumb key={p.id} photo={p} size={thumb} onPress={() => open(d.photos, i)} />
                  ))}
                </View>
                {d.photos.length > 6 && (
                  <Pressable onPress={() => open(d.photos, 6)} hitSlop={6} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>See all {d.photos.length}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          {earlier.length > DAYS_SHOWN && (
            <Pressable
              onPress={() => {
                animateListChange();
                setShowAll((s) => !s);
              }}
              hitSlop={6}
              style={{ alignSelf: "flex-start", marginLeft: 22 }}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" }}>{showAll ? "Show fewer days" : `Show ${earlier.length - DAYS_SHOWN} more days`}</Text>
            </Pressable>
          )}
        </View>
      )}

      <PhotoViewer photos={viewing?.list ?? []} start={viewing ? viewing.start : null} onClose={() => setViewing(null)} />
    </Appear>
  );
}
