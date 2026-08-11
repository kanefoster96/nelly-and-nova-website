import Link from "next/link";
import { Fragment } from "react";

/**
 * Renders plain text with inline link tokens of the form `[[label|href]]`.
 * Everything outside the tokens is rendered as-is.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[\[(.+?)\|(.+?)\]\]$/);
        if (m) {
          return (
            <Link
              key={i}
              href={m[2]}
              className="text-paper underline underline-offset-2 transition-colors hover:text-accent"
            >
              {m[1]}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
