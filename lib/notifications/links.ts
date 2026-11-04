/**
 * Where a notification goes when tapped. Rows store an app path (the app
 * opens it as-is: "/chat", "/schedule"…); the website opens its own page for
 * the same thing.
 */
const WEBSITE_FOR_APP: [prefix: string, website: string][] = [
  ["/chat", "/messages"],
  ["/conversation", "/messages"],
  ["/notifications", "/messages"],
  ["/schedule", "/profile/sessions"],
  ["/homework", "/profile/practice"],
  ["/community", "/community"],
  ["/profile", "/profile"],
  // The owner's Profile tab in the app (pick-up and drop-off notices).
  ["/dog", "/profile"],
];

export function websiteHref(actionHref: string | null | undefined): string | undefined {
  if (!actionHref || !actionHref.startsWith("/") || actionHref.startsWith("//")) return undefined;
  const path = actionHref.split(/[?#]/)[0];
  // A trainer's page for one dog, and the owner's own dog pages in the app.
  const dog = /^\/dog\/([0-9a-f-]{36})$/i.exec(path);
  if (dog) return `/admin/dogs/${dog[1]}`;
  const myDog = /^\/my-dogs\/([0-9a-f-]{36})$/i.exec(path);
  if (myDog) return `/profile/dogs/${myDog[1]}`;
  if (path === "/register" || path.startsWith("/register/")) return "/waiver";
  if (path === "/my-info") return "/profile/account/edit";
  for (const [prefix, website] of WEBSITE_FOR_APP) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return website;
  }
  return actionHref;
}

/** "Tapping it opens" choices on Send a notification (app paths). */
export const NOTIFICATION_LINKS: { value: string; label: string }[] = [
  { value: "", label: "Nothing — just the notification" },
  { value: "/schedule", label: "Their schedule" },
  { value: "/homework", label: "Homework" },
  { value: "/community", label: "Community" },
  { value: "/chat", label: "Chat" },
  { value: "/profile", label: "Their profile" },
];

export const TITLE_MAX = 60;
export const BODY_MAX = 500;

/** A title must start with one emoji: "🐾 Closed on Friday". */
const TITLE_EMOJI = /^\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*\s+\S/u;
const ANY_EMOJI = /\p{Extended_Pictographic}/gu;

export function checkNotification(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t || !b) return "Add a title and a message.";
  if (!TITLE_EMOJI.test(t)) return "Start the title with one emoji, e.g. “🐾 Closed on Friday”.";
  if ((t.match(ANY_EMOJI) ?? []).length > 1) return "Just the one emoji, at the start of the title.";
  if (t.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (b.length > BODY_MAX) return `Keep the message under ${BODY_MAX} characters.`;
  if (/\p{Extended_Pictographic}/u.test(b)) return "Keep emojis out of the message — the title's emoji is enough.";
  return null;
}

/** Quick picks for the title's emoji. */
export const NOTIFICATION_EMOJIS = ["🐾", "📅", "🚫", "☀\uFE0F", "🌧\uFE0F", "🎉", "📝", "⏰", "🏠", "❤\uFE0F"];

/** A row from `notifications` (the columns the lists read). */
export type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  action_href: string | null;
  sent_by_name: string | null;
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_COLUMNS = "id, recipient_id, kind, title, body, action_href, sent_by_name, read_at, created_at";

const LEADING_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s+/u;

/**
 * Written with the emoji on the title ("📅 Your meet & greet is booked") and
 * shown the way Kanvas's list does: a plain title, the emoji leading the
 * line under it.
 */
export function emojiOnBody<T extends { title: string; body: string }>(n: T): T {
  const match = LEADING_EMOJI.exec(n.title);
  if (!match) return n;
  return { ...n, title: n.title.slice(match[0].length), body: n.body ? `${match[1]} ${n.body}` : match[1] };
}

export function toNotification(r: NotificationRow) {
  return emojiOnBody({
    id: r.id,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    actionHref: websiteHref(r.action_href),
    sentByName: r.sent_by_name ?? "Nelly & Nova",
    recipientId: r.recipient_id,
    readAt: r.read_at,
  });
}
