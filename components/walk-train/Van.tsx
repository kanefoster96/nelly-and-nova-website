import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import { ImageCard } from "../ui/ImageCard";
import { media } from "@/config/media";
import { walkTrainPage } from "@/config/site";

export function Van() {
  const { eyebrow, titleLines, paragraphs } = walkTrainPage.van;
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

        <Reveal delay={0.1} className="mt-10">
          <ImageCard
            src={media.walkTrain.van}
            alt="A dog travelling safely in a transport crate"
            aspect="aspect-[4/3]"
          />
        </Reveal>
      </div>
    </section>
  );
}
