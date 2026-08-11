import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { WeUnderstand } from "@/components/WeUnderstand";
import { WhatWeDo } from "@/components/WhatWeDo";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <WeUnderstand />
        <WhatWeDo />
        <HowItWorks />
        {/* Next sections will be added here, top to bottom. */}
      </main>
      <Footer />
    </>
  );
}
