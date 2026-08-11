import Image from "next/image";
import { GoogleGIcon, StarIcon } from "./ui/Icons";
import { AvatarMarquee } from "./ui/AvatarMarquee";
import { media } from "@/config/media";
import { googleReviews, type Review } from "@/config/site";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <div className="flex gap-0.5" aria-label={`${full} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          width={22}
          height={22}
          className={i < full ? "text-[#e3b341]" : "text-white/15"}
        />
      ))}
    </div>
  );
}

function Avatar({ review }: { review: Review }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink ring-1 ring-white/10">
      {review.avatar ? (
        <Image
          src={review.avatar}
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-cover"
        />
      ) : (
        // Fallback to the brand monogram when a reviewer has no photo.
        <Image
          src={media.logo.monogram}
          alt=""
          width={24}
          height={18}
          className="h-4 w-auto opacity-90"
        />
      )}
    </span>
  );
}

export function Reviews({
  items = googleReviews.items,
}: {
  items?: Review[];
}) {
  return (
    <section id="reviews" className="bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="display-heading text-center text-3xl text-paper sm:text-4xl">
          {googleReviews.heading}
        </h2>
      </div>

      {/* Swipeable, snapping carousel. Next card peeks to signal more. */}
      <ul
        className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:gap-6 sm:px-6"
        aria-label="Customer reviews"
      >
        {items.map((review, i) => (
          <li
            key={`${review.author}-${i}`}
            className="flex min-h-[360px] w-[85%] max-w-sm shrink-0 snap-start flex-col rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/5 sm:w-[360px]"
          >
            <div className="flex items-start justify-between gap-4">
              <Stars rating={review.rating} />
              <GoogleGIcon width={24} height={24} className="shrink-0 text-paper" />
            </div>

            <p className="mt-4 line-clamp-[9] flex-1 text-paper/80">
              {review.text}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Avatar review={review} />
              <div>
                <div className="font-bold text-paper">{review.author}</div>
                <div className="text-sm text-paper-dim">{review.date}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Customer-dog avatars — swap placeholders for real photos later */}
      <AvatarMarquee className="mt-8" />

      <div className="mx-auto mt-8 flex max-w-6xl justify-center px-4 sm:px-6">
        <a
          href={googleReviews.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-white/25 px-8 text-paper transition-colors hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
        >
          <span>{googleReviews.cta}</span>
          <span className="text-lg font-bold tracking-tight">Google</span>
        </a>
      </div>
    </section>
  );
}
