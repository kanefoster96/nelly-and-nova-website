import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { BuildInfo } from "@/components/build-info";
import { PageTitle } from "@/components/page-title";
import { GroupHeading, MenuCard } from "@/components/trainer/cards";
import { countNewEnquiries } from "@/data/onboarding-board";
import { countPendingRequests, countUnpaid } from "@/data/sessions";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { colors } from "@/theme";

/**
 * The trainer's toolkit, as the Kanvas coach's Menu tab lays it out: each
 * page a card (icon, name, what it's for), in groups. Everything that runs
 * the club but doesn't warrant a tab: Requests, the Calendar, the Homework
 * library, Onboarding (meet & greet requests to sign-up), Messages,
 * notifications and Profile. The day's dogs are on the Today tab.
 */
export default function TrainerMenuScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const barInset = useBarInset();
  const barScroll = useBarScroll();
  const topInset = useTopBarInset();
  const [counts, setCounts] = useState({ requests: 0, unpaid: 0, enquiries: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!isTrainer) return;
      let live = true;
      Promise.all([countPendingRequests(), countUnpaid(), countNewEnquiries().catch(() => 0)])
        .then(([requests, unpaid, enquiries]) => live && setCounts({ requests, unpaid, enquiries }))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [isTrainer]),
  );

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
            icon="swap-horizontal-outline"
            title="Requests"
            description={`Replacement days, extra sessions and day switches to accept.${counts.unpaid ? ` ${counts.unpaid} unpaid session${counts.unpaid === 1 ? "" : "s"} to charge.` : " Unpaid sessions to charge."}`}
            count={counts.requests + counts.unpaid}
            onPress={() => router.push("/requests")}
          />
          <MenuCard
            icon="calendar-outline"
            title="Calendar"
            description="Every date: full-day dogs, one-offs, 1-1s and meet & greets. Add a dog to a day."
            onPress={() => router.push("/calendar")}
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
            description="Meet & greet requests, booking them in, join links and Direct Debit set-ups."
            count={counts.enquiries}
            onPress={() => router.push("/onboarding")}
          />
          <MenuCard
            icon="chatbubble-ellipses-outline"
            title="Messages"
            description="Conversations with owners."
            onPress={() => router.navigate("/chat")}
          />
          <MenuCard
            icon="megaphone-outline"
            title="Send a notification"
            description="To every owner or the ones you choose: on their phone and their Notifications."
            onPress={() => router.push("/send-notification")}
          />
        </View>
      </Appear>

      <Appear index={2}>
        <GroupHeading>You</GroupHeading>
        <View style={{ gap: 10 }}>
          <MenuCard icon="people-outline" title="Team" description="Each trainer's name and photo, as owners see them." onPress={() => router.push("/team")} />
          <MenuCard icon="person-circle-outline" title="Profile" description="Your account, password and signing out." onPress={() => router.push("/profile")} />
          <MenuCard icon="notifications-outline" title="Notifications" description="Everything the app has told you." onPress={() => router.push("/notifications")} />
        </View>
      </Appear>

      <BuildInfo />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
