import { Reveal } from "./Reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  /** Each string renders on its own line (for stacked display titles). */
  lines: string[];
  as?: "h1" | "h2";
  align?: "left" | "center";
  /** "md" for single-line section titles, "xl" for big stacked titles. */
  size?: "md" | "xl";
  className?: string;
};

const sizes = {
  md: "text-4xl sm:text-5xl",
  xl: "text-[clamp(2.25rem,10vw,4.25rem)]",
};

export function SectionHeading({
  eyebrow,
  lines,
  as = "h2",
  align = "left",
  size = "md",
  className = "",
}: SectionHeadingProps) {
  const Tag = as;
  return (
    <Reveal className={`${align === "center" ? "text-center" : ""} ${className}`}>
      {eyebrow && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          {eyebrow}
        </p>
      )}
      <Tag className={`display-heading text-paper ${sizes[size]}`}>
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </Tag>
    </Reveal>
  );
}
