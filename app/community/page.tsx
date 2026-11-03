import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CommunityFeed } from "@/components/community/CommunityFeed";

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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Community</p>
            <h1 className="display-heading mt-2 text-3xl text-paper sm:text-4xl">
              What&apos;s happening at Nelly &amp; Nova
            </h1>
            <p className="mt-3 text-paper/70">
              Share wins, photos and videos of your dogs with the rest of the Nelly &amp; Nova pack.
            </p>

            <div className="mt-8">
              <CommunityFeed />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
