import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { ChipRow } from "@/components/trainer/chips";
import { CARD_RADIUS } from "@/components/trainer/cards";
import { LoadingState, Tag } from "@/components/ui";
import {
  cameIn,
  DD_DONE,
  enquiryDogs,
  getOnboardingProgress,
  helpWith,
  listEnquiries,
  postcodeArea,
  stageOf,
  STAGES,
  type Enquiry,
  type OnboardingProgress,
  type Stage,
} from "@/data/onboarding-board";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

function Tick({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={14} color={done ? colors.success : colors.muted} />
      <Text style={{ color: done ? colors.foreground : colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function EnquiryRow({ e, progress, onPress }: { e: Enquiry; progress?: OnboardingProgress; onPress: () => void }) {
  const dogs = enquiryDogs(e);
  const area = postcodeArea(e);
  const help = helpWith(e);
  const stage = stageOf(e);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}, open`}
      style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: CARD_RADIUS, padding: 16, gap: 8 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <AvatarCircle name={e.name || e.email || "?"} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
            {e.name || e.email}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
            {e.kind === "booking" ? "Meet & greet form" : "Contact form"} · {cameIn(e.createdAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
      {(e.service || dogs.length > 0) && (
        <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={2}>
          {[e.service, dogs.length ? `Dogs: ${dogs.join(", ")}` : null].filter(Boolean).join(" · ")}
        </Text>
      )}
      {(area || help) && (
        <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
          {[area ? `${area} area` : null, help ? `Help with: ${help}` : null].filter(Boolean).join(" · ")}
        </Text>
      )}
      {!help && !!e.message && (
        <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
          {e.message}
        </Text>
      )}
      {e.meetGreetAt && stage !== "set_up" && stage !== "closed" && (
        <View style={{ flexDirection: "row" }}>
          <Tag label={`Meet & greet ${cameIn(e.meetGreetAt)}`} tone={colors.success} />
        </View>
      )}
      {stage === "onboarding" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 }}>
          <Tick done={DD_DONE.includes(progress?.directDebit ?? "")} label="Direct Debit" />
          <Tick done={!!progress?.accountLinked} label="Account" />
          <Tick done={!!e.trainingDay && !!e.firstSessionOn} label="Training day" />
          <Tick done={!!progress && progress.dogs.length > 0 && progress.dogs.every((d) => d.registered)} label="Dogs registered" />
        </View>
      )}
      {stage === "closed" && !!e.closedReason && <Text style={{ color: colors.muted, fontSize: 12 }}>Closed: {e.closedReason}</Text>}
    </Pressable>
  );
}

/**
 * Trainer: Onboarding, from Menu — the website's Onboarding board
 * (/admin/onboarding) in the app. Every meet & greet request and
 * contact-form message, by stage: New, Meet & greet booked, Onboarding
 * sent, Set up, Closed. Each shows who, their dogs, the service, their
 * postcode area, what they'd like help with and when it came in (and,
 * once onboarding's sent, their checklist). A tap opens it to act on.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Enquiry[] | null>(null);
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("new");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listEnquiries();
      setItems(list);
      getOnboardingProgress(list.filter((e) => e.status === "onboarding"))
        .then(setProgress)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the requests.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const c: Partial<Record<Stage, number>> = {};
    for (const e of items ?? []) c[stageOf(e)] = (c[stageOf(e)] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = (items ?? []).filter((e) => stageOf(e) === stage);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Onboarding" subtitle="Meet & greet requests through to Direct Debit and registered dogs." />
      {!items ? (
        <LoadingState error={error} />
      ) : (
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
          <ChipRow
            options={STAGES.map((s) => ({ value: s.value, label: counts[s.value] ? `${s.label} (${counts[s.value]})` : s.label }))}
            value={stage}
            onChange={(s) => {
              animateListChange();
              setStage(s);
            }}
          />
          {error && <Text style={{ color: colors.danger, marginTop: 12 }}>{error}</Text>}
          <View style={{ gap: 10, marginTop: 16 }}>
            {shown.length === 0 && (
              <Text style={{ color: colors.muted, fontSize: 14, paddingVertical: 20, textAlign: "center" }}>
                {stage === "new" ? "No new requests. Meet & greet requests and contact-form messages appear here." : "Nothing here."}
              </Text>
            )}
            {shown.map((e, i) => (
              <Appear key={e.id} index={i}>
                <EnquiryRow e={e} progress={progress[e.id]} onPress={() => router.push({ pathname: "/onboarding/[id]", params: { id: e.id } })} />
              </Appear>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
