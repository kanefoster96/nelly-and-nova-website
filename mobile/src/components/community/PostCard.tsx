import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Avatar } from "@/components/Avatar";
import type { Post } from "@/lib/community";
import { colors } from "@/theme/colors";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deterministic "11 Aug 2026 · 08:20" from an ISO string — matches the website. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${yr} · ${hh}:${mm}`;
}

const BODY_LIMIT = 220;
const H_PADDING = 16;

export function PostCard({
  post,
  onToggleLike,
  onComment,
}: {
  post: Post;
  onToggleLike: (liked: boolean) => void;
  onComment: (body: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const { width } = useWindowDimensions();

  const long = post.body.length > BODY_LIMIT;
  const shownBody = long && !showAll ? post.body.slice(0, BODY_LIMIT).trimEnd() + "…" : post.body;

  async function submitComment() {
    const body = commentText.trim();
    if (!body || sending) return;
    setSending(true);
    await onComment(body);
    setSending(false);
    setCommentText("");
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Text style={styles.when}>{formatWhen(post.createdAt)}</Text>
        </View>
      </View>

      {/* Body */}
      {post.body ? (
        <Text style={styles.body}>
          {shownBody}
          {long ? (
            <Text style={styles.seeMore} onPress={() => setShowAll((s) => !s)}>
              {"  "}
              {showAll ? "See less" : "See more"}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {/* Media — edge to edge, no side padding, no rounding */}
      <MediaGrid urls={post.media} width={width} />

      {/* Like */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => onToggleLike(!post.likedByMe)}
          style={styles.likeButton}
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
        >
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={18}
            color={post.likedByMe ? colors.accent : colors.paperDim}
          />
          <Text style={[styles.likeCount, post.likedByMe && styles.likeCountActive]}>
            {post.likeCount > 0 ? post.likeCount : "Like"}
          </Text>
        </Pressable>
      </View>

      {/* Comments */}
      {post.comments.length > 0 && (
        <Text style={styles.commentCount}>
          {post.comments.length} comment{post.comments.length === 1 ? "" : "s"}
        </Text>
      )}
      <View style={styles.comments}>
        {post.comments.map((c) => (
          <View key={c.id} style={styles.commentRow}>
            <Avatar uri={c.authorAvatar} name={c.authorName} size={28} />
            <View style={styles.commentBubble}>
              <Text style={styles.commentAuthor}>{c.authorName}</Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.commentForm}>
        <TextInput
          style={styles.commentInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Write a comment…"
          placeholderTextColor={colors.paperDim}
        />
        <Pressable onPress={submitComment} disabled={!commentText.trim() || sending} hitSlop={8}>
          <Text style={[styles.send, (!commentText.trim() || sending) && styles.sendDisabled]}>
            {sending ? "…" : "Send"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MediaGrid({ urls, width }: { urls: string[]; width: number }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return <Image source={{ uri: urls[0] }} style={{ width, height: width }} contentFit="cover" />;
  }

  const cell = width / 2;
  return (
    <View style={styles.grid}>
      {urls.map((url, i) => (
        <Image key={i} source={{ uri: url }} style={{ width: cell, height: cell }} contentFit="cover" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: H_PADDING,
  },
  headerText: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  when: {
    marginTop: 1,
    fontSize: 12,
    color: colors.paperDim,
  },
  body: {
    paddingHorizontal: H_PADDING,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(245,242,234,0.9)",
  },
  seeMore: {
    fontWeight: "600",
    color: colors.accent,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  likeCountActive: {
    color: colors.accent,
  },
  commentCount: {
    paddingHorizontal: H_PADDING,
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  comments: {
    paddingHorizontal: H_PADDING,
    gap: 10,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
  },
  commentBubble: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paper,
  },
  commentBody: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(245,242,234,0.85)",
  },
  commentForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: H_PADDING,
  },
  commentInput: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.paper,
  },
  send: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.paper,
  },
  sendDisabled: {
    color: colors.paperDim,
  },
});
