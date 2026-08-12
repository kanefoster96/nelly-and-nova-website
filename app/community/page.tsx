import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { sampleCommunityPosts } from "@/lib/community/sample";

export const metadata: Metadata = {
  title: "Community",
  description: "Share wins, photos and videos with the Nelly & Nova pack.",
  robots: { index: false, follow: false },
};

export default function CommunityPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h1 className="display-heading text-3xl text-paper sm:text-4xl">Community</h1>
            <p className="mt-3 text-paper/70">
              Share your wins, photos and videos, ask questions and cheer each other on.
            </p>

            <div className="mt-8">
              <CommunityFeed initial={sampleCommunityPosts} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
