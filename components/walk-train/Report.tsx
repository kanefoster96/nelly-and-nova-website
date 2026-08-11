import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import { ImageCard } from "../ui/ImageCard";
import { media } from "@/config/media";
import { walkTrainPage } from "@/config/site";

export function Report() {
  const { eyebrow, titleLines, paragraphs } = walkTrainPage.report;
  return (
    <section className="bg-ink py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <SectionHeading size="xl" eyebrow={eyebrow} lines={titleLines} />

        <div className="mt-6 space-y-5 text-paper/80">
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={0.05 * i}>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-sm">
          <ImageCard
            src={media.walkTrain.report}
            alt="A phone showing a Nelly & Nova training report card"
            aspect="aspect-[4/5]"
            sizes="(min-width: 640px) 24rem, 100vw"
          />
        </Reveal>
      </div>
    </section>
  );
}
