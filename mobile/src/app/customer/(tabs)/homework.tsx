import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCompletedItemIds, getHomeworkLibrary, markHomeworkDone, type ReportCard } from "@/lib/homework";
import { activeDog, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Every published report card's homework, newest first — the library
 * "unlocks" one card at a time as new report cards get published, and
 * stays accessible forever (nothing here ever locks back up). The most
 * recent card is pinned open at the top as the active practice checklist;
 * older ones collapse into the library below but are just as checkable —
 * homework gets practised across many sessions, not once and done.
 */
export default function HomeworkScreen() {
  const session = useSession();
  const dog = activeDog(session);

  const [cards, setCards] = useState<ReportCard[] | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    const dogId = dog.id;

    Promise.all([getHomeworkLibrary(dogId), getCompletedItemIds(dogId)]).then(([library, completed]) => {
      if (cancelled) return;
      setCards(library);
      setDoneIds(completed);
      setExpandedId(library[0]?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  async function toggleItem(itemId: string) {
    if (!dog || doneIds.has(itemId)) return;
    setDoneIds(new Set(doneIds).add(itemId));
    await markHomeworkDone(dog.id, itemId);
  }

  if (!session || !dog) return null;

  if (cards === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          No homework yet — it&apos;ll appear here as soon as your first report card is published.
        </Text>
      </View>
    );
  }

  const [current, ...older] = cards;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current homework</Text>
        <HomeworkCard
          card={current}
          doneIds={doneIds}
          onToggle={toggleItem}
          expanded
          pinned
        />
      </View>

      {older.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Homework library</Text>
          <View style={styles.list}>
            {older.map((card) => (
              <HomeworkCard
                key={card.id}
                card={card}
                doneIds={doneIds}
                onToggle={toggleItem}
                expanded={expandedId === card.id}
                onPressHeader={() => setExpandedId(expandedId === card.id ? null : card.id)}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function HomeworkCard({
  card,
  doneIds,
  onToggle,
  expanded,
  pinned,
  onPressHeader,
}: {
  card: ReportCard;
  doneIds: Set<string>;
  onToggle: (itemId: string) => void;
  expanded: boolean;
  pinned?: boolean;
  onPressHeader?: () => void;
}) {
  const doneCount = card.items.filter((i) => doneIds.has(i.id)).length;

  return (
    <View style={[styles.card, pinned && styles.cardPinned]}>
      <Pressable style={styles.cardHeader} onPress={onPressHeader} disabled={!onPressHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{card.title || "Session homework"}</Text>
          <Text style={styles.cardMeta}>
            {formatDate(card.sessionDate)} · {doneCount}/{card.items.length} practised
          </Text>
        </View>
        {onPressHeader && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.paperDim}
          />
        )}
      </Pressable>

      {expanded && (
        <View style={styles.cardBody}>
          {card.summary ? <Text style={styles.cardSummary}>{card.summary}</Text> : null}
          {card.items.map((item) => {
            const done = doneIds.has(item.id);
            return (
              <Pressable key={item.id} style={styles.itemRow} onPress={() => onToggle(item.id)}>
                <Ionicons
                  name={done ? "checkbox" : "square-outline"}
                  size={22}
                  color={done ? colors.accent : colors.paperDim}
                />
                <View style={styles.itemText}>
                  <Text style={[styles.itemName, done && styles.itemNameDone]}>{item.drillName}</Text>
                  {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 20,
    gap: 24,
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
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    overflow: "hidden",
  },
  cardPinned: {
    borderColor: colors.accent,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
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
    gap: 10,
  },
  cardSummary: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(245,242,234,0.85)",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 12,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  itemNameDone: {
    color: colors.paperDim,
  },
  itemNote: {
    marginTop: 2,
    fontSize: 12,
    color: colors.paperDim,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
    textAlign: "center",
  },
});
