import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Composer } from "@/components/community/Composer";
import { PostCard } from "@/components/community/PostCard";
import { addComment, createPost, getFeed, setLike, type Post } from "@/lib/community";
import { hasActiveMembership, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Home — the community feed (like a Facebook wall): every member's posts,
 * newest first. Viewing is open to anyone who reaches the customer app;
 * starting a post or commenting requires an active membership, enforced by
 * both the composer below and the "community_feed_access" RLS policies (see
 * lib/community.ts) — not just hidden in the UI.
 */
export default function HomeScreen() {
  const session = useSession();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setPosts(await getFeed());
  }

  useEffect(() => {
    let cancelled = false;
    getFeed().then((data) => {
      if (!cancelled) setPosts(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submitPost(body: string) {
    await createPost(body);
    await load();
  }

  async function onToggleLike(post: Post, liked: boolean) {
    // Optimistic — flip locally, then reconcile with the real state.
    setPosts((prev) =>
      (prev ?? []).map((p) =>
        p.id === post.id ? { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) } : p
      )
    );
    await setLike(post.id, liked);
    await load();
  }

  async function onComment(post: Post, body: string) {
    await addComment(post.id, body);
    await load();
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.ink }}
      data={posts ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onToggleLike={(liked) => void onToggleLike(item, liked)}
          onComment={(body) => onComment(item, body)}
        />
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper} />
      }
      ListHeaderComponent={
        hasActiveMembership(session) ? (
          <View style={styles.composerWrap}>
            <Composer ownerName={session!.ownerName} avatarUrl={session!.avatarUrl} onSubmit={submitPost} />
          </View>
        ) : null
      }
      ListEmptyComponent={
        posts === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              No posts yet — be the first to share something with the community.
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  centered: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
    textAlign: "center",
  },
});
