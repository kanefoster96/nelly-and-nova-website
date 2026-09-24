import * as Linking from "expo-linking";
import { Alert, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { AvatarCircle } from "@/components/avatar-circle";
import { BuildInfo } from "@/components/build-info";
import { NavDivider, NavList, NavRow } from "@/components/nav-row";
import { ScreenHeader } from "@/components/screen-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Tag } from "@/components/ui";
import { getMyDogs } from "@/data/dogs";
import { getDogProfile } from "@/data/reports";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 12, paddingHorizontal: 20 }}>
      {children}
    </Text>
  );
}

/** Member: their dogs (live) and training progress. */
function MemberSections({ userId }: { userId: string }) {
  const { data: dogs, error } = useAsync(() => getMyDogs(userId), [userId]);
  // TODO(backend): per-dog level/skills once dog_skills exists — sample for now.
  const { data: progress } = useAsync(getDogProfile);

  return (
    <>
      <SectionTitle>My Dogs</SectionTitle>
      <NavList>
        {!dogs && !error && <Text style={{ color: colors.muted, padding: 16 }}>Loading…</Text>}
        {error && <Text style={{ color: colors.danger, padding: 16 }}>Couldn&apos;t load your dogs.</Text>}
        {dogs?.length === 0 && <Text style={{ color: colors.muted, padding: 16 }}>No dogs on your account yet.</Text>}
        {dogs?.map((d, i) => (
          <View key={d.id}>
            {i > 0 && <NavDivider />}
            <NavRow title={d.name} leading={<AvatarCircle name={d.name} avatarUrl={d.photoUrl} size={34} />} />
          </View>
        ))}
      </NavList>

      {progress && (
        <>
          <SectionTitle>{`${progress.name}'s Progress`}</SectionTitle>
          <View style={{ marginHorizontal: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
              Level {progress.level} · {progress.sessions} sessions
            </Text>
            {progress.skills.map((s) => (
              <View key={s.label} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{s.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {s.level}/{s.of}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(245,245,242,0.08)", overflow: "hidden" }}>
                  <View style={{ height: 6, width: `${(s.level / s.of) * 100}%`, backgroundColor: colors.accent }} />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

/** Reached by tapping the avatar in the top bar. */
export default function ProfileScreen() {
  const { session, profile, isTrainer } = useAuth();
  const name = profile?.ownerName || session?.user.email || "?";
  const email = session?.user.email;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}>
        <View style={{ alignItems: "center", marginTop: 8, marginBottom: 8, gap: 8 }}>
          <AvatarCircle name={name} avatarUrl={profile?.avatarUrl} size={72} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 4 }}>{name}</Text>
          {email && <Text style={{ color: colors.muted, fontSize: 13 }}>{email}</Text>}
          <Tag label={isTrainer ? "Trainer" : "Member"} solid={isTrainer} />
        </View>

        {!isTrainer && session && <MemberSections userId={session.user.id} />}

        <SectionTitle>Account</SectionTitle>
        <NavList>
          <NavRow
            icon="key-outline"
            title="Change Password"
            description="We'll email you a link to set a new one."
            onPress={async () => {
              if (!email) return;
              await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/login", config.siteUrl).toString() });
              Alert.alert("Check your inbox", "We've emailed you a link to set a new password.");
            }}
          />
          <NavDivider />
          <NavRow icon="globe-outline" title="Website" description="nellyandnova.co.uk" onPress={() => Linking.openURL("https://www.nellyandnova.co.uk")} />
        </NavList>

        <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
          <SignOutButton />
        </View>
        <BuildInfo />
      </ScrollView>
    </View>
  );
}
