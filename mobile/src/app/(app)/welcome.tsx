import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ScrollView, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/logo";
import { PAGE_TITLE_STYLE } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { BigButton, IconBadge } from "@/components/trainer/cards";
import { CARD } from "@/components/ui";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { registerToken } from "@/lib/push";
import { markWelcomeSeen } from "@/lib/welcome";
import { colors } from "@/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type Permission = "unknown" | "granted" | "denied" | "ask";

function Point({ icon, title, body }: { icon: IoniconName; title: string; body: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <IconBadge icon={icon} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{body}</Text>
      </View>
    </View>
  );
}

/**
 * Owners' first-launch welcome, once per account on this phone (lib/welcome.ts),
 * after the Kanvas app's way of asking for notifications from a screen that
 * has just said what they're for. Three short pages, swiped or stepped
 * through with the button:
 *   1. What the app does: sessions, chat, homework, report cards.
 *   2. Stay in the loop: why notifications matter, then "Allow
 *      notifications", which asks iOS and saves this phone's token
 *      (lib/push.ts registerToken). Nothing asks before this page.
 *   3. Let's get you set up → the Profile tab and its checklist.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { session, profile, isTrainer } = useAuth();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [permission, setPermission] = useState<Permission>("unknown");
  const [asking, setAsking] = useState(false);
  const first = (profile?.ownerName ?? "").trim().split(/\s+/)[0] ?? "";

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((p) => setPermission(p.granted ? "granted" : p.canAskAgain ? "ask" : "denied"))
      .catch(() => setPermission("ask"));
  }, []);

  if (isTrainer) return <Redirect href="/community" />;

  function goTo(next: number) {
    const n = Math.max(0, Math.min(2, next));
    scroller.current?.scrollTo({ x: n * width, animated: true });
    setPage(n);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const n = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (n !== page) {
      hapticSelection();
      setPage(n);
    }
  }

  async function allow() {
    if (!userId || asking) return;
    setAsking(true);
    try {
      await registerToken(userId);
    } catch {
      // Saving the token can fail offline; the app tries again on its next launch.
    }
    const p = await Notifications.getPermissionsAsync().catch(() => null);
    const granted = !!p?.granted;
    setPermission(granted ? "granted" : "denied");
    setAsking(false);
    if (granted) hapticSuccess();
    goTo(2);
  }

  function finish() {
    markWelcomeSeen(userId);
    hapticSuccess();
    router.replace("/dog" as never);
  }

  const pages = [
    <View key="what" style={{ gap: 22 }}>
      <Logo />
      <View>
        <Text style={[PAGE_TITLE_STYLE, { fontSize: 32, lineHeight: 38 }]}>{first ? `Welcome, ${first}!` : "Welcome!"}</Text>
        <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8 }}>Everything for your dog&apos;s training with Nelly &amp; Nova, in one place.</Text>
      </View>
      <View style={[CARD, { gap: 18, padding: 18 }]}>
        <Point icon="calendar-outline" title="Sessions" body="Your dog's days with us. Cancel, switch or book an extra one." />
        <Point icon="chatbubble-ellipses-outline" title="Chat" body="Message the trainers any time, about anything." />
        <Point icon="school-outline" title="Homework" body="What to practise at home, with videos to show you how." />
        <Point icon="clipboard-outline" title="Report cards" body="How every session went, and what they did brilliantly." />
      </View>
    </View>,
    <View key="loop" style={{ gap: 22 }}>
      <IconBadge icon="notifications-outline" size={64} />
      <View>
        <Text style={[PAGE_TITLE_STYLE, { fontSize: 32, lineHeight: 38 }]}>Stay in the loop</Text>
        <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8 }}>We&apos;ll only send what matters on the day, so you always know where your dog is.</Text>
      </View>
      <View style={[CARD, { gap: 18, padding: 18 }]}>
        <Point icon="time-outline" title="Pick-up times" body="A reminder the evening before, with when we'll collect." />
        <Point icon="car-outline" title="On route" body="When we're on our way to you, and when your dog's with us or back home." />
        <Point icon="clipboard-outline" title="Report cards" body="The moment their report card and homework are ready." />
      </View>
      {permission === "granted" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 15, fontWeight: "600" }}>Notifications are on</Text>
        </View>
      )}
      {permission === "denied" && (
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>Notifications are off for Nelly &amp; Nova. You can turn them on any time in your iPhone&apos;s Settings.</Text>
      )}
    </View>,
    <View key="setup" style={{ gap: 22 }}>
      <IconBadge icon="paw-outline" size={64} />
      <View>
        <Text style={[PAGE_TITLE_STYLE, { fontSize: 32, lineHeight: 38 }]}>Let&apos;s get you set up</Text>
        <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8 }}>
          Your Profile has a short checklist: your Direct Debit, registering your dog and their training day. It only takes a few minutes.
        </Text>
      </View>
      <View style={[CARD, { gap: 18, padding: 18 }]}>
        <Point icon="card-outline" title="Direct Debit" body="On GoCardless's secure page. Cancel any time." />
        <Point icon="document-text-outline" title="Register your dog" body="Their health, vet and consent, before their first session." />
        <Point icon="calendar-outline" title="Training day" body="We'll set it with you, and it shows in your Schedule." />
      </View>
    </View>,
  ];

  const button =
    page === 0 ? (
      <BigButton label="Next" icon="arrow-forward" onPress={() => goTo(1)} />
    ) : page === 1 ? (
      permission === "granted" || permission === "denied" ? (
        <BigButton label="Next" icon="arrow-forward" onPress={() => goTo(2)} />
      ) : (
        <BigButton label="Allow notifications" icon="notifications" onPress={allow} busy={asking} />
      )
    ) : (
      <BigButton label="Go to my Profile" icon="arrow-forward" onPress={finish} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ height: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 20 }}>
        {page < 2 && (
          <Pressable onPress={() => goTo(2)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip to set-up">
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>Skip</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
        // No swiping away while iOS is asking.
        scrollEnabled={!asking}
      >
        {pages.map((content, i) => (
          <ScrollView key={i} style={{ width }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }} accessibilityLabel={`Page ${page + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.foreground : colors.border }} />
          ))}
        </View>
        {button}
        {page === 1 && permission === "ask" && (
          <Pressable onPress={() => goTo(2)} hitSlop={8} style={{ alignSelf: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Not now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
