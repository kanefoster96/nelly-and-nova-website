/**
 * A safe "come back here afterwards" path from ?next=. Only paths on this
 * site (starting with a single "/") are allowed, so a link can't send
 * someone off to another website after logging in.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
