import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import { ImageCard } from "../ui/ImageCard";
import { media } from "@/config/media";
import { walkTrainPage } from "@/config/site";

export function Intro() {
  const { eyebrow, titleLines, paragraphs } = walkTrainPage.intro;
  return (
    <section className="bg-ink pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <SectionHeading
          as="h1"
          align="center"
          size="md"
          eyebrow={eyebrow}
          lines={titleLines}
        />

        <Reveal delay={0.05} className="mt-10">
          <ImageCard
            src={media.walkTrain.hero}
            alt="Nelly & Nova training van in a field"
            aspect="aspect-[16/10]"
            priority
          />
        </Reveal>

        <div className="mt-10 space-y-5 text-center text-paper/80">
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={0.05 * i}>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
