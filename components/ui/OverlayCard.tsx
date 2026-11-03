import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "./Icons";

/**
 * The site's card: a full-bleed photo with the words laid over it.
 * ----------------------------------------------------------------
 * Small spaced-out label → big bold title → a line or two of text → an
 * optional "Learn more →" link, sitting on a dark fade at the bottom of the
 * photo, with a faint number in the top corner. On hover the photo eases in
 * and the arrow nudges along, so the whole card feels tappable.
 *
 * Pass `href` to make the whole card a link. Use it for any set of cards on
 * the site (services, "We understand", page sections…).
 */
export function OverlayCard({
  image,
  alt = "",
  eyebrow,
  title,
  body,
  cta,
  href,
  index,
  className = "",
  sizes = "(min-width: 768px) 42rem, 100vw",
}: {
  image: string;
  alt?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  /** Link text, e.g. "Learn more". Shown with an arrow. */
  cta?: string;
  href?: string;
  /** 1-based position, shown as a faint "01" in the corner. */
  index?: number;
  className?: string;
  sizes?: string;
}) {
  const content = (
    <>
      <Image
        src={image}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
      />
      {/* Dark at the bottom where the words sit, the photo showing through above. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,10,10,0.94) 0%, rgba(10,10,10,0.72) 38%, rgba(10,10,10,0.25) 72%, rgba(10,10,10,0.35) 100%)",
        }}
      />

      {index !== undefined && (
        <span
          aria-hidden="true"
          className="display-heading absolute right-5 top-4 text-6xl leading-none text-white/10 sm:text-7xl"
        >
          {String(index).padStart(2, "0")}
        </span>
      )}

      <div className="relative mt-auto px-6 pb-7 pt-24 sm:px-8 sm:pb-8">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/70">{eyebrow}</p>
        )}
        <h3 className="display-heading mt-2 text-3xl uppercase leading-none text-paper sm:text-4xl">{title}</h3>
        {body && <p className="mt-4 max-w-md text-paper/70">{body}</p>}
        {cta && (
          <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-paper">
            {cta}
            <ArrowRightIcon
              width={16}
              height={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
        )}
      </div>
    </>
  );

  const classes = `group relative isolate flex min-h-[24rem] flex-col overflow-hidden rounded-3xl bg-ink-raised ring-1 ring-white/10 sm:min-h-[26rem] ${className}`;

  return href ? (
    <Link href={href} className={`${classes} focus-visible:outline-2 focus-visible:outline-offset-4`}>
      {content}
    </Link>
  ) : (
    <article className={classes}>{content}</article>
  );
}
