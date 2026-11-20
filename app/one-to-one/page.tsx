import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reviews } from "@/components/Reviews";
import { Marquee } from "@/components/ui/Marquee";
import { ContentSection } from "@/components/ContentSection";
import { media } from "@/config/media";
import { oneToOnePage, priceText, schedule } from "@/config/site";

export const metadata: Metadata = {
  title: "1-1 Training",
  description: `1-1 dog training across the North East: a hands-on hour with you and your dog, ${schedule.days}, with a written report in our app. ${priceText.oneToOne}, or ${priceText.oneToOneMember} for members, weekly or fortnightly.`,
};

export default function OneToOnePage() {
  const { intro, understand, report, consultation } = oneToOnePage;
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
          imageSrc={media.oneToOne.hero}
          imageAlt="Nelly & Nova trainers with their dogs"
          imageAspect="aspect-[16/10]"
          priority
        />

        <Marquee />

        <ContentSection
          size="xl"
          eyebrow={understand.eyebrow}
          titleLines={understand.titleLines}
          paragraphs={understand.paragraphs}
          imageSrc={media.oneToOne.understand}
          imageAlt="A trainer working with a dog on a woodland walk"
          imageAspect="aspect-[4/5]"
        />

        <ContentSection
          size="xl"
          eyebrow={report.eyebrow}
          titleLines={report.titleLines}
          paragraphs={report.paragraphs}
          imageSrc={media.oneToOne.report}
          imageAlt="A phone showing a Nelly & Nova training report card"
          imageAspect="aspect-[4/5]"
          imageMaxWidth="max-w-sm"
        />

        <ContentSection
          align="center"
          size="md"
          eyebrow={consultation.eyebrow}
          titleLines={consultation.titleLines}
          paragraphs={consultation.paragraphs}
          imageSrc={media.oneToOne.consultation}
          imageAlt="A puppy running happily on a training walk"
          imageAspect="aspect-[16/11]"
          cta
          ctaLabel="Book a 1-1 Slot"
          ctaHref="/book?service=one-to-one"
        />

        <Reviews />
      </main>
      <Footer />
    </>
  );
}
