import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { getMyOnboarding, setUpUnfinished } from "@/data/onboarding";
import { welcomeSeen } from "@/lib/welcome";
import { colors } from "@/theme";

type Href = "/community" | "/dog" | "/welcome";

/** Asks where an owner's set-up has got to, giving up after a few seconds (offline: Community). */
async function ownerStart(userId: string): Promise<Href> {
  if (!welcomeSeen(userId)) return "/welcome";
  const unfinished = await Promise.race([
    getMyOnboarding().then(setUpUnfinished).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000)),
  ]);
  return unfinished ? "/dog" : "/community";
}

/**
 * "/" → the right place for who's signed in (on opening the app, and just
 * after logging in). Trainers: Community. Owners: the first-launch welcome
 * once per account on this phone; then, while their set-up isn't finished
 * (data/onboarding.ts setUpUnfinished), the Profile tab with its checklist;
 * after that, Community.
 */
export default function Index() {
  const { session, isTrainer } = useAuth();
  const userId = session?.user.id ?? null;
  const [target, setTarget] = useState<{ for: string; href: Href } | null>(null);

  useEffect(() => {
    if (!userId || isTrainer) return;
    let live = true;
    void ownerStart(userId).then((href) => live && setTarget({ for: userId, href }));
    return () => {
      live = false;
    };
  }, [userId, isTrainer]);

  if (!session) return <Redirect href="/sign-in" />;
  if (isTrainer) return <Redirect href="/community" />;
  if (target?.for === userId) return <Redirect href={target.href as never} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.muted} />
    </View>
  );
}
