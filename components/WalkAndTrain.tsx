import { Reveal } from "./ui/Reveal";
import { Button } from "./ui/Button";
import { SectionBackground } from "./ui/SectionBackground";
import { CheckIcon } from "./ui/Icons";
import { media } from "@/config/media";

const SKILLS = [
  "Puppy training",
  "General obedience",
  "Adolescent dogs",
  "Loose lead walking",
  "Recall",
  "Heel work",
  "Confidence building",
  "Relaxation & settling",
  "Tricks & fun",
  "Relationship building",
];

export function WalkAndTrain() {
  return (
    <section
      id="walk-and-train"
      className="relative isolate overflow-hidden py-20 sm:py-28"
    >
      <SectionBackground src={media.walkAndTrain.background} parallax={70} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Our signature service
            </p>
            <h2 className="display-heading text-4xl text-paper sm:text-6xl">
              Walk &amp; Train
            </h2>
          </Reveal>

          <Reveal delay={0.05}>
            <p className="mt-6 text-lg text-paper/85">
              Full-day pickup training where your dog learns in carefully set-up
              environments and socialises around real-world distractions. Every
              session ends with a report card and homework, so the progress
              keeps going at home.
            </p>
          </Reveal>
        </div>

        {/* Scannable skills list */}
        <Reveal delay={0.1}>
          <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-2">
            {SKILLS.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 text-paper/90 ring-1 ring-white/10 backdrop-blur-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CheckIcon width={16} height={16} />
                </span>
                <span className="font-medium">{skill}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button href="#book" size="lg">
              Book a Walk &amp; Train
            </Button>
            <Button href="#book" variant="secondary" size="lg">
              How does it work?
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
