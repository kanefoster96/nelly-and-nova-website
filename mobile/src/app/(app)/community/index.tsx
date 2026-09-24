import { PostCard } from "@/components/PostCard";
import { Screen } from "@/components/Screen";
import { EmptyState, Loading } from "@/components/ui";
import { getFeed, setLiked } from "@/data/community";
import { useAsync } from "@/lib/useAsync";

export default function Community() {
  const { data: posts, loading, reload, setData } = useAsync(getFeed);

  function toggleLike(id: string) {
    setData((prev) =>
      prev?.map((p) => {
        if (p.id !== id) return p;
        const liked = !p.likedByMe;
        setLiked(id, liked);
        return { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) };
      })
    );
  }

  return (
    <Screen refreshing={loading && !!posts} onRefresh={reload}>
      {!posts ? <Loading /> : posts.length === 0 ? <EmptyState title="No posts yet" /> : null}
      {posts?.map((post) => <PostCard key={post.id} post={post} onToggleLike={() => toggleLike(post.id)} />)}
    </Screen>
  );
}
