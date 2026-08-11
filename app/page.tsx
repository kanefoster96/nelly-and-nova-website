import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { WeUnderstand } from "@/components/WeUnderstand";
import { WhatWeDo } from "@/components/WhatWeDo";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <WeUnderstand />
        <WhatWeDo />
        {/* Next sections will be added here, top to bottom. */}
      </main>
      <Footer />
    </>
  );
}
