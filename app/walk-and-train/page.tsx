import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reviews } from "@/components/Reviews";
import { Marquee } from "@/components/ui/Marquee";
import { Intro } from "@/components/walk-train/Intro";
import { Van } from "@/components/walk-train/Van";
import { Report } from "@/components/walk-train/Report";
import { MeetGreet } from "@/components/walk-train/MeetGreet";

export const metadata: Metadata = {
  title: "Walk & Train",
  description:
    "Full-day Walk & Train sessions: real-world training, safe transport, detailed report cards and a free meet & greet across Tynemouth, Backworth and the North East.",
};

export default function WalkAndTrainPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Intro />
        <Marquee />
        <Van />
        <Report />
        <MeetGreet />
        <Reviews />
      </main>
      <Footer />
    </>
  );
}
