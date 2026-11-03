import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { ActionTile, DetailCard } from "@/components/trainer/cards";
import { KIND_COLOR } from "@/components/trainer/entry-row";
import { LoadingState, Tag } from "@/components/ui";
import { conversationForAccount, formatShortDay, formatTime, getDogDetail, pluralDay, type DogDetail } from "@/data/trainer-schedule";
import { config } from "@/lib/config";
import { hapticError } from "@/lib/haptics";
import { colors } from "@/theme";

function ageFrom(dob: string | null): string | null {
  if (!dob) return null;
  const born = new Date(`${dob.slice(0, 10)}T12:00:00Z`);
  const now = new Date();
  let months = (now.getUTCFullYear() - born.getUTCFullYear()) * 12 + (now.getUTCMonth() - born.getUTCMonth());
  if (now.getUTCDate() < born.getUTCDate()) months--;
  if (months < 0) return null;
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  return `${Math.floor(months / 12)} years`;
}

function Line({ label, value, onPress, last }: { label: string; value: string; onPress?: () => void; last?: boolean }) {
  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: onPress ? colors.foreground : colors.foreground, fontSize: 15, marginTop: 2, textDecorationLine: onPress ? "underline" : "none" }}>{value}</Text>
      </View>
      {onPress && <Ionicons name="open-outline" size={15} color={colors.muted} />}
    </>
  );
  const style = { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border } as const;
  return onPress ? (
    <Pressable onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/**
 * Trainer: a dog, opened from Registers or a day on the calendar — modelled
 * on the Kanvas coach's student page. Who it is at a glance, anything
 * medical straight under it, then the owner (Message, Call, Email; the
 * number and email tappable too), its regular places and coming bookings,
 * the vet, and the full record on the website.
 */
export default function DogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dog, setDog] = useState<DogDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setDog(await getDogDetail(String(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this dog.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function openChat(accountId: string) {
    setChatBusy(true);
    try {
      const conversationId = await conversationForAccount(accountId);
      router.push({ pathname: "/conversation/[id]", params: { id: conversationId } });
    } catch {
      hapticError();
      setError("Couldn't open their chat.");
    } finally {
      setChatBusy(false);
    }
  }

  if (dog === undefined || dog === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Dog" />
        <LoadingState error={dog === null ? "This dog isn't on file any more." : error} />
      </View>
    );
  }

  const owner = dog.owner;
  const medical = [
    dog.medicalConditions ? { label: "Medical conditions", value: dog.medicalConditions } : null,
    dog.allergies ? { label: "Allergies", value: dog.allergies } : null,
  ].filter((x): x is { label: string; value: string } => !!x);
  const facts = [dog.breed, dog.sex ? dog.sex[0].toUpperCase() + dog.sex.slice(1) : null, ageFrom(dog.dateOfBirth)].filter(Boolean).join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={dog.name} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.foreground}
          />
        }
      >
        {error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}

        {/* Who this is, at a glance. */}
        <DetailCard index={0}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <AvatarCircle name={dog.name} avatarUrl={dog.photoUrl} size={72} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{dog.name}</Text>
              {!!facts && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{facts}</Text>}
            </View>
          </View>
          {(medical.length > 0 || !dog.waiverSignedAt) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {medical.length > 0 && <Tag label="Medical info flagged" tone={colors.danger} />}
              {!dog.waiverSignedAt && <Tag label="Waiver not signed" tone={colors.warning} />}
            </View>
          )}
        </DetailCard>

        {medical.length > 0 && (
          <DetailCard index={1} title="Medical info" icon="alert-circle" tone="danger">
            <View style={{ gap: 10 }}>
              {medical.map((m) => (
                <View key={m.label}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{m.label}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 2 }}>{m.value}</Text>
                </View>
              ))}
            </View>
          </DetailCard>
        )}

        {/* The reason a trainer opens this mid-day is usually to reach the owner. */}
        <DetailCard index={2} title="Owner" icon="person-outline">
          {owner ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <AvatarCircle name={owner.name || owner.email || "?"} avatarUrl={owner.avatarUrl} size={40} />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", flex: 1 }}>{owner.name || "Name not on file"}</Text>
              </View>
              {!!owner.phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${owner.phone!.replace(/\s+/g, "")}`)} hitSlop={4} style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, textDecorationLine: "underline" }}>{owner.phone}</Text>
                </Pressable>
              )}
              {!!owner.email && (
                <Pressable onPress={() => Linking.openURL(`mailto:${owner.email}`)} hitSlop={4} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, textDecorationLine: "underline" }}>{owner.email}</Text>
                </Pressable>
              )}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <ActionTile icon="chatbubble-ellipses" label="Message" onPress={() => openChat(owner.id)} busy={chatBusy} />
                <ActionTile icon="call" label="Call" onPress={() => owner.phone && Linking.openURL(`tel:${owner.phone.replace(/\s+/g, "")}`)} disabled={!owner.phone} />
                <ActionTile icon="mail" label="Email" onPress={() => owner.email && Linking.openURL(`mailto:${owner.email}`)} disabled={!owner.email} />
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>No owner on file.</Text>
          )}
        </DetailCard>

        <DetailCard index={3} title="Full Day Training" icon="paw-outline">
          {dog.places.length === 0 && dog.bookings.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>No regular place or bookings coming up.</Text>}
          {dog.places.map((p, i) => (
            <Line
              key={p.id}
              label={p.cadence === "alternating" ? "Every other week" : "Every week"}
              value={`${pluralDay(p.day)}, from ${formatShortDay(p.startOn)}${p.endOn ? ` until ${formatShortDay(p.endOn)}` : ""}`}
              last={i === dog.places.length - 1 && dog.bookings.length === 0}
            />
          ))}
          {dog.bookings.map((b, i) => (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: i === dog.bookings.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>{formatShortDay(b.date)}</Text>
              <Tag
                label={b.kind === "one_to_one" ? `1-1${b.startTime ? ` · ${formatTime(b.startTime)}` : ""}` : "One-off"}
                tone={b.kind === "one_to_one" ? KIND_COLOR.one_to_one : KIND_COLOR.full_day_one_off}
              />
            </View>
          ))}
        </DetailCard>

        <DetailCard index={4} title="Skills and levels" icon="ribbon-outline">
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>Tick off the skills {dog.name} has learnt. Their owner sees the levels in the app.</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/dog-skills/[id]", params: { id: dog.id, name: dog.name } })}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingVertical: 4 }}
          >
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", flex: 1 }}>Open skills</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        </DetailCard>

        {(dog.vetName || dog.vetPhone || dog.notes) && (
          <DetailCard index={5} title="Vet and notes" icon="medkit-outline">
            {!!dog.vetName && <Line label="Vet" value={dog.vetName} last={!dog.vetPhone && !dog.notes} />}
            {!!dog.vetPhone && <Line label="Vet's number" value={dog.vetPhone} onPress={() => Linking.openURL(`tel:${dog.vetPhone!.replace(/\s+/g, "")}`)} last={!dog.notes} />}
            {!!dog.notes && <Line label="Notes" value={dog.notes} last />}
          </DetailCard>
        )}

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(new URL(`/admin/dogs/${dog.id}`, config.siteUrl).toString())}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, paddingVertical: 10 }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Full record on the website</Text>
          <Ionicons name="open-outline" size={14} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
