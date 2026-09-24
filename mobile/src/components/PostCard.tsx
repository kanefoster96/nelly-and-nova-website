import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Card, Pill } from "@/components/ui";
import type { Post } from "@/data/community";
import { formatTime } from "@/data/inbox";
import { mediaUrl } from "@/lib/media";
import { colors, radius, space } from "@/theme";

export function PostCard({ post, onToggleLike }: { post: Post; onToggleLike: () => void }) {
  return (
    <Card>
      <View style={styles.header}>
        <Avatar uri={post.authorAvatarUrl} name={post.authorName} />
        <View style={styles.headerText}>
          <Text style={styles.author}>{post.authorName}</Text>
          <Text style={styles.time}>{formatTime(post.createdAt)}</Text>
        </View>
      </View>
      {post.authorDogs?.length ? (
        <View style={styles.badges}>
          {post.authorDogs.map((d) => (
            <Pill key={d.name} label={`${d.name} · Level ${d.level}`} />
          ))}
        </View>
      ) : null}
      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
      <Text style={styles.body}>{post.body}</Text>
      {post.media.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.media}>
          {post.media.map((m) => (
            <Image key={m.url} source={mediaUrl(m.url)} style={styles.image} contentFit="cover" transition={150} />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          hitSlop={8}
          style={styles.action}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleLike();
          }}
          accessibilityLabel={post.likedByMe ? "Unlike" : "Like"}
        >
          <SymbolView
            name={post.likedByMe ? { ios: "heart.fill", android: "favorite" } : { ios: "heart", android: "favorite_border" }}
            tintColor={post.likedByMe ? "#ff5a5f" : colors.paperDim}
            size={20}
          />
          <Text style={styles.count}>{post.likeCount}</Text>
        </Pressable>
        <View style={styles.action}>
          <SymbolView name={{ ios: "bubble.right", android: "chat_bubble_outline" }} tintColor={colors.paperDim} size={20} />
          <Text style={styles.count}>{post.comments.length}</Text>
        </View>
      </View>
      {post.comments.slice(0, 2).map((c) => (
        <View key={c.id} style={styles.comment}>
          <Text style={styles.commentAuthor}>{c.authorName}</Text>
          <Text style={styles.body}>{c.body}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headerText: { flex: 1 },
  author: { color: colors.paper, fontSize: 16, fontWeight: "600" },
  time: { color: colors.paperDim, fontSize: 12 },
  badges: { flexDirection: "row", gap: space.xs, flexWrap: "wrap" },
  title: { color: colors.paper, fontSize: 18, fontWeight: "700" },
  body: { color: colors.paper, fontSize: 15, lineHeight: 21 },
  media: { gap: space.sm },
  image: { width: 260, height: 200, borderRadius: radius.md, backgroundColor: colors.inkSoft },
  actions: { flexDirection: "row", gap: space.lg, paddingTop: space.xs },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  count: { color: colors.paperDim, fontSize: 14 },
  comment: { backgroundColor: colors.inkSoft, borderRadius: radius.md, padding: space.sm, gap: 2 },
  commentAuthor: { color: colors.paperDim, fontSize: 13, fontWeight: "600" },
});
