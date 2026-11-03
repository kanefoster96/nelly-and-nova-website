// Links inside chat messages, ported from the Kanvas Academy chat. A
// trainer's message can carry a link written as [text](https://…) or pasted
// on its own (https://…, www.…), shown as a tappable link. Only trainers'
// messages get links; a member's message is always plain text, so nobody
// can dress up an address as something it isn't in the trainer inbox.

export type ChatBodyPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?'")\]]+$/;

function splitBareUrls(text: string): ChatBodyPart[] {
  const parts: ChatBodyPart[] = [];
  let last = 0;
  for (const match of text.matchAll(BARE_URL_RE)) {
    const index = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION_RE, "");
    if (!url) continue;
    if (index > last) parts.push({ type: "text", text: text.slice(last, index) });
    parts.push({ type: "link", text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = index + url.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

export function parseChatBody(body: string): ChatBodyPart[] {
  const parts: ChatBodyPart[] = [];
  let last = 0;
  for (const match of body.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(...splitBareUrls(body.slice(last, index)));
    parts.push({ type: "link", text: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < body.length) parts.push(...splitBareUrls(body.slice(last)));
  return parts;
}
