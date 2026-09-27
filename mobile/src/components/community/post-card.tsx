import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { MediaGrid } from "@/components/community/media-grid";
import { Tag } from "@/components/ui";
import {
  REPORT_REASONS,
  addComment,
  blockUser,
  deleteComment,
  deletePost,
  postTimeLabel,
  reportContent,
  setLiked,
  updateComment,
  updatePost,
  type Comment,
  type Post,
  type ReportReason,
} from "@/data/community";
import { colors } from "@/theme";

import type { Viewer } from "./feed-screen";

const BODY_TRUNCATE_LENGTH = 220;
const LIKE_RED = "#ed4956";
const COMMENT_PREVIEW_COUNT = 2;

type MenuTarget = { postId: string } | { commentId: string };

/**
 * The options sheet on a post or comment: your own gets Edit/Delete; someone
 * else's gets Report and Block (plus Delete for a trainer).
 */
function showContentMenu(opts: {
  target: MenuTarget;
  authorId: string;
  authorName: string;
  isMine: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onBlocked: () => void;
}) {
  const noun = "postId" in opts.target ? "post" : "comment";
  const first = opts.authorName.split(" ")[0];

  async function sendReport(reason: ReportReason) {
    try {
      await reportContent(opts.target, reason);
      Alert.alert("Thanks", "The Nelly & Nova team will take a look within 24 hours.");
    } catch (err) {
      Alert.alert("Couldn't send the report", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function report() {
    Alert.alert(`Report this ${noun}`, "Why are you reporting it? The team will take a look.", [
      ...REPORT_REASONS.map((r) => ({ text: r.label, onPress: () => sendReport(r.value) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function block() {
    Alert.alert(`Block ${opts.authorName}?`, "You won't see their posts or comments any more. They won't be told.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockUser(opts.authorId).catch(() => undefined);
          opts.onBlocked();
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

  const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
  if (opts.isMine && opts.onEdit) buttons.push({ text: "Edit", onPress: opts.onEdit });
  if (!opts.isMine) {
    buttons.push({ text: "Report", onPress: report });
    buttons.push({ text: `Block ${first}`, onPress: block });
  }
  if (opts.canDelete) buttons.push({ text: "Delete", style: "destructive", onPress: remove });
  buttons.push({ text: "Cancel", style: "cancel" });

  Alert.alert(noun === "post" ? "Post options" : "Comment options", undefined, buttons);
}

/** Instagram-style: a bare heart that fills red when it's yours, with the count beside it. */
function LikeButton({ postId, likeCount, likedByMe }: { postId: string; likeCount: number; likedByMe: boolean }) {
  const [liked, setLikedState] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);

  async function handlePress() {
    const next = !liked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedState(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await setLiked(postId, next);
    } catch {
      setLikedState(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityLabel={liked ? "Unlike" : "Like"}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6 }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? LIKE_RED : colors.foreground} />
      {count > 0 && <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{count}</Text>}
    </Pressable>
  );
}

/** Editing your own words in place — title and body, nothing else. */
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
    } catch (err) {
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
 * Under a post: a two-comment preview (plus "View all N"), and once the
 * speech bubble or "View all" is tapped, every comment with the box to write one.
 */
function CommentsSection({
  viewer,
  postId,
  comments,
  onChange,
  open,
  onOpen,
  onBlocked,
}: {
  viewer: Viewer;
  postId: string;
  comments: Comment[];
  onChange: (update: (prev: Comment[]) => Comment[]) => void;
  open: boolean;
  onOpen: () => void;
  onBlocked: (authorId: string) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    setSending(true);
    try {
      const comment = await addComment(viewer, postId, body);
      onChange((prev) => [...prev, comment]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your comment.");
    } finally {
      setSending(false);
    }
  }

  function openMenu(c: Comment) {
    showContentMenu({
      target: { commentId: c.id },
      authorId: c.authorId,
      authorName: c.authorName,
      isMine: !!c.isMine,
      canDelete: !!c.canDelete,
      onEdit: () => setEditingId(c.id),
      onDelete: () => {
        onChange((prev) => prev.filter((x) => x.id !== c.id));
        deleteComment(c.id).catch(() => undefined);
      },
      onBlocked: () => {
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
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
                {c.authorName}
                {c.edited && <Text style={{ color: colors.muted, fontWeight: "400" }}>  edited</Text>}
              </Text>
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
              style={({ pressed }) => [{ width: 38, alignItems: "center", justifyContent: "center" }, (sending || !text.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
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
  onAuthorBlocked,
}: {
  viewer: Viewer;
  post: Post;
  onDeleted: (postId: string) => void;
  onAuthorBlocked: (authorId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [text, setText] = useState({ title: post.title ?? "", body: post.body });
  const [comments, setComments] = useState(post.comments);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const isLong = text.body.length > BODY_TRUNCATE_LENGTH;
  const shownBody = expanded || !isLong ? text.body : text.body.slice(0, BODY_TRUNCATE_LENGTH).trimEnd() + "…";

  function openMenu() {
    showContentMenu({
      target: { postId: post.id },
      authorId: post.authorId,
      authorName: post.authorName,
      isMine: !!post.isMine,
      canDelete: !!post.canDelete,
      onEdit: () => setEditingPost(true),
      onDelete: async () => {
        setDeleting(true);
        try {
          await deletePost(post.id);
          onDeleted(post.id);
        } catch {
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
    // its own text, so photos run right to the screen edges.
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <AvatarCircle name={post.authorName} avatarUrl={post.authorAvatarUrl} size={38} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{post.authorName}</Text>
              {post.authorIsTrainer && <Tag label="Official" solid />}
              {post.pinned && <Tag label="Pinned" />}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              {postTimeLabel(post.createdAt)}
              {post.authorDogs?.length ? ` · ${post.authorDogs.map((d) => `${d.name} L${d.level}`).join(" · ")}` : ""}
            </Text>
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
                <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 4 }}>{expanded ? "See Less" : "See More"}</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      <MediaGrid media={post.media} />

      {/* Heart, then the speech bubble that opens (or closes) the comment box. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12, paddingHorizontal: 16 }}>
        <LikeButton postId={post.id} likeCount={post.likeCount} likedByMe={post.likedByMe} />
        <Pressable
          onPress={() => setCommentsOpen((v) => !v)}
          hitSlop={8}
          accessibilityLabel={commentsOpen ? "Hide comments" : "Comment"}
          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6 }, pressed && { opacity: 0.6 }]}
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
          onOpen={() => setCommentsOpen(true)}
          onBlocked={onAuthorBlocked}
        />
      </View>
    </View>
  );
}
