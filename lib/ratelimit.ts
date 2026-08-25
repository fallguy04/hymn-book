/**
 * A small in-memory rate limit for the two endpoints that write.
 *
 * Both are unauthenticated by design — there are no accounts and there should
 * not be. But each one costs the owner something real per call: a suggestion
 * writes a row *and* sends an email against a 100/day quota, and a sync code
 * writes up to a quarter-megabyte of JSON that lives for a day. A few seconds
 * of scripting could fill the database or flood an inbox, and both failures
 * take the other feature down with them.
 *
 * Deliberately not Redis. This is one congregation; the traffic is a handful of
 * requests a week. A per-instance map costs nothing, needs no service, and
 * turns "a few seconds of scripting" into "hours of it" — which is all that is
 * needed here. Serverless means several instances and a cold start clears the
 * counters, so treat this as a speed bump, not a wall.
 */

type Hit = { count: number; resets: number };

const buckets = new Map<string, Hit>();

/** Keep the map from growing without bound on a long-lived instance. */
const SWEEP_AT = 5000;

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Vercel sets x-forwarded-for; the first entry is the client. Falls back to a
 * single shared bucket, which fails closed-ish rather than open.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(key: string, { limit, windowMs }: RateLimit): boolean {
  const now = Date.now();

  if (buckets.size > SWEEP_AT) {
    for (const [k, hit] of buckets) if (hit.resets <= now) buckets.delete(k);
  }

  const hit = buckets.get(key);
  if (!hit || hit.resets <= now) {
    buckets.set(key, { count: 1, resets: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}
