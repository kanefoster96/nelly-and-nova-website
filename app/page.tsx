import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        {/* Page sections will be added here, top to bottom. */}
      </main>
      <Footer />
    </>
  );
}
