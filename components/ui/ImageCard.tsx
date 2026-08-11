import Image from "next/image";

type ImageCardProps = {
  src: string;
  alt: string;
  /** Tailwind aspect utility, e.g. "aspect-[4/3]". */
  aspect?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

/** Rounded, ring-bordered image in a fixed aspect box (object-cover). */
export function ImageCard({
  src,
  alt,
  aspect = "aspect-[4/3]",
  priority = false,
  className = "",
  sizes = "(min-width: 768px) 42rem, 100vw",
}: ImageCardProps) {
  return (
    <figure
      className={`relative overflow-hidden rounded-3xl bg-ink-raised ring-1 ring-white/10 ${className}`}
    >
      <div className={`relative ${aspect}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    </figure>
  );
}
