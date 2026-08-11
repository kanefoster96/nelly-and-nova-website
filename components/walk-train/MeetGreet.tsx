import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";
import { ImageCard } from "../ui/ImageCard";
import { Button } from "../ui/Button";
import { ArrowRightIcon } from "../ui/Icons";
import { media } from "@/config/media";
import { walkTrainPage, BOOKING_HREF, CONTACT_HREF } from "@/config/site";

export function MeetGreet() {
  const { eyebrow, titleLines, paragraphs } = walkTrainPage.meetGreet;
  return (
    <section className="bg-ink py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <SectionHeading
          align="center"
          size="md"
          eyebrow={eyebrow}
          lines={titleLines}
        />

        <div className="mt-6 space-y-5 text-paper/80">
          {paragraphs.map((p, i) => (
            <Reveal key={i} delay={0.05 * i}>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-10">
          <ImageCard
            src={media.walkTrain.meetGreet}
            alt="Two Nelly & Nova trainers with their dogs on a woodland path"
            aspect="aspect-[16/11]"
          />
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Button href={BOOKING_HREF} radius="xl" size="lg">
              Book a Free Visit
            </Button>
            <Button href={CONTACT_HREF} variant="ghost">
              Contact Us
              <ArrowRightIcon width={18} height={18} />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
