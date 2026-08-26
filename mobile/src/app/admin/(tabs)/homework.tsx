import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addTextBlock,
  createCategory,
  createDrill,
  deleteBlock,
  deleteDrill,
  getCategories,
  getDrillBlocks,
  getDrills,
  moveBlock,
  updateBlockText,
  type DrillBlock,
  type LibraryCategory,
  type LibraryDrill,
  type Pillar,
} from "@/lib/drillLibrary";
import { colors } from "@/theme/colors";

const PILLARS: { id: Pillar; label: string }[] = [
  { id: "engagement", label: "Engagement" },
  { id: "skills", label: "Skills" },
  { id: "mindset", label: "Mindset" },
];

type ScreenView =
  | { level: "pillars" }
  | { level: "categories"; pillar: Pillar }
  | { level: "drills"; category: LibraryCategory }
  | { level: "drill"; category: LibraryCategory; drill: LibraryDrill };

/**
 * Drill library editor: pillar -> category -> drills (by level) -> a drill's
 * text blocks. Real `library_categories`/`library_drills`/
 * `library_drill_blocks` tables. Text-only blocks (heading/paragraph) for
 * now — the mobile app has no image picker since the earlier simplification
 * pass, so photo/video blocks aren't creatable from here yet.
 */
export default function AdminHomeworkScreen() {
  const [view, setView] = useState<ScreenView>({ level: "pillars" });
  const [categories, setCategories] = useState<LibraryCategory[] | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  async function refreshCategories() {
    setCategories(await getCategories());
  }

  if (view.level === "pillars") {
    return (
      <View style={styles.screen}>
        <View style={styles.list}>
          {PILLARS.map((p) => {
            const count = (categories ?? []).filter((c) => c.pillar === p.id).length;
            return (
              <Pressable key={p.id} style={styles.pillarCard} onPress={() => setView({ level: "categories", pillar: p.id })}>
                <Text style={styles.pillarTitle}>{p.label}</Text>
                <Text style={styles.pillarMeta}>
                  {count} categor{count === 1 ? "y" : "ies"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.paperDim} style={styles.pillarChevron} />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (view.level === "categories") {
    const list = (categories ?? []).filter((c) => c.pillar === view.pillar);
    return (
      <CategoriesView
        pillar={view.pillar}
        categories={list}
        onBack={() => setView({ level: "pillars" })}
        onOpen={(c) => setView({ level: "drills", category: c })}
        onCreated={refreshCategories}
      />
    );
  }

  if (view.level === "drills") {
    return (
      <DrillsView
        category={view.category}
        onBack={() => setView({ level: "categories", pillar: view.category.pillar })}
        onOpen={(drill) => setView({ level: "drill", category: view.category, drill })}
      />
    );
  }

  return (
    <DrillDetailView
      drill={view.drill}
      onBack={() => setView({ level: "drills", category: view.category })}
    />
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <Ionicons name="chevron-back" size={20} color={colors.paper} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function CategoriesView({
  pillar,
  categories,
  onBack,
  onOpen,
  onCreated,
}: {
  pillar: Pillar;
  categories: LibraryCategory[];
  onBack: () => void;
  onOpen: (c: LibraryCategory) => void;
  onCreated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const { error } = await createCategory(pillar, name.trim());
    setSaving(false);
    if (!error) {
      setName("");
      setAdding(false);
      await onCreated();
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title={PILLARS.find((p) => p.id === pillar)?.label ?? pillar} onBack={onBack} />

      <View style={styles.list}>
        {categories.map((c) => (
          <Pressable key={c.id} style={styles.rowCard} onPress={() => onOpen(c)}>
            <Text style={styles.rowTitle}>{c.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.paperDim} />
          </Pressable>
        ))}
      </View>

      {adding ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={colors.paperDim}
            autoFocus
          />
          <View style={styles.addActions}>
            <Pressable onPress={() => setAdding(false)} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={!name.trim() || saving} hitSlop={8}>
              <Text style={styles.saveText}>{saving ? "Saving…" : "Add"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addPill} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={styles.addPillText}>Add category</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function DrillsView({
  category,
  onBack,
  onOpen,
}: {
  category: LibraryCategory;
  onBack: () => void;
  onOpen: (drill: LibraryDrill) => void;
}) {
  const [drills, setDrills] = useState<LibraryDrill[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [saving, setSaving] = useState(false);

  async function load() {
    setDrills(await getDrills(category.id));
  }

  useEffect(() => {
    let cancelled = false;
    getDrills(category.id).then((data) => {
      if (!cancelled) setDrills(data);
    });
    return () => {
      cancelled = true;
    };
  }, [category.id]);

  async function save() {
    const lvl = parseInt(level, 10);
    if (!name.trim() || Number.isNaN(lvl) || saving) return;
    setSaving(true);
    const { error } = await createDrill(category.id, name.trim(), Math.min(10, Math.max(1, lvl)));
    setSaving(false);
    if (!error) {
      setName("");
      setAdding(false);
      await load();
    }
  }

  async function remove(drillId: string) {
    await deleteDrill(drillId);
    await load();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title={category.name} onBack={onBack} />

      {drills === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={styles.list}>
          {drills.map((d) => (
            <View key={d.id} style={styles.drillRow}>
              <Pressable style={styles.drillRowBody} onPress={() => onOpen(d)}>
                <Text style={styles.levelBadge}>L{d.level}</Text>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {d.name}
                </Text>
              </Pressable>
              <Pressable onPress={() => remove(d.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.paperDim} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Drill name"
            placeholderTextColor={colors.paperDim}
            autoFocus
          />
          <TextInput
            style={styles.input}
            value={level}
            onChangeText={setLevel}
            placeholder="Level (1-10)"
            placeholderTextColor={colors.paperDim}
            keyboardType="number-pad"
          />
          <View style={styles.addActions}>
            <Pressable onPress={() => setAdding(false)} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={!name.trim() || saving} hitSlop={8}>
              <Text style={styles.saveText}>{saving ? "Saving…" : "Add"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addPill} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={styles.addPillText}>Add drill</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function DrillDetailView({ drill, onBack }: { drill: LibraryDrill; onBack: () => void }) {
  const [blocks, setBlocks] = useState<DrillBlock[] | null>(null);
  const [text, setText] = useState("");
  const [blockType, setBlockType] = useState<"heading" | "paragraph">("paragraph");
  const [saving, setSaving] = useState(false);

  async function load() {
    setBlocks(await getDrillBlocks(drill.id));
  }

  useEffect(() => {
    let cancelled = false;
    getDrillBlocks(drill.id).then((data) => {
      if (!cancelled) setBlocks(data);
    });
    return () => {
      cancelled = true;
    };
  }, [drill.id]);

  async function addBlock() {
    if (!text.trim() || saving) return;
    setSaving(true);
    await addTextBlock(drill.id, blockType, text.trim());
    setText("");
    setSaving(false);
    await load();
  }

  async function move(blockId: string, direction: "up" | "down") {
    if (!blocks) return;
    await moveBlock(blocks, blockId, direction);
    await load();
  }

  async function remove(blockId: string) {
    await deleteBlock(blockId);
    await load();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title={drill.name} onBack={onBack} />

      {blocks === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={styles.list}>
          {blocks.map((b, i) => (
            <View key={b.id} style={styles.blockCard}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockType}>{b.type}</Text>
                <View style={styles.blockActions}>
                  <Pressable onPress={() => move(b.id, "up")} disabled={i === 0} hitSlop={6}>
                    <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.border : colors.paperDim} />
                  </Pressable>
                  <Pressable onPress={() => move(b.id, "down")} disabled={i === blocks.length - 1} hitSlop={6}>
                    <Ionicons name="chevron-down" size={16} color={i === blocks.length - 1 ? colors.border : colors.paperDim} />
                  </Pressable>
                  <Pressable onPress={() => remove(b.id)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={16} color={colors.paperDim} />
                  </Pressable>
                </View>
              </View>
              {b.type === "heading" || b.type === "paragraph" ? (
                <TextInput
                  style={styles.blockInput}
                  value={b.text ?? ""}
                  onChangeText={(v) => setBlocks((bs) => (bs ?? []).map((x) => (x.id === b.id ? { ...x, text: v } : x)))}
                  onBlur={() => updateBlockText(b.id, b.text ?? "")}
                  multiline={b.type === "paragraph"}
                />
              ) : (
                <Text style={styles.blockUrl}>{b.url}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.addCard}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modePill, blockType === "heading" && styles.modePillActive]}
            onPress={() => setBlockType("heading")}
          >
            <Text style={[styles.modePillText, blockType === "heading" && styles.modePillTextActive]}>Heading</Text>
          </Pressable>
          <Pressable
            style={[styles.modePill, blockType === "paragraph" && styles.modePillActive]}
            onPress={() => setBlockType("paragraph")}
          >
            <Text style={[styles.modePillText, blockType === "paragraph" && styles.modePillTextActive]}>Paragraph</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, styles.blockInputAdd]}
          value={text}
          onChangeText={setText}
          placeholder={blockType === "heading" ? "Heading text" : "Paragraph text"}
          placeholderTextColor={colors.paperDim}
          multiline={blockType === "paragraph"}
        />
        <Pressable style={styles.addPill} onPress={addBlock}>
          <Ionicons name="add" size={18} color={colors.accent} />
          <Text style={styles.addPillText}>{saving ? "Adding…" : "Add block"}</Text>
        </Pressable>
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
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 14,
    color: colors.paper,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.paper,
  },
  list: {
    gap: 10,
  },
  pillarCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 18,
  },
  pillarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.paper,
  },
  pillarMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.paperDim,
  },
  pillarChevron: {
    position: "absolute",
    right: 18,
    top: "50%",
    marginTop: -9,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  drillRowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paper,
  },
  addCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
    gap: 10,
  },
  addActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  saveText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.paper,
  },
  blockCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 12,
    gap: 8,
  },
  blockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockType: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.paperDim,
  },
  blockActions: {
    flexDirection: "row",
    gap: 14,
  },
  blockInput: {
    fontSize: 14,
    color: colors.paper,
    padding: 0,
  },
  blockInputAdd: {
    minHeight: 44,
  },
  blockUrl: {
    fontSize: 12,
    color: colors.paperDim,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.paperDim,
  },
  modePillTextActive: {
    color: colors.accentInk,
  },
});
