import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reviews } from "@/components/Reviews";
import { Marquee } from "@/components/ui/Marquee";
import { ContentSection } from "@/components/ContentSection";
import { media } from "@/config/media";
import { onlineTrainingPage } from "@/config/site";

export const metadata: Metadata = {
  title: "Online Training",
  description:
    "Online dog training from Nelly & Nova — £25 a week. We learn your dog and your goal, teach you the communication, lead handling, socialisation and management skills to get there, and you can message us any time.",
};

export default function OnlineTrainingPage() {
  const { intro, review, support, start } = onlineTrainingPage;
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
          imageSrc={media.onlineTraining.hero}
          imageAlt="An owner training their dog on a woodland walk"
          imageAspect="aspect-[16/10]"
          priority
        />

        <Marquee />

        <ContentSection
          size="xl"
          eyebrow={review.eyebrow}
          titleLines={review.titleLines}
          paragraphs={review.paragraphs}
          imageSrc={media.onlineTraining.review}
          imageAlt="A dog focused on its owner during training"
          imageAspect="aspect-[4/5]"
        />

        <ContentSection
          size="xl"
          eyebrow={support.eyebrow}
          titleLines={support.titleLines}
          paragraphs={support.paragraphs}
          imageSrc={media.onlineTraining.support}
          imageAlt="A phone showing a Nelly & Nova training report card"
          imageAspect="aspect-[4/5]"
          imageMaxWidth="max-w-sm"
        />

        <ContentSection
          align="center"
          size="md"
          eyebrow={start.eyebrow}
          titleLines={start.titleLines}
          paragraphs={start.paragraphs}
          imageSrc={media.onlineTraining.start}
          imageAlt="Three dogs sitting together on a path"
          imageAspect="aspect-[16/11]"
          cta
          ctaLabel="Get Started"
          ctaHref="/book?service=online-training"
        />

        <Reviews />
      </main>
      <Footer />
    </>
  );
}
