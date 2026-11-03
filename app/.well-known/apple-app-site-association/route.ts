/**
 * Apple's Universal Links file: which website links open the app on an
 * iPhone that has it. Apple fetches exactly this address (no ".json", no
 * redirect, JSON, 200). Needs APPLE_TEAM_ID (developer.apple.com →
 * Membership) on Vercel; until then it answers 404, which Apple reads as
 * "no links", and the emails' buttons open the /app-setup page instead,
 * whose "Open the App" button still gets them there.
 */
export const dynamic = "force-dynamic";

const BUNDLE_ID = "uk.co.nellyandnova.app";

export function GET() {
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!team) return new Response("Not found", { status: 404 });
  return Response.json(
    {
      applinks: {
        details: [{ appIDs: [`${team}.${BUNDLE_ID}`], components: [{ "/": "/app-setup", comment: "Set up account / reset password" }] }],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
