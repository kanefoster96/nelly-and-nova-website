import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { signOut, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Home tab. Pulls the signed-in account straight from Supabase (via
 * lib/session.ts — profiles + dogs, same tables the website reads) so this
 * screen proves the customer shell is live-wired, not sample data.
 */
export default function HomeScreen() {
  const session = useSession();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Welcome back{session?.ownerName ? `, ${session.ownerName}` : ""}.
      </Text>

      <View style={styles.dogs}>
        {(session?.dogs ?? []).map((dog) => (
          <View key={dog.id} style={styles.dogRow}>
            <Avatar uri={dog.photo} name={dog.name} size={44} />
            <Text style={styles.dogName}>{dog.name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        This is the home tab — dashboard content (next session, report cards,
        skills) will be added here next.
      </Text>

      <View style={styles.action}>
        <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: colors.ink,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.paper,
  },
  dogs: {
    gap: 12,
  },
  dogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dogName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.paper,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.paperDim,
  },
  action: {
    marginTop: "auto",
  },
});
