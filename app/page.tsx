import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { WalkAndTrain } from "@/components/WalkAndTrain";
import { OneToOne } from "@/components/OneToOne";
import { AreasCovered } from "@/components/AreasCovered";
import { Testimonials } from "@/components/Testimonials";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <About />
        <WalkAndTrain />
        <OneToOne />
        <AreasCovered />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
