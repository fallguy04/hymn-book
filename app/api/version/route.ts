/**
 * Which build is actually deployed right now.
 *
 * An installed PWA can go a very long time without a navigation: Android keeps
 * the page frozen in the app switcher and resumes it rather than reloading, so
 * the app can sit on a build from weeks ago with nothing on screen suggesting
 * anything is wrong. Nothing on the client can detect that on its own — the
 * page only knows the build it was served as — so it asks.
 *
 * The service worker leaves /api/ alone precisely so this answer is never the
 * cached one, which would defeat the whole point.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
