/**
 * Community avatar — the image if present, else the initial on a tinted circle.
 * Reused by the composer, posts and comments.
 */
export function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  if (avatarUrl) {
    return (
      <div className={`${dimension} shrink-0 overflow-hidden rounded-full`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-paper`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
