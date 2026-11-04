import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { MediaGrid } from "@/components/community/media-grid";
import { VerifiedTick } from "@/components/community/verified-tick";
import { Pressable } from "@/components/pressable";
import {
  REPORT_REASONS,
  addComment,
  acceptGuidelines,
  blockUser,
  deleteComment,
  deletePost,
  reportContent,
  setLiked,
  setPinned,
  updateComment,
  updatePost,
  type Comment,
  type Post,
  type ReportReason,
  type Viewer,
} from "@/data/community";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

const BODY_TRUNCATE_LENGTH = 220;
const LIKE_RED = "#ed4956";
const COMMENT_PREVIEW_COUNT = 2;

type Choice = { text: string; style?: "destructive"; onPress: () => void };

/**
 * "Pick one of these" as a system alert, with a Cancel (the Kanvas app's
 * chooseOne). iOS lists every choice; Android's alert only has room for
 * three buttons, so there it shows two at a time with "More…".
 */
function chooseOne(title: string, message: string | undefined, choices: Choice[]) {
  if (Platform.OS !== "android") {
    Alert.alert(title, message, [...choices, { text: "Cancel", style: "cancel" }]);
    return;
  }
  const page = choices.slice(0, 2);
  const rest = choices.slice(2);
  Alert.alert(
    title,
    message,
    rest.length > 0
      ? [...page, { text: "More…", onPress: () => chooseOne(title, message, rest) }]
      : [...page, { text: "Cancel", style: "cancel" }],
    { cancelable: true }
  );
}

type MenuTarget = { postId: string } | { commentId: string };

/**
 * The options sheet on a post or comment, built from native alerts: your own
 * gets Edit and Delete; someone else's gets Report and Block (plus Delete
 * for a trainer, and Pin on posts). Report asks for a reason and sends it
 * straight to the trainers; Block asks first, then hides that member.
 */
function showContentMenu(opts: {
  viewer: Viewer;
  target: MenuTarget;
  authorId: string;
  authorName: string;
  authorIsTrainer: boolean;
  isMine: boolean;
  canDelete: boolean;
  pinned?: boolean;
  onEdit?: () => void;
  onTogglePin?: () => void;
  onDelete: () => void;
  onBlocked: () => void;
}) {
  const noun = "postId" in opts.target ? "post" : "comment";
  const first = opts.authorName.split(" ")[0];

  async function sendReport(reason: ReportReason) {
    try {
      await reportContent(opts.target, reason);
      hapticSuccess();
      Alert.alert("Thanks", "A trainer will take a look within 24 hours.");
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't send the report", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function report() {
    chooseOne(
      `Report this ${noun}`,
      "Why are you reporting it? A trainer will take a look.",
      REPORT_REASONS.map((r) => ({ text: r.label, onPress: () => sendReport(r.value) }))
    );
  }

  function block() {
    Alert.alert(`Block ${opts.authorName}?`, "You won't see their posts or comments any more. They won't be told.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(opts.viewer.id, opts.authorId);
            hapticSuccess();
            opts.onBlocked();
          } catch (err) {
            hapticError();
            Alert.alert("Couldn't block", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  function remove() {
    Alert.alert(`Delete this ${noun}?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: opts.onDelete },
    ]);
  }

  const choices: Choice[] = [];
  if (opts.isMine && opts.onEdit) choices.push({ text: "Edit", onPress: opts.onEdit });
  if (opts.viewer.isTrainer && opts.onTogglePin) choices.push({ text: opts.pinned ? "Unpin" : "Pin to top", onPress: opts.onTogglePin });
  if (!opts.isMine) {
    choices.push({ text: "Report", onPress: report });
    if (!opts.authorIsTrainer) choices.push({ text: `Block ${first}`, onPress: block });
  }
  if (opts.canDelete) choices.push({ text: "Delete", style: "destructive", onPress: remove });

  chooseOne(noun === "post" ? "Post options" : "Comment options", undefined, choices);
}

/** Instagram-style: a bare heart that fills red when it's yours, with the count beside it. */
function LikeButton({ viewer, postId, likeCount, likedByMe }: { viewer: Viewer; postId: string; likeCount: number; likedByMe: boolean }) {
  const [liked, setLikedState] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);

  async function handlePress() {
    const next = !liked;
    hapticSelection();
    setLikedState(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await setLiked(viewer.id, postId, next);
    } catch {
      setLikedState(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <Pressable onPress={handlePress} hitSlop={8} accessibilityLabel={liked ? "Unlike" : "Like"} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? LIKE_RED : colors.foreground} />
      {count > 0 && <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{count}</Text>}
    </Pressable>
  );
}

/** The one-time Community Guidelines agreement row, shared by the composer and the comment box. */
export function GuidelinesAgreement({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onToggle();
      }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 }}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? colors.foreground : colors.muted} style={{ marginTop: -1 }} />
      <Text style={{ color: colors.muted, fontSize: 12, flex: 1, lineHeight: 17 }}>
        I agree to the{" "}
        <Text
          style={{ color: colors.foreground, textDecorationLine: "underline" }}
          onPress={() => router.push("/guidelines")}
        >
          Community Guidelines
        </Text>
        . Bullying, abuse, or anything unkind isn&apos;t tolerated and will be removed.
      </Text>
    </Pressable>
  );
}

/**
 * Editing text in place — your own comment, or a post's title and body.
 * Kept to the words: photos stay exactly as they were.
 */
function InlineEditor({
  initialValue,
  initialTitle,
  withTitle = false,
  placeholder,
  onSave,
  onCancel,
}: {
  initialValue: string;
  initialTitle?: string;
  withTitle?: boolean;
  placeholder: string;
  onSave: (body: string, title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unchanged = value.trim() === initialValue.trim() && title.trim() === (initialTitle ?? "").trim();
  const empty = !value.trim() && !title.trim();

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await onSave(value.trim(), title.trim());
      hapticSuccess();
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Could not save that edit.");
      setSaving(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.foreground,
    fontSize: 14,
    backgroundColor: colors.background,
  } as const;

  return (
    <View style={{ marginTop: 6, gap: 8 }}>
      {withTitle && (
        <TextInput value={title} onChangeText={setTitle} editable={!saving} placeholder="Title (optional)" placeholderTextColor={colors.muted} style={[inputStyle, { fontWeight: "600" }]} />
      )}
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!saving}
        multiline
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[inputStyle, { minHeight: 70, textAlignVertical: "top" }]}
      />
      {error && <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={save} disabled={saving || unchanged || empty} hitSlop={6}>
          {saving ? (
            <ActivityIndicator color={colors.foreground} size="small" />
          ) : (
            <Text style={{ color: unchanged || empty ? colors.muted : colors.accent, fontSize: 13, fontWeight: "700" }}>Save</Text>
          )}
        </Pressable>
        <Pressable onPress={onCancel} disabled={saving} hitSlop={6}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Under a post: nothing when there are no comments and the box is shut; a
 * two-comment preview (plus "View all N") when there are; and, once the
 * speech bubble or "View all" is tapped, every comment with the box to write one.
 */
function CommentsSection({
  viewer,
  postId,
  comments,
  onChange,
  open,
  onOpen,
  onGuidelinesAccepted,
  onBlocked,
}: {
  viewer: Viewer;
  postId: string;
  comments: Comment[];
  onChange: (update: (prev: Comment[]) => Comment[]) => void;
  open: boolean;
  onOpen: () => void;
  onGuidelinesAccepted: () => void;
  onBlocked: (authorId: string) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  // Which comment is open for editing, if any — your own only.
  const [editingId, setEditingId] = useState<string | null>(null);
  const guidelinesAccepted = viewer.guidelinesAccepted;

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    if (!guidelinesAccepted && !agree) {
      hapticWarning();
      setError("Please agree to the Community Guidelines first.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      if (!guidelinesAccepted) {
        await acceptGuidelines(viewer.id);
        onGuidelinesAccepted();
      }
      const comment = await addComment(viewer, postId, body);
      hapticSuccess();
      animateListChange();
      onChange((prev) => [...prev, comment]);
      setText("");
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Could not post your comment.");
    } finally {
      setSending(false);
    }
  }

  function openMenu(c: Comment) {
    showContentMenu({
      viewer,
      target: { commentId: c.id },
      authorId: c.authorId,
      authorName: c.authorName,
      authorIsTrainer: c.authorIsTrainer,
      isMine: c.isMine,
      canDelete: c.canDelete,
      onEdit: () => setEditingId(c.id),
      onDelete: () => {
        animateListChange();
        onChange((prev) => prev.filter((x) => x.id !== c.id));
        deleteComment(c.id).catch(() => undefined);
      },
      onBlocked: () => {
        animateListChange();
        onChange((prev) => prev.filter((x) => x.authorId !== c.authorId));
        onBlocked(c.authorId);
      },
    });
  }

  if (!open && comments.length === 0) return null;

  const shown = open ? comments : comments.slice(0, COMMENT_PREVIEW_COUNT);
  const hiddenCount = comments.length - shown.length;

  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      {shown.map((c) => (
        <Pressable key={c.id} onLongPress={() => openMenu(c)} delayLongPress={350} style={{ flexDirection: "row", gap: 8 }}>
          <AvatarCircle name={c.authorName} avatarUrl={c.authorAvatarUrl} size={28} />
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>
                  {c.authorName}
                </Text>
                {c.authorIsTrainer && <VerifiedTick size={13} />}
                {c.edited && (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, flexShrink: 1 }}>
                    {" edited"}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => openMenu(c)} hitSlop={10} accessibilityLabel="Comment options">
                <Ionicons name="ellipsis-horizontal" size={15} color={colors.muted} />
              </Pressable>
            </View>
            {editingId === c.id ? (
              <InlineEditor
                initialValue={c.body}
                placeholder="Write a comment…"
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  await updateComment(c.id, next);
                  onChange((prev) => prev.map((x) => (x.id === c.id ? { ...x, body: next, edited: true } : x)));
                  setEditingId(null);
                }}
              />
            ) : (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>{c.body}</Text>
            )}
          </View>
        </Pressable>
      ))}

      {!open && hiddenCount > 0 && (
        <Pressable onPress={onOpen} hitSlop={6}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>View all {comments.length} comments</Text>
        </Pressable>
      )}

      {open && (
        <>
          {error && <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>}

          {!guidelinesAccepted && <GuidelinesAgreement checked={agree} onToggle={() => setAgree((v) => !v)} />}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment…"
              placeholderTextColor={colors.muted}
              autoFocus={comments.length === 0}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
                color: colors.foreground,
                fontSize: 13,
                backgroundColor: colors.background,
              }}
            />
            <Pressable
              onPress={handleSend}
              disabled={sending || !text.trim()}
              hitSlop={6}
              accessibilityLabel="Send comment"
              style={[{ width: 38, alignItems: "center", justifyContent: "center" }, (sending || !text.trim()) && { opacity: 0.4 }]}
            >
              {sending ? <ActivityIndicator color={colors.foreground} size="small" /> : <Ionicons name="send" size={20} color={colors.foreground} />}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export function PostCard({
  viewer,
  post,
  onDeleted,
  onPinnedChange,
  onAuthorBlocked,
  onGuidelinesAccepted,
}: {
  viewer: Viewer;
  post: Post;
  onDeleted: (postId: string) => void;
  onPinnedChange: (postId: string, pinned: boolean) => void;
  /** Blocking hides every post by that author straight away; the database keeps them hidden after that. */
  onAuthorBlocked: (authorId: string) => void;
  onGuidelinesAccepted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Editing your own words in place — title and body, nothing else.
  const [editingPost, setEditingPost] = useState(false);
  const [text, setText] = useState({ title: post.title ?? "", body: post.body });
  // Comments live here so the count beside the speech bubble stays right.
  const [comments, setComments] = useState(post.comments);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const isLong = text.body.length > BODY_TRUNCATE_LENGTH;
  const shownBody = expanded || !isLong ? text.body : text.body.slice(0, BODY_TRUNCATE_LENGTH).trimEnd() + "…";

  function openMenu() {
    showContentMenu({
      viewer,
      target: { postId: post.id },
      authorId: post.authorId,
      authorName: post.authorName,
      authorIsTrainer: post.authorIsTrainer,
      isMine: post.isMine,
      canDelete: post.canDelete,
      pinned: post.pinned,
      onEdit: () => setEditingPost(true),
      onTogglePin: async () => {
        try {
          await setPinned(post.id, !post.pinned);
          hapticSuccess();
          onPinnedChange(post.id, !post.pinned);
        } catch (err) {
          hapticError();
          Alert.alert("Couldn't change the pin", err instanceof Error ? err.message : "Please try again.");
        }
      },
      onDelete: async () => {
        setDeleting(true);
        try {
          await deletePost(post.id);
          hapticSuccess();
          onDeleted(post.id);
        } catch {
          hapticError();
          setDeleting(false);
        }
      },
      onBlocked: () => onAuthorBlocked(post.authorId),
    });
  }

  if (deleting) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return (
    // Edge to edge, Instagram-style: the post owns the full width and pads
    // its own text, so photos and video run right to the screen edges.
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <AvatarCircle name={post.authorName} avatarUrl={post.authorAvatarUrl} size={38} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>
                  {post.authorName}
                </Text>
                {/* A trainer: the blue official tick, as on Instagram. */}
                {post.authorIsTrainer && <VerifiedTick size={15} />}
              </View>
              {post.pinned && (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 }}>
                  <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>PINNED</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{post.createdAtLabel}</Text>
          </View>
        </View>
        <Pressable onPress={openMenu} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {editingPost ? (
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <InlineEditor
            initialValue={text.body}
            initialTitle={text.title}
            withTitle
            placeholder="What's on your mind?"
            onCancel={() => setEditingPost(false)}
            onSave={async (nextBody, nextTitle) => {
              await updatePost(post.id, nextTitle, nextBody);
              setText({ title: nextTitle, body: nextBody });
              setEditingPost(false);
            }}
          />
        </View>
      ) : (
        <>
          {!!text.title && (
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 12, paddingHorizontal: 16 }}>{text.title}</Text>
          )}
          {!!text.body && (
            <View style={{ marginTop: text.title ? 4 : 12, paddingHorizontal: 16 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{shownBody}</Text>
              {isLong && (
                <Pressable
                  onPress={() => {
                    animateListChange();
                    setExpanded((v) => !v);
                  }}
                  hitSlop={6}
                >
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 4 }}>{expanded ? "See Less" : "See More"}</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      <MediaGrid
        media={post.media}
        caption={{ title: post.authorName, subtitle: post.createdAtLabel, body: [text.title, text.body].filter(Boolean).join("\n") }}
      />

      {/* Heart, then the speech bubble that opens (or closes) the comment box. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12, paddingHorizontal: 16 }}>
        <LikeButton viewer={viewer} postId={post.id} likeCount={post.likeCount} likedByMe={post.likedByMe} />
        <Pressable
          onPress={() => {
            animateListChange();
            setCommentsOpen((v) => !v);
          }}
          hitSlop={8}
          accessibilityLabel={commentsOpen ? "Hide comments" : "Comment"}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Ionicons name={commentsOpen ? "chatbubble" : "chatbubble-outline"} size={24} color={colors.foreground} />
          {comments.length > 0 && <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{comments.length}</Text>}
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <CommentsSection
          viewer={viewer}
          postId={post.id}
          comments={comments}
          onChange={setComments}
          open={commentsOpen}
          onOpen={() => {
            animateListChange();
            setCommentsOpen(true);
          }}
          onGuidelinesAccepted={onGuidelinesAccepted}
          onBlocked={onAuthorBlocked}
        />
      </View>
    </View>
  );
}
