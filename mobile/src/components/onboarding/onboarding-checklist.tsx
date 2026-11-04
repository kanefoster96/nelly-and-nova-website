import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Pressable } from "@/components/pressable";
import {
  DD_BAD,
  DD_DONE,
  DIRECT_DEBIT_RETURN,
  dogList,
  getMyOnboarding,
  openDirectDebit,
  refreshDirectDebit,
  trainingDayLabel,
  type OnboardingStatus,
} from "@/data/onboarding";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, glass, GLASS_BORDER } from "@/theme";

type StepState = "done" | "todo" | "waiting" | "problem";

/**
 * The owner's set-up checklist, at the top of the Profile tab until it's
 * all done: the app's version of the website's /join page, laid out like
 * Kanvas's trial → join → register cards. Five steps:
 *   1. Meet & greet: requested, then booked (day and time), then met.
 *   2. Direct Debit: GoCardless's own secure page in an in-app browser
 *      sheet. Back in the app (the sheet closing, or the app coming back to
 *      the front) it asks GoCardless where it's got to.
 *   3. Your account: done, they're signed in.
 *   4. Register each dog: the consent & waiver form, in the app.
 *   5. Training day: once the trainer sets it ("Thursdays").
 * Hidden when there's no request on the account, and once every step is done.
 */
export function OnboardingChecklist({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null | undefined>(undefined);
  const [ddBusy, setDdBusy] = useState(false);
  const [ddError, setDdError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getMyOnboarding();
      setStatus((prev) => {
        if (prev && JSON.stringify(prev) !== JSON.stringify(next)) animateListChange();
        return next;
      });
    } catch {
      setStatus((prev) => prev ?? null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Back from GoCardless in the phone's browser (or anywhere): check again.
  const pending = !!status?.enquiry?.onboardingStarted && !DD_DONE.includes(status.directDebit) && !DD_BAD.includes(status.directDebit);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s !== "active") return;
      if (pendingRef.current) await refreshDirectDebit();
      void load();
    });
    return () => sub.remove();
  }, [load]);

  async function setUpDirectDebit() {
    setDdError(null);
    setDdBusy(true);
    try {
      const r = await openDirectDebit();
      if (r.url) {
        // The secure page in a sheet; GoCardless hands back to the website's
        // "All done" page, which hands back to the app and closes it.
        await WebBrowser.openAuthSessionAsync(r.url, DIRECT_DEBIT_RETURN);
      }
      const latest = await refreshDirectDebit();
      await load();
      if (latest && DD_DONE.includes(latest)) {
        hapticSuccess();
        onChanged?.();
      }
    } catch (e) {
      hapticError();
      setDdError(e instanceof Error ? e.message : "Couldn't open GoCardless. Please try again.");
    } finally {
      setDdBusy(false);
    }
  }

  const e = status?.enquiry;
  if (!status || !e) return null;

  const dogLabel = dogList(e.dogNames ?? status.dogs.map((d) => d.name).join(", "));
  const met = e.status === "onboarding" || e.onboardingStarted;
  const ddDone = DD_DONE.includes(status.directDebit);
  const ddBad = DD_BAD.includes(status.directDebit);
  const dogs = status.dogs;
  const allRegistered = dogs.length > 0 && dogs.every((d) => d.registered);
  const day = trainingDayLabel(e.trainingDay, e.trainingCadence);
  const isDayTraining = !e.service || e.service === "Full Day Training";
  if (met && ddDone && allRegistered && day) return null;

  const when = e.meetGreetAt
    ? new Date(e.meetGreetAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : null;
  const doneCount = [met, ddDone, true, allRegistered, !!day].filter(Boolean).length;

  const steps: { key: string; title: string; body: string; state: StepState; action?: ReactNode }[] = [
    {
      key: "meet",
      title: met ? (isDayTraining ? "Meet & greet" : "Your request") : e.status === "meet_greet_booked" ? (when ? `Meet & greet: ${when}` : "Meet & greet booked") : "Request received",
      body: met
        ? `Lovely meeting ${dogLabel}.`
        : e.status === "meet_greet_booked"
          ? `We're looking forward to meeting ${dogLabel}.${e.meetGreetNotes ? ` ${e.meetGreetNotes}` : ""}`
          : isDayTraining
            ? `We'll be in touch to ask a few questions and book a day to meet ${dogLabel}.`
            : `We'll be in touch to chat about ${dogLabel} and get you started.`,
      state: met ? "done" : "waiting",
    },
    {
      key: "dd",
      title: "Set up your Direct Debit",
      body: !met
        ? "After your meet & greet, on GoCardless's secure page."
        : status.directDebit === "active"
          ? "Your Direct Debit is active."
          : ddDone
            ? "Done. Your bank is confirming it, which takes a few working days."
            : ddBad
              ? "That didn't go through. Send us a message and we'll sort out a new link."
              : !status.billingRequestId
                ? "We're getting this ready for you. It'll appear here shortly."
                : "On GoCardless's secure page: we never see your bank details. Nothing is taken now; we'll confirm your price and dates with you first.",
      state: ddDone ? "done" : ddBad ? "problem" : met && status.billingRequestId ? "todo" : "waiting",
      action:
        met && !ddDone && !ddBad && status.billingRequestId ? (
          <ActionButton label="Set up Direct Debit" icon="lock-closed" busy={ddBusy} onPress={setUpDirectDebit} />
        ) : ddBad ? (
          <ActionButton label="Message us" secondary onPress={() => router.push("/chat")} />
        ) : undefined,
    },
    {
      key: "account",
      title: "Your account",
      body: `Signed in${session?.user.email ? ` as ${session.user.email}` : ""}: chat with us, community and notifications are all here.`,
      state: "done",
    },
    {
      key: "register",
      title: `Register ${dogLabel}`,
      body: allRegistered
        ? "Their health, vet and consent & waiver are saved."
        : "Their health and vet details, emergency contacts, and the consent & waiver. We can't collect them for their first session until this is done.",
      state: allRegistered ? "done" : "todo",
      action: allRegistered ? undefined : (
        <View style={{ gap: 8 }}>
          {dogs.map((d) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, minHeight: 48 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", flex: 1 }}>{d.name}</Text>
              {d.registered ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 8 }}>
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>Registered</Text>
                </View>
              ) : (
                <ActionButton small label="Register" onPress={() => router.push({ pathname: "/register/[dogId]", params: { dogId: d.id } } as never)} />
              )}
            </View>
          ))}
          {dogs.length === 0 && <ActionButton label="Register your dog" onPress={() => router.push({ pathname: "/register/[dogId]", params: { dogId: "new" } } as never)} />}
        </View>
      ),
    },
    {
      key: "day",
      title: day ? `Training day confirmed: ${day}` : "Your training day",
      body: day
        ? e.firstSessionOn
          ? `First session ${new Date(`${e.firstSessionOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`
          : "We'll see you then."
        : `We'll confirm ${dogLabel}'s day with you once everything above is done.`,
      state: day ? "done" : "waiting",
    },
  ];

  return (
    <View style={{ borderRadius: 20, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 18 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 2.5 }}>{met ? "GETTING SET UP" : isDayTraining ? "YOUR FREE MEET & GREET" : "YOUR REQUEST"}</Text>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800", marginTop: 6 }}>{met ? `Let's get ${dogLabel} started` : "Welcome to Nelly & Nova"}</Text>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 14 }}>
        {steps.map((s) => (
          <View key={s.key} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: s.state === "done" ? colors.success : s.state === "problem" ? colors.danger : colors.border }} />
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
        {doneCount} of {steps.length} done
      </Text>

      <View style={{ marginTop: 14 }}>
        {steps.map((s, i) => (
          <View key={s.key} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, opacity: s.state === "waiting" ? 0.75 : 1 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: s.state === "done" ? colors.success : s.state === "problem" ? "rgba(225,29,51,0.18)" : s.state === "todo" ? colors.accent : "rgba(245,242,234,0.08)",
              }}
            >
              {s.state === "done" ? (
                <Ionicons name="checkmark" size={17} color={colors.background} />
              ) : s.state === "problem" ? (
                <Ionicons name="alert" size={16} color={colors.danger} />
              ) : (
                <Text style={{ color: s.state === "todo" ? colors.accentForeground : colors.muted, fontSize: 13, fontWeight: "800" }}>{i + 1}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{s.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{s.body}</Text>
              {s.action && s.state !== "done" ? <View style={{ marginTop: 8 }}>{s.action}</View> : null}
              {s.key === "dd" && ddError ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{ddError}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push("/chat")} style={{ marginTop: 6, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", ...glass }}>
        <Text style={{ color: colors.foreground, fontWeight: "600" }}>Questions? Message us</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  busy,
  secondary,
  small,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: small ? 36 : 40,
        paddingHorizontal: small ? 16 : 18,
        borderRadius: 20,
        backgroundColor: secondary ? undefined : colors.accent,
        ...(secondary ? glass : null),
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={secondary ? colors.foreground : colors.accentForeground} /> : icon ? <Ionicons name={icon} size={14} color={secondary ? colors.foreground : colors.accentForeground} /> : null}
      <Text style={{ color: secondary ? colors.foreground : colors.accentForeground, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
