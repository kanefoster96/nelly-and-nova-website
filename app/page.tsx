import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { WeUnderstand } from "@/components/WeUnderstand";
import { WhatWeDo } from "@/components/WhatWeDo";
import { HowItWorks } from "@/components/HowItWorks";
import { Faq } from "@/components/Faq";
import { Reviews } from "@/components/Reviews";
import { Footer } from "@/components/Footer";
import { HomeGate } from "@/components/HomeGate";
import { getWeekSchedule } from "@/lib/schedule/data";
import { getGoogleReviews } from "@/lib/reviews/google";
import { sampleCommunityPosts } from "@/lib/community/sample";

export default async function Home() {
  // Dogs with a scheduled slot — a logged-in member whose dog is on the roster
  // gets the community home instead of the marketing page (decided client-side).
  const [week, googleReviews] = await Promise.all([getWeekSchedule(), getGoogleReviews()]);
  const scheduledDogIds = week.flatMap((d) => d.dogs.map((dog) => dog.id));

  return (
    <>
      <Nav />
      <HomeGate scheduledDogIds={scheduledDogIds} posts={sampleCommunityPosts}>
        <main id="main" className="flex-1">
          <Hero />
          <WeUnderstand />
          <WhatWeDo />
          <HowItWorks />
          <Faq />
          {/* Real Google reviews when connected; the sample ones until then. */}
          <Reviews items={googleReviews.length > 0 ? googleReviews : undefined} />
        </main>
        <Footer />
      </HomeGate>
    </>
  );
}
