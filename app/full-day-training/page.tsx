import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reviews } from "@/components/Reviews";
import { Marquee } from "@/components/ui/Marquee";
import { ContentSection } from "@/components/ContentSection";
import { media } from "@/config/media";
import { walkTrainPage } from "@/config/site";

export const metadata: Metadata = {
  title: "Full Day Training",
  description:
    "Full Day Training sessions: real-world training, safe transport, detailed report cards and a free meet & greet across Tynemouth, Backworth and the North East.",
};

export default function FullDayTrainingPage() {
  const { intro, van, report, meetGreet } = walkTrainPage;
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <ContentSection
          first
          as="h1"
          align="center"
          size="md"
          imagePosition="afterTitle"
          eyebrow={intro.eyebrow}
          titleLines={intro.titleLines}
          paragraphs={intro.paragraphs}
          imageSrc={media.walkTrain.hero}
          imageAlt="Nelly & Nova training van in a field"
          imageAspect="aspect-[16/10]"
          priority
        />

        <Marquee />

        <ContentSection
          size="xl"
          eyebrow={van.eyebrow}
          titleLines={van.titleLines}
          paragraphs={van.paragraphs}
          imageSrc={media.walkTrain.van}
          imageAlt="A dog travelling safely in a transport crate"
        />

        <ContentSection
          size="xl"
          eyebrow={report.eyebrow}
          titleLines={report.titleLines}
          paragraphs={report.paragraphs}
          imageSrc={media.walkTrain.report}
          imageAlt="A phone showing a Nelly & Nova training report card"
          imageAspect="aspect-[4/5]"
          imageMaxWidth="max-w-sm"
        />

        <ContentSection
          align="center"
          size="md"
          eyebrow={meetGreet.eyebrow}
          titleLines={meetGreet.titleLines}
          paragraphs={meetGreet.paragraphs}
          imageSrc={media.walkTrain.meetGreet}
          imageAlt="Two Nelly & Nova trainers with their dogs on a woodland path"
          imageAspect="aspect-[16/11]"
          cta
        />

        <Reviews />
      </main>
      <Footer />
    </>
  );
}
