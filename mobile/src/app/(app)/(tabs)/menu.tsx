import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ScrollView, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { BuildInfo } from "@/components/build-info";
import { PageTitle } from "@/components/page-title";
import { GroupHeading, MenuCard } from "@/components/trainer/cards";
import { config } from "@/lib/config";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { colors } from "@/theme";

/**
 * The trainer's toolkit, as the Kanvas coach's Menu tab lays it out: each
 * page a card (icon, name, what it's for), in groups. Everything that runs
 * the club but doesn't warrant a tab: the Calendar, the two-week schedule
 * and the Homework library (both tabs before), Onboarding on the website,
 * and Profile.
 */
export default function TrainerMenuScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const barInset = useBarInset();
  const barScroll = useBarScroll();
  const topInset = useTopBarInset();

  if (!isTrainer) return <Redirect href="/community" />;

  return (
    <ScrollView
      {...barScroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: topInset + 8, paddingBottom: barInset }}
    >
      <PageTitle title="Menu" subtitle="Everything you need to run Nelly & Nova." style={{ marginHorizontal: 4 }} />

      <Appear index={0}>
        <GroupHeading>Training</GroupHeading>
        <View style={{ gap: 10 }}>
          <MenuCard
            icon="calendar-outline"
            title="Calendar"
            description="Every date: full-day dogs, one-offs, 1-1s and meet & greets. Add a dog to a day."
            onPress={() => router.push("/calendar")}
          />
          <MenuCard
            icon="paw-outline"
            title="Schedule"
            description="Full Day Training for the next two weeks and the dogs booked on each day."
            onPress={() => router.push("/trainer-schedule")}
          />
          <MenuCard
            icon="school-outline"
            title="Homework"
            description="The drill library: pillars, categories, levels and how-tos."
            onPress={() => router.push("/library")}
          />
        </View>
      </Appear>

      <Appear index={1}>
        <GroupHeading>Clients</GroupHeading>
        <View style={{ gap: 10 }}>
          <MenuCard
            icon="person-add-outline"
            title="Onboarding"
            description="Meet & greet requests, join links and Direct Debit set-ups, on the website."
            onPress={() => WebBrowser.openBrowserAsync(new URL("/admin/onboarding", config.siteUrl).toString())}
          />
          <MenuCard
            icon="chatbubble-ellipses-outline"
            title="Messages"
            description="Conversations with owners."
            onPress={() => router.navigate("/chat")}
          />
        </View>
      </Appear>

      <Appear index={2}>
        <GroupHeading>You</GroupHeading>
        <View style={{ gap: 10 }}>
          <MenuCard icon="person-circle-outline" title="Profile" description="Your account, password and signing out." onPress={() => router.push("/profile")} />
          <MenuCard icon="notifications-outline" title="Notifications" description="Everything the app has told you." onPress={() => router.push("/notifications")} />
        </View>
      </Appear>

      <BuildInfo />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
