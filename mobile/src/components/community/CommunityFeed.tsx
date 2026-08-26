import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Composer } from "@/components/community/Composer";
import { PostCard } from "@/components/community/PostCard";
import { addComment, createPost, getFeed, setLike, type Post } from "@/lib/community";
import { colors } from "@/theme/colors";

/**
 * The community feed — shared by the customer app's Home tab and the coach
 * app's Home tab (the coach can always post, per `posts` RLS's `is_admin()`
 * clause). `headerExtra` lets the coach app slot a broadcast composer above
 * the feed without this component knowing anything about it.
 */
export function CommunityFeed({
  canPost,
  ownerName,
  avatarUrl,
  headerExtra,
}: {
  canPost: boolean;
  ownerName?: string;
  avatarUrl?: string;
  headerExtra?: React.ReactNode;
}) {
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
        <View>
          {headerExtra}
          {canPost && (
            <View style={styles.composerWrap}>
              <Composer ownerName={ownerName ?? ""} avatarUrl={avatarUrl} onSubmit={submitPost} />
            </View>
          )}
        </View>
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
