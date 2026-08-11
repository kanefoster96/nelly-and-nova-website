import Image from "next/image";
import { Reveal } from "./ui/Reveal";
import { media } from "@/config/media";
import { leaveWhenReady } from "@/config/site";

export function LeaveWhenReady() {
  return (
    <section id="leave-when-ready" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="display-heading text-3xl text-paper sm:text-4xl">
            {leaveWhenReady.heading}
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <p className="mt-6 text-paper/75">{leaveWhenReady.intro}</p>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-6 font-bold text-paper">{leaveWhenReady.emphasis}</p>
        </Reveal>

        {/* Photo card with a frosted caption bar */}
        <Reveal delay={0.15}>
          <figure className="relative mt-10 overflow-hidden rounded-3xl ring-1 ring-white/10">
            <div className="relative aspect-[4/3]">
              <Image
                src={media.leaveWhenReady.image}
                alt="A dog carrying its lead, ready to train"
                fill
                sizes="(min-width: 768px) 42rem, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="absolute inset-x-4 bottom-4">
              <div className="rounded-2xl border border-white/15 bg-black/40 px-5 py-4 backdrop-blur-md">
                <p className="text-sm text-paper/90">{leaveWhenReady.caption}</p>
              </div>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
