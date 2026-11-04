import QRCode from "qrcode";

/**
 * A QR code, as SVG, for one of our own pages: GET /api/qr?data=<url>.
 * The app's "Invite to the app" (onboarding page) shows it at the meet &
 * greet, pointing at /app. Only https links to this site's own hosts are
 * drawn, so it can't be used as an open QR generator (or to dress up
 * someone else's link as ours). Black on white with a quiet margin, which
 * every phone camera reads.
 */
const OWN_HOSTS = new Set(["nellyandnova.co.uk", "www.nellyandnova.co.uk", "nelly-and-nova-website.vercel.app"]);
const MAX_LENGTH = 300;

function allowed(data: string, request: Request): boolean {
  if (!data || data.length > MAX_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(data);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const hosts = new Set(OWN_HOSTS);
  for (const origin of [process.env.NEXT_PUBLIC_SITE_URL, request.url]) {
    try {
      if (origin) hosts.add(new URL(origin).host);
    } catch {
      // not a URL: ignore
    }
  }
  const local = url.hostname === "localhost" && process.env.NODE_ENV !== "production";
  return (url.protocol === "https:" || local) && hosts.has(url.host);
}

export async function GET(request: Request) {
  const data = new URL(request.url).searchParams.get("data") ?? "";
  if (!allowed(data, request)) {
    return new Response("Only links to this website can be made into a QR code.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const svg = await QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#0a0a0aff", light: "#ffffffff" },
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
