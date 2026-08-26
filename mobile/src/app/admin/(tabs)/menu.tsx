import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { getAllMembers, type Member } from "@/lib/adminMembers";
import { signOut } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Everything backend-managed that isn't its own tab: the real customer/dog
 * list (profiles + dogs), and a sign-out button. Payments has no real
 * backend anywhere in this codebase yet (the website's own payments screens
 * are sample data too — no live GoCardless integration) — it's left out
 * here rather than faked; wire it up once a real payments table/provider
 * exists.
 */
export default function AdminMenuScreen() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getAllMembers().then(setMembers);
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Customers {members ? `(${members.length})` : ""}
        </Text>
        {members === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : members.length === 0 ? (
          <Text style={styles.emptyText}>No customers yet.</Text>
        ) : (
          <View style={styles.list}>
            {members.map((m) => {
              const expanded = expandedId === m.accountId;
              return (
                <View key={m.accountId} style={styles.card}>
                  <Pressable
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(expanded ? null : m.accountId)}
                  >
                    <Avatar name={m.ownerName} size={36} />
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>{m.ownerName}</Text>
                      <Text style={styles.cardMeta}>
                        {m.dogs.length} dog{m.dogs.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.paperDim} />
                  </Pressable>

                  {expanded && (
                    <View style={styles.cardBody}>
                      {m.email ? <Text style={styles.detailText}>{m.email}</Text> : null}
                      {m.phone ? <Text style={styles.detailText}>{m.phone}</Text> : null}
                      {m.dogs.map((d) => (
                        <View key={d.id} style={styles.dogRow}>
                          <Avatar uri={d.photoUrl} name={d.name} size={28} />
                          <Text style={styles.dogText}>
                            {d.name}
                            {d.breed ? ` · ${d.breed}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payments</Text>
        <View style={styles.notConnectedCard}>
          <Ionicons name="card-outline" size={18} color={colors.paperDim} />
          <Text style={styles.notConnectedText}>
            Not connected yet — there&apos;s no live payment provider wired up
            in this project (website or app).
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 20,
    gap: 28,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  emptyText: {
    fontSize: 14,
    color: colors.paperDim,
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.paperDim,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: "rgba(245,242,234,0.85)",
  },
  dogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  dogText: {
    fontSize: 13,
    color: colors.paper,
  },
  notConnectedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  notConnectedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.paperDim,
  },
});
