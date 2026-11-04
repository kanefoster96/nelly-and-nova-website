import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { DogProgressCard } from "@/components/homework/dog-progress";
import { DogSwitcher } from "@/components/dog-switcher";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { RequestCard } from "@/components/sessions/request-card";
import { OptionPill, SessionSheet, type SheetMode } from "@/components/sessions/session-sheet";
import { CARD, LoadingState, Tag } from "@/components/ui";
import { ageFrom, getHomeworkDays, getMyDogDetails, getTrainerHighlights, type DogDetails } from "@/data/dog-profile";
import { formatDate } from "@/data/inbox";
import { getDogProgress, getReportCards, HOMEWORK_TARGET_DAYS, type DogProgress, type ReportCard } from "@/data/reports";
import {
  getDogSessions,
  getPlacements,
  hasMembership,
  listRequests,
  longDate,
  plural,
  plusDays,
  sessionLabel,
  todayLondon,
  type DogSession,
  type Placement,
  type SessionRequest,
} from "@/data/sessions";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { mediaUrl } from "@/lib/media";
import { colors, GLASS_BORDER } from "@/theme";

type DogPage = {
  dog: DogDetails;
  sessions: DogSession[];
  placements: Placement[];
  progress: DogProgress | null;
  highlights: { strength: string | null; toImprove: string | null; date: string | null };
  homework: { total: number; thisWeek: number };
  latestCard: ReportCard | null;
  /** Homework not yet done on 3 days. */
  toDo: number;
};

const BOX = { marginTop: 16, width: "100%", borderRadius: 16, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 16 } as const;
const BOX_LABEL = { color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 } as const;

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ width: 96, alignItems: "center" }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function serviceLine(placements: Placement[], sessions: DogSession[]): string {
  if (placements.length) {
    return `Full Day Training · ${placements.map((p) => `${plural(p.day)}, ${p.cadence === "alternating" ? "every other week" : "every week"}`).join(" · ")}`;
  }
  if (sessions.some((s) => s.kind === "one_to_one")) return "1-1 Training";
  if (sessions.some((s) => s.kind === "full_day_one_off")) return "Full Day Training · one-off days";
  return "No regular day yet";
}

/** Kanvas's register-dancer card, for a dog without its registration (waiver) done. */
function RegisterDogCard({ dog }: { dog: DogDetails }) {
  const router = useRouter();
  // The consent & waiver form, in the app (app/(app)/register/[dogId].tsx).
  const go = () => router.push({ pathname: "/register/[dogId]", params: { dogId: dog.id } } as never);
  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      style={({ pressed }) => ({ borderWidth: 1, borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 16, padding: 20, marginBottom: 20, opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Action needed</Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 8 }}>Register {dog.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Their health details, vet and waiver, before their first session.</Text>
      <View style={{ marginTop: 14, alignSelf: "flex-start", backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
        <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: "700" }}>Register {dog.name}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Member: Profile — the Kanvas Class Pass, for a dog, minus the QR code.
 * The dog's photo, name, breed and age; their service and regular day; the
 * next session; stats (sessions so far, homework days in all and this
 * week); the trainer's biggest strength and area to improve; the latest
 * report card; Skills & levels; then everything to manage underneath
 * (cancel, a replacement day, an extra session, a regular day, a switch)
 * through the one sheet the Schedule tab uses too, and their requests.
 * Several dogs: a switcher at the top.
 */
export default function DogProfileScreen() {
  const { session, isTrainer } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const barInset = useBarInset();
  const barScroll = useBarScroll();
  const topInset = useTopBarInset();
  const [pages, setPages] = useState<DogPage[] | null>(null);
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [member, setMember] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ mode: SheetMode } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const today = todayLondon();
      const [dogs, bundle, reqs, m] = await Promise.all([
        getMyDogDetails(userId),
        getReportCards().catch(() => null),
        listRequests().catch(() => [] as SessionRequest[]),
        hasMembership(userId).catch(() => false),
      ]);
      const next = await Promise.all(
        dogs.map(async (dog): Promise<DogPage> => {
          const [sessions, placements, progress, highlights, homework] = await Promise.all([
            getDogSessions(dog.id, plusDays(today, -1095), plusDays(today, 100)).catch(() => [] as DogSession[]),
            getPlacements(dog.id).catch(() => [] as Placement[]),
            getDogProgress(dog.id).catch(() => null),
            getTrainerHighlights(dog.id),
            getHomeworkDays(dog.id),
          ]);
          const toDo = (bundle?.cards ?? []).filter(
            (c) => c.dogId === dog.id && c.homework.some((cat) => cat.drills.length > 0) && (bundle?.progress[c.id]?.length ?? 0) < HOMEWORK_TARGET_DAYS,
          ).length;
          return { dog, sessions, placements, progress, highlights, homework, latestCard: bundle?.cards.find((c) => c.dogId === dog.id) ?? null, toDo };
        }),
      );
      setPages(next);
      setRequests(reqs);
      setMember(m);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your dog's profile.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (isTrainer) return <Redirect href="/community" />;
  if (!pages) return <LoadingState error={error} />;

  const page = pages.find((p) => p.dog.id === selected) ?? pages[0] ?? null;
  const today = todayLondon();

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
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
      <PageTitle title="Profile" style={{ marginBottom: 16 }} />
      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
      {done && (
        <View style={{ borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <Text style={{ color: colors.success, fontSize: 13 }}>{done}</Text>
        </View>
      )}

      {/* The set-up checklist (meet & greet → Direct Debit → account → register → training day), until it's all done. */}
      <View style={{ marginBottom: 20 }}>
        <OnboardingChecklist onChanged={load} />
      </View>

      {!page ? (
        <View style={[CARD, { alignItems: "center", paddingVertical: 28 }]}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>No dog on your account yet</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center" }}>Register your dog and their profile appears here.</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/register/[dogId]", params: { dogId: "new" } } as never)}
            style={{ marginTop: 16, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text style={{ color: colors.accentForeground, fontSize: 14, fontWeight: "700" }}>Register your dog</Text>
          </Pressable>
        </View>
      ) : (
        <DogPageView
          key={page.dog.id}
          page={page}
          pages={pages}
          today={today}
          requests={requests.filter((r) => r.dogId === page.dog.id)}
          onSelect={setSelected}
          onManage={(mode) => {
            setDone(null);
            setSheet({ mode });
          }}
          onChanged={(m) => {
            if (m) setDone(m);
            load();
          }}
          onOpen={(path) => router.push(path as never)}
        />
      )}

      {page && (
        <SessionSheet
          visible={!!sheet}
          onClose={() => setSheet(null)}
          dog={{ id: page.dog.id, name: page.dog.name }}
          sessions={page.sessions.filter((s) => s.date > today)}
          placements={page.placements}
          member={member}
          initialMode={sheet?.mode ?? "menu"}
          onDone={(message) => {
            setSheet(null);
            setDone(message);
            load();
          }}
        />
      )}
    </ScrollView>
  );
}

function DogPageView({
  page,
  pages,
  today,
  requests,
  onSelect,
  onManage,
  onChanged,
  onOpen,
}: {
  page: DogPage;
  pages: DogPage[];
  today: string;
  requests: SessionRequest[];
  onSelect: (id: string) => void;
  onManage: (mode: SheetMode) => void;
  onChanged: (message?: string) => void;
  onOpen: (path: string) => void;
}) {
  const { dog, sessions, placements, progress, highlights, homework, latestCard, toDo } = page;
  const photo = mediaUrl(dog.photoUrl);
  const age = ageFrom(dog.dateOfBirth);
  const attended = sessions.filter((s) => !s.cancelled && s.date < today).length;
  const next = sessions.find((s) => !s.cancelled && s.date >= today) ?? null;
  const openRequests = requests.filter((r) => r.status === "pending" || r.status === "offered");
  const shown = [...openRequests, ...requests.filter((r) => r.status !== "pending" && r.status !== "offered")].slice(0, 5);
  let i = 0;

  return (
    <>
      {pages.length > 1 && <DogSwitcher dogs={pages.map((p) => p.dog)} selected={dog.id} onSelect={onSelect} />}
      {!dog.registered && <RegisterDogCard dog={dog} />}

      {/* The pass: photo, name, what they do, stats. */}
      <Appear index={i++} style={{ alignItems: "center" }}>
        <View style={{ width: 128, height: 128, borderRadius: 64, overflow: "hidden", backgroundColor: "rgba(245,245,242,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(245,245,242,0.6)" }}>
          {photo ? (
            <Image source={photo} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={{ color: colors.foreground, fontSize: 40, fontWeight: "600" }}>{dog.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700", marginTop: 16 }}>{dog.name}</Text>
        {(dog.breed || age) && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>{[dog.breed, age].filter(Boolean).join(" · ")}</Text>}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10, maxWidth: "100%" }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: placements.length ? colors.success : colors.muted }} />
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "500", flexShrink: 1 }} numberOfLines={2}>
            {serviceLine(placements, sessions)}
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginTop: 24, justifyContent: "center" }}>
          <StatItem value={attended} label="Sessions" />
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <StatItem value={homework.total} label="Homework days" />
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <StatItem value={homework.thisWeek} label="This week" />
        </View>

        {next && (
          <View style={[BOX, { marginTop: 24 }]}>
            <Text style={BOX_LABEL}>{next.date === today ? "Today's session" : "Next session"}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginTop: 4 }}>{longDate(next.date)}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{sessionLabel(next)}</Text>
          </View>
        )}

        {(highlights.strength || highlights.toImprove) && (
          <View style={[BOX, { gap: 14 }]}>
            {highlights.strength && (
              <View>
                <Text style={[BOX_LABEL, { color: colors.success }]}>Biggest strength</Text>
                <Text style={{ color: colors.foreground, fontSize: 15, marginTop: 4, lineHeight: 21 }}>{highlights.strength}</Text>
              </View>
            )}
            {highlights.toImprove && (
              <View>
                <Text style={[BOX_LABEL, { color: colors.warning }]}>Biggest area to improve</Text>
                <Text style={{ color: colors.foreground, fontSize: 15, marginTop: 4, lineHeight: 21 }}>{highlights.toImprove}</Text>
              </View>
            )}
            <Text style={{ color: colors.muted, fontSize: 11 }}>From your trainer{highlights.date ? `, ${formatDate(`${highlights.date}T12:00:00Z`)}` : ""}.</Text>
          </View>
        )}

        {latestCard && (
          <Pressable onPress={() => onOpen("/homework")} accessibilityRole="button" style={[BOX, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={BOX_LABEL}>Latest report card · {formatDate(latestCard.date)}</Text>
                {latestCard.isNew && <Tag label="New" solid />}
              </View>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600", marginTop: 4 }}>{latestCard.focus}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Appear>

      {progress && (
        <Appear index={i++} style={{ marginTop: 16 }}>
          <DogProgressCard progress={progress} dogName={dog.name} />
        </Appear>
      )}

      <Appear index={i++} style={{ marginTop: 28, gap: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Homework</Text>
        <OptionPill
          icon="school-outline"
          label={toDo > 0 ? `Homework: ${toDo} to do` : "Homework: all done"}
          hint={toDo > 0 ? "Complete each one on 3 different days" : "Every homework, and a search through them"}
          onPress={() => onOpen("/homework")}
        />
      </Appear>

      <Appear index={i++} style={{ marginTop: 28, gap: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Manage {dog.name}&apos;s sessions</Text>
        <OptionPill icon="close-circle-outline" label="Cancel a session or a holiday" hint="Up to the day before · no refund" onPress={() => onManage("cancel")} />
        <OptionPill icon="add-circle-outline" label="Book an extra Full Day or a 1-1" hint="We'll confirm or suggest another day" onPress={() => onManage("one_off")} />
        {placements.length > 0 && <OptionPill icon="repeat-outline" label="Switch my regular day" hint="Just once, or for good" onPress={() => onManage("switch")} />}
        <OptionPill icon="calendar-outline" label="Add a regular day" hint="Every week, or every other week" onPress={() => onManage("add_regular")} />
        <OptionPill icon="chatbubble-ellipses-outline" label="Message us" onPress={() => onOpen("/chat")} />
      </Appear>

      <Appear index={i++} style={{ marginTop: 28, marginBottom: 24, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, flex: 1 }}>My requests</Text>
          {requests.length > shown.length && (
            <Pressable onPress={() => onOpen("/requests")} hitSlop={8}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>See all</Text>
            </Pressable>
          )}
        </View>
        {shown.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 14 }}>Nothing asked for yet. Replacement days, extra sessions and day switches you ask for show here.</Text>
        ) : (
          shown.map((r) => <RequestCard key={r.id} request={r} role="owner" onChanged={onChanged} />)
        )}
      </Appear>
    </>
  );
}
