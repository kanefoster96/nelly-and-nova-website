import { Reveal } from "./ui/Reveal";
import { SectionHeading } from "./ui/SectionHeading";
import { ImageCard } from "./ui/ImageCard";
import { Button } from "./ui/Button";
import { ArrowRightIcon } from "./ui/Icons";
import { BOOKING_HREF, CONTACT_HREF } from "@/config/site";

type ContentSectionProps = {
  id?: string;
  eyebrow?: string;
  titleLines: string[];
  paragraphs: string[];
  imageSrc: string;
  imageAlt: string;
  imageAspect?: string;
  /** "afterTitle" puts the image between the heading and the text; "afterText" (default) below the text. */
  imagePosition?: "afterTitle" | "afterText";
  /** Constrain image width (e.g. a phone mockup): "max-w-sm". */
  imageMaxWidth?: string;
  align?: "left" | "center";
  size?: "md" | "xl";
  as?: "h1" | "h2";
  /** Show the Book a Free Visit + Contact Us buttons. */
  cta?: boolean;
  priority?: boolean;
  /** Extra top padding so the first section clears the fixed header. */
  first?: boolean;
};

export function ContentSection({
  id,
  eyebrow,
  titleLines,
  paragraphs,
  imageSrc,
  imageAlt,
  imageAspect = "aspect-[4/3]",
  imagePosition = "afterText",
  imageMaxWidth,
  align = "left",
  size = "md",
  as = "h2",
  cta = false,
  priority = false,
  first = false,
}: ContentSectionProps) {
  const image = (
    <Reveal
      delay={0.1}
      className={`mt-10 ${imageMaxWidth ? `mx-auto ${imageMaxWidth}` : ""}`}
    >
      <ImageCard
        src={imageSrc}
        alt={imageAlt}
        aspect={imageAspect}
        priority={priority}
        sizes={
          imageMaxWidth
            ? "(min-width: 640px) 24rem, 100vw"
            : "(min-width: 768px) 42rem, 100vw"
        }
      />
    </Reveal>
  );

  const text = (mt: string) => (
    <div className={`${mt} space-y-5 text-paper/80`}>
      {paragraphs.map((p, i) => (
        <Reveal key={i} delay={0.05 * i}>
          <p>{p}</p>
        </Reveal>
      ))}
    </div>
  );

  return (
    <section
      id={id}
      className={`bg-ink ${
        first ? "pb-16 pt-28 sm:pb-24 sm:pt-36" : "py-16 sm:py-24"
      }`}
    >
      <div
        className={`mx-auto max-w-2xl px-4 sm:px-6 ${
          align === "center" ? "text-center" : ""
        }`}
      >
        <SectionHeading
          as={as}
          align={align}
          size={size}
          eyebrow={eyebrow}
          lines={titleLines}
        />

        {imagePosition === "afterTitle" ? (
          <>
            {image}
            {text("mt-10")}
          </>
        ) : (
          <>
            {text("mt-6")}
            {image}
          </>
        )}

        {cta && (
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
        )}
      </div>
    </section>
  );
}
