import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { DogProgressCard } from "@/components/homework/dog-progress";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { ActionTile, BigButton, DetailCard } from "@/components/trainer/cards";
import { KIND_COLOR } from "@/components/trainer/entry-row";
import { LoadingState, Tag } from "@/components/ui";
import { getDogProgress, HOMEWORK_TARGET_DAYS, type DogProgress } from "@/data/reports";
import { sessionLabel } from "@/data/sessions";
import { DOCUMENT_LABEL, documentLink, getTrainerDog, type TrainerDog } from "@/data/trainer-dog";
import { drillCount, getDogCards, type TrainerCard } from "@/data/trainer-reports";
import { conversationForAccount, formatShortDay, pluralDay } from "@/data/trainer-schedule";
import { ageFrom } from "@/data/dog-profile";
import { callNumber, openDirections, openWhatsApp, sendEmail } from "@/lib/contact";
import { hapticError } from "@/lib/haptics";
import { colors } from "@/theme";

function Line({ label, value, onPress, icon = "open-outline", last }: { label: string; value: string; onPress?: () => void; icon?: React.ComponentProps<typeof Ionicons>["name"]; last?: boolean }) {
  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.foreground, fontSize: 15, marginTop: 2, textDecorationLine: onPress ? "underline" : "none" }}>{value}</Text>
      </View>
      {onPress && <Ionicons name={icon} size={16} color={colors.muted} />}
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

const yesNo = (v: boolean | null) => (v === null ? "Not answered" : v ? "Yes" : "No");

function signedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Trainer: a dog, opened from Today, Registers or a day — the whole record,
 * in the app (it opened the website before), laid out like the Kanvas
 * coach's student page. Who it is with any medical flags, the owner
 * (Message, Call, WhatsApp, Email; their address with directions and
 * their emergency contacts), health and vet, what the owner's told us
 * about them, the signed consent & waiver, documents, their regular day
 * and coming sessions, skills, homework (Attach homework, from the drill
 * library) and report cards (Write report card).
 */
export default function DogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dog, setDog] = useState<TrainerDog | null | undefined>(undefined);
  const [progress, setProgress] = useState<DogProgress | null>(null);
  const [cards, setCards] = useState<TrainerCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [d, p, c] = await Promise.all([getTrainerDog(String(id)), getDogProgress(String(id)).catch(() => null), getDogCards(String(id)).catch(() => [] as TrainerCard[])]);
      setDog(d);
      setProgress(p);
      setCards(c);
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

  async function openDocument(path: string) {
    try {
      // A PDF or photo in private storage: a short-lived link, in the browser.
      await WebBrowser.openBrowserAsync(await documentLink(path));
    } catch {
      hapticError();
      setError("Couldn't open that file.");
    }
  }

  if (!dog) {
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
  const facts = [dog.breed, dog.sex, ageFrom(dog.dateOfBirth)].filter(Boolean).join(" · ");
  const latestHomework = cards?.find((c) => c.status === "published" && drillCount(c.homework) > 0) ?? null;
  const draft = cards?.find((c) => c.status === "draft") ?? null;
  const latestCard = cards?.[0] ?? null;

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
              {!!owner?.name && <Text style={{ color: colors.muted, fontSize: 14 }}>{owner.name}</Text>}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {medical.length > 0 && <Tag label="Medical info flagged" tone={colors.danger} />}
            {dog.waiverSignedAt ? <Tag label="Registered" tone={colors.success} /> : <Tag label="Not registered: waiver not signed" tone={colors.warning} />}
            {dog.vaccinationsConfirmed === false && <Tag label="Vaccinations not confirmed" tone={colors.warning} />}
          </View>
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
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{owner.name || "Name not on file"}</Text>
                  {!!owner.phone && <Text style={{ color: colors.muted, fontSize: 13 }}>{owner.phone}</Text>}
                  {!!owner.email && <Text style={{ color: colors.muted, fontSize: 13 }}>{owner.email}</Text>}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <ActionTile icon="chatbubble-ellipses" label="Message" onPress={() => openChat(owner.id)} busy={chatBusy} />
                <ActionTile icon="call" label="Call" onPress={() => owner.phone && callNumber(owner.phone)} disabled={!owner.phone} />
                <ActionTile icon="logo-whatsapp" label="WhatsApp" onPress={() => owner.phone && openWhatsApp(owner.phone)} disabled={!owner.phone} />
                <ActionTile icon="mail" label="Email" onPress={() => owner.email && sendEmail(owner.email)} disabled={!owner.email} />
              </View>
              <View style={{ marginTop: 10 }}>
                {owner.address ? (
                  <Line label="Pick-up address" value={owner.address} icon="navigate-outline" onPress={() => openDirections(owner.address!)} last={owner.emergencyContacts.length === 0} />
                ) : (
                  <Line label="Pick-up address" value="Not on file" last={owner.emergencyContacts.length === 0} />
                )}
                {owner.address && (
                  <Pressable
                    onPress={() => openDirections(owner.address!)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderBottomWidth: owner.emergencyContacts.length ? 1 : 0, borderBottomColor: colors.border }}
                  >
                    <Ionicons name="map-outline" size={16} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>Open in Maps</Text>
                  </Pressable>
                )}
                {owner.emergencyContacts.map((c, i) => (
                  <Line key={i} label={`Emergency contact ${i + 1}`} value={c} last={i === owner.emergencyContacts.length - 1} />
                ))}
              </View>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>No owner on file.</Text>
          )}
        </DetailCard>

        <DetailCard index={3} title="Health and vet" icon="medkit-outline">
          <Line label="Vaccinations up to date" value={yesNo(dog.vaccinationsConfirmed)} />
          <Line label="Kennel cough vaccination" value={yesNo(dog.kennelCough)} />
          <Line label="Microchip" value={dog.microchip ?? "Not on file"} />
          <Line label="Vet" value={dog.vetName ?? "Not on file"} last={!dog.vetPhone && !dog.vetAddress} />
          {!!dog.vetPhone && <Line label="Vet's number" value={dog.vetPhone} icon="call-outline" onPress={() => callNumber(dog.vetPhone!)} last={!dog.vetAddress} />}
          {!!dog.vetAddress && <Line label="Vet's address" value={dog.vetAddress} icon="navigate-outline" onPress={() => openDirections(dog.vetAddress!)} last />}
        </DetailCard>

        <DetailCard index={4} title="Behaviour and notes" icon="paw-outline">
          <Text style={{ color: dog.notes ? colors.foreground : colors.muted, fontSize: 14, lineHeight: 20 }}>{dog.notes ?? "Nothing from the owner yet."}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>What the owner told us on {dog.name}&apos;s record.</Text>
        </DetailCard>

        <DetailCard index={5} title="Consent & waiver" icon="document-text-outline">
          {dog.waiver ? (
            <>
              <Text style={{ color: colors.success, fontSize: 15, fontWeight: "600" }}>
                Signed by {dog.waiver.signedName || "the owner"} on {signedOn(dog.waiver.signedAt)}
              </Text>
              {dog.waiver.signatureUrl && (
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 8, marginTop: 10 }}>
                  <Image source={dog.waiver.signatureUrl} style={{ width: "100%", height: 70 }} contentFit="contain" accessibilityLabel={`Signature of ${dog.waiver.signedName}`} />
                </View>
              )}
            </>
          ) : (
            <Text style={{ color: colors.warning, fontSize: 14 }}>Not signed yet. It&apos;s needed before {dog.name}&apos;s first session.</Text>
          )}
          {dog.documents.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {dog.documents.map((d, i) => (
                <Line key={d.id} label={`${DOCUMENT_LABEL[d.kind] ?? "Document"} · ${formatShortDay(d.createdAt.slice(0, 10))}`} value={d.fileName} onPress={() => openDocument(d.path)} last={i === dog.documents.length - 1} />
              ))}
            </View>
          )}
        </DetailCard>

        <DetailCard index={6} title="Full Day Training" icon="calendar-outline">
          {dog.places.length === 0 && dog.upcoming.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>No regular day or sessions coming up.</Text>}
          {dog.places.map((p) => (
            <Line
              key={p.id}
              label={p.cadence === "alternating" ? "Regular day · every other week" : "Regular day · every week"}
              value={`${pluralDay(p.day)}, from ${formatShortDay(p.startOn)}${p.endOn ? ` until ${formatShortDay(p.endOn)}` : ""}`}
              last={dog.upcoming.length === 0}
            />
          ))}
          {dog.upcoming.map((s, i) => (
            <View
              key={`${s.date}-${s.bookingId ?? s.placementId}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: i === dog.upcoming.length - 1 ? 0 : 1, borderBottomColor: colors.border, opacity: s.cancelled ? 0.5 : 1 }}
            >
              <Pressable onPress={() => router.push({ pathname: "/day/[date]", params: { date: s.date } })} style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 15, textDecorationLine: s.cancelled ? "line-through" : "none" }}>{formatShortDay(s.date)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{sessionLabel(s)}</Text>
              </Pressable>
              {s.cancelled && <Tag label="Cancelled" />}
              {!s.cancelled && s.kind !== "full_day" && <Tag label={s.kind === "one_to_one" ? "1-1" : "One-off"} tone={s.kind === "one_to_one" ? KIND_COLOR.one_to_one : KIND_COLOR.full_day_one_off} />}
              {(s.paymentStatus === "unpaid" || s.paymentStatus === "failed") && <Tag label="Unpaid" tone={colors.warning} />}
            </View>
          ))}
        </DetailCard>

        {/* Skills, as the owner sees them; ticked off from Skills. */}
        <View style={{ marginTop: 14 }}>
          {progress ? <DogProgressCard progress={progress} dogName={dog.name} /> : null}
          <BigButton icon="ribbon-outline" label="Update skills" variant="outline" onPress={() => router.push({ pathname: "/dog-skills/[id]", params: { id: dog.id, name: dog.name } })} style={{ marginTop: 10 }} />
        </View>

        <DetailCard index={7} title="Homework" icon="school-outline">
          {latestHomework ? (
            <>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{latestHomework.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                Set {formatShortDay(latestHomework.date)} · practised {Math.min(latestHomework.practisedDays, HOMEWORK_TARGET_DAYS)} of {HOMEWORK_TARGET_DAYS} days
              </Text>
              <View style={{ marginTop: 8, gap: 4 }}>
                {latestHomework.homework.map((c) => (
                  <Text key={c.name} style={{ color: colors.foreground, fontSize: 14 }}>
                    <Text style={{ fontWeight: "700" }}>{c.name}: </Text>
                    {c.drills.map((d) => d.name).join(", ")}
                  </Text>
                ))}
              </View>
              <Pressable
                onPress={() => router.push({ pathname: "/report-card", params: { dogId: dog.id, cardId: latestHomework.id, focus: "homework" } })}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" }}>Change this homework</Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>No homework set yet.</Text>
          )}
          <BigButton icon="add" label="Attach homework" onPress={() => router.push({ pathname: "/report-card", params: { dogId: dog.id, focus: "homework" } })} style={{ marginTop: 8 }} />
        </DetailCard>

        <DetailCard index={8} title="Report cards" icon="clipboard-outline">
          {latestCard ? (
            <Pressable onPress={() => router.push({ pathname: "/report-card", params: { dogId: dog.id, cardId: latestCard.id } })} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
                    {latestCard.title}
                  </Text>
                  <Tag label={latestCard.status === "draft" ? "Draft" : "Sent"} tone={latestCard.status === "draft" ? colors.warning : colors.success} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{formatShortDay(latestCard.date)}</Text>
                {!!latestCard.summary && (
                  <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 6, lineHeight: 20 }} numberOfLines={3}>
                    {latestCard.summary}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 14 }}>No report cards yet.</Text>
          )}
          <BigButton
            icon="create-outline"
            label={draft ? "Carry on with the draft" : "Write report card"}
            variant="outline"
            onPress={() => router.push({ pathname: "/report-card", params: draft ? { dogId: dog.id, cardId: draft.id } : { dogId: dog.id } })}
            style={{ marginTop: 12 }}
          />
        </DetailCard>
      </ScrollView>
    </View>
  );
}
