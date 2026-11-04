import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Pressable } from "@/components/pressable";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/useAsync";
import { colors, glass, GLASS_BORDER } from "@/theme";

type MeetGreet = {
  status: "new" | "meet_greet_booked" | "onboarding";
  service: string | null;
  dogNames: string | null;
  meetGreetAt: string | null;
  meetGreetNotes: string | null;
  /** Where it is, when the trainer booked it from a day. */
  meetGreetAddress?: string | null;
  joinToken: string | null;
} | null;

async function loadMeetGreet(): Promise<MeetGreet> {
  const { data } = await supabase.rpc("nn_my_meet_greet");
  return (data as MeetGreet) ?? null;
}

/**
 * Their free meet & greet, at the top of the Schedule tab — the Nelly & Nova
 * version of Kanvas's free trial card: requested → booked (day and time) →
 * onboarding (their set-up checklist, on the Profile tab). Hidden when
 * there's nothing open. A meet & greet the trainer booked from a day shows
 * its day, time (London) and where.
 */
export function MeetGreetCard() {
  const router = useRouter();
  const { data: mg } = useAsync(loadMeetGreet);
  if (!mg) return null;

  const dog = (mg.dogNames ?? "your dog").replace(/, ([^,]*)$/, " & $1");
  const when = mg.meetGreetAt
    ? new Date(mg.meetGreetAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : null;
  // Only Full Day Training starts with a meet & greet; 1-1 and Online go straight to a chat.
  const isDayTraining = mg.service === "Full Day Training";
  const title = mg.status === "new" ? "Request received" : mg.status === "meet_greet_booked" ? when ?? "Booked" : "Let's get you set up";
  const body =
    mg.status === "new"
      ? isDayTraining
        ? `We'll be in touch to ask a few questions and book a day to meet ${dog}.`
        : `We'll be in touch to chat about ${dog} and get you started.`
      : mg.status === "meet_greet_booked"
        ? `We're looking forward to meeting ${dog}.${mg.meetGreetAddress ? `\n\nWhere: ${mg.meetGreetAddress}` : ""}${mg.meetGreetNotes ? `\n\n${mg.meetGreetNotes}` : ""}`
        : `Set up your Direct Debit and register ${dog} before your first session.`;

  return (
    <View style={{ borderRadius: 20, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 18, gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 2.5 }}>{isDayTraining ? "YOUR FREE MEET & GREET" : "YOUR REQUEST"}</Text>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{body}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        {mg.status === "onboarding" && mg.joinToken && (
          <Pressable
            // The set-up checklist, in the app on the Profile tab.
            onPress={() => router.push("/dog")}
            style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.accentForeground, fontWeight: "700" }}>Continue set-up</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push("/chat")}
          style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", ...glass }}
        >
          <Text style={{ color: colors.foreground, fontWeight: "600" }}>Message us</Text>
        </Pressable>
      </View>
    </View>
  );
}
