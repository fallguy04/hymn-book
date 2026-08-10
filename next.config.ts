import type { NextConfig } from "next";

/**
 * A stable identifier for this build, used to version the service worker's
 * caches. Without it the cache name never changes, old caches are never
 * purged, and a returning visitor can be pinned to a stale build forever.
 *
 * Vercel supplies the commit SHA; local builds fall back to the clock.
 */
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  reactCompiler: true,
  generateBuildId: () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
