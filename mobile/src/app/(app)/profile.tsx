import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { BuildInfo } from "@/components/build-info";
import { NavDivider, NavList, NavRow } from "@/components/nav-row";
import { ScreenHeader } from "@/components/screen-header";
import { SignOutButton } from "@/components/sign-out-button";
import { Tag } from "@/components/ui";
import { getMyDogs } from "@/data/dogs";
import { DogProgressCard } from "@/components/homework/dog-progress";
import { getDogProgress } from "@/data/reports";
import { config } from "@/lib/config";
import { hapticError, hapticSuccess } from "@/lib/haptics";
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

/** A page of the website, in the in-app browser (signed in there with the same account). */
function openSite(path: string) {
  void WebBrowser.openBrowserAsync(new URL(path, config.siteUrl).toString());
}

/** Member: their dogs (live) and training progress. */
function MemberSections({ userId }: { userId: string }) {
  const { data: dogs, error } = useAsync(() => getMyDogs(userId), [userId]);
  // Each dog's live skills & levels (the trainer ticks them off).
  const { data: progress } = useAsync(
    async () => (dogs ? Promise.all(dogs.map(async (d) => ({ dog: d, progress: await getDogProgress(d.id) }))) : null),
    [dogs]
  );

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
            <NavRow
              title={d.name}
              description="Details, health, vet and consent form."
              leading={<AvatarCircle name={d.name} avatarUrl={d.photoUrl} size={34} />}
              onPress={() => openSite(`/profile/dogs/${d.id}`)}
            />
          </View>
        ))}
        {dogs && (
          <>
            {dogs.length > 0 && <NavDivider />}
            <NavRow icon="add" title="Add a Dog" onPress={() => openSite("/profile/dogs/new")} />
          </>
        )}
      </NavList>

      {progress?.map(({ dog, progress: p }) => (
        <View key={dog.id}>
          <SectionTitle>{`${dog.name}'s Progress`}</SectionTitle>
          <View style={{ marginHorizontal: 20 }}>
            <DogProgressCard progress={p} dogName={dog.name} />
          </View>
        </View>
      ))}
    </>
  );
}

/**
 * Reached by tapping the avatar in the top bar — laid out like Kanvas's
 * Profile: who you are, your dogs, then Account (your info, password, your
 * data, guidelines, delete) and Sign Out. Editing your details and a dog's
 * record open those pages of the website, as Kanvas's Payments does.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session, profile, isTrainer } = useAuth();
  const name = profile?.ownerName || session?.user.email || "?";
  const email = session?.user.email;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}>
        <Appear style={{ alignItems: "center", marginTop: 8, marginBottom: 8, gap: 8 }}>
          <AvatarCircle name={name} avatarUrl={profile?.avatarUrl} size={72} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 4 }}>{name}</Text>
          {email && <Text style={{ color: colors.muted, fontSize: 13 }}>{email}</Text>}
          <Tag label={isTrainer ? "Trainer" : "Member"} solid={isTrainer} />
        </Appear>

        {!isTrainer && session && (
          <Appear index={1}>
            <MemberSections userId={session.user.id} />
          </Appear>
        )}

        <Appear index={2}>
          <SectionTitle>Account</SectionTitle>
          <NavList>
            <NavRow
              icon="person-outline"
              title="My Info"
              description="Your name, phone, address and emergency contacts."
              onPress={() => openSite("/profile/account/edit")}
            />
            <NavDivider />
            <NavRow
              icon="key-outline"
              title="Change Password"
              description="We'll email you a link to set a new one."
              onPress={async () => {
                if (!email) return;
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/reset-password", config.siteUrl).toString() });
                if (error) {
                  hapticError();
                  Alert.alert("Couldn't send the link", error.message);
                  return;
                }
                hapticSuccess();
                Alert.alert("Check your inbox", "We've emailed you a link to set a new password.");
              }}
            />
            <NavDivider />
            <NavRow
              icon="download-outline"
              title="Download Your Data"
              description="A copy of everything we hold about you and your dogs."
              onPress={() => openSite("/account/your-data")}
            />
            <NavDivider />
            <NavRow
              icon="trash-outline"
              title="Delete Account"
              description="Permanently remove your account and data."
              onPress={() => router.push("/delete-account")}
            />
          </NavList>
        </Appear>

        <Appear index={3}>
          <SectionTitle>Nelly &amp; Nova</SectionTitle>
          <NavList>
            <NavRow
              icon="shield-checkmark-outline"
              title="Community Guidelines"
              description="How we keep the community friendly and safe."
              onPress={() => openSite("/community-guidelines")}
            />
            <NavDivider />
            <NavRow icon="globe-outline" title="Website" description="nellyandnova.co.uk" onPress={() => void WebBrowser.openBrowserAsync("https://www.nellyandnova.co.uk")} />
          </NavList>
        </Appear>

        <Appear index={4} style={{ marginTop: 32, paddingHorizontal: 20 }}>
          <SignOutButton />
        </Appear>
        <BuildInfo />
      </ScrollView>
    </View>
  );
}
