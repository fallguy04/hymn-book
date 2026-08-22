import { NextResponse } from "next/server";
import { sql, hasDatabase } from "@/lib/db";
import {
  CODE_TTL_HOURS,
  generateCode,
  isCode,
  normalizeCode,
  sanitizePayload,
} from "@/lib/sync";

/**
 * Sync codes: POST puts this device's data behind a fresh code, GET fetches it
 * back on another device.
 *
 * Not an account system and not trying to be one. A code is a claim ticket for
 * a small blob of preferences that expires within the day.
 */

/** A handful of tries to generate an unused code; collisions are vanishingly rare. */
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const payload = sanitizePayload(body);
  if (!payload) {
    return NextResponse.json({ error: "Nothing to sync." }, { status: 400 });
  }

  try {
    // Sweep on write rather than on a schedule: it costs one statement, and it
    // means expired rows never accumulate without a cron job nobody set up.
    await sql!`DELETE FROM sync_codes WHERE expires_at < now()`;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = generateCode();
      const inserted = await sql!`
        INSERT INTO sync_codes (code, payload, expires_at)
        VALUES (${code}, ${JSON.stringify(payload)}, now() + make_interval(hours => ${CODE_TTL_HOURS}))
        ON CONFLICT (code) DO NOTHING
        RETURNING code
      `;
      if (inserted.length) {
        return NextResponse.json({ code, expiresInHours: CODE_TTL_HOURS }, { status: 201 });
      }
    }
    return NextResponse.json({ error: "Could not make a code. Try again." }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "Could not save that just now." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 503 });
  }

  const code = normalizeCode(new URL(request.url).searchParams.get("code") ?? "");
  if (!isCode(code)) {
    return NextResponse.json({ error: "That code doesn't look right." }, { status: 400 });
  }

  try {
    const rows = await sql!`
      SELECT payload FROM sync_codes WHERE code = ${code} AND expires_at > now()
    `;
    if (!rows.length) {
      // One message for "never existed" and "expired": the difference isn't
      // useful to the person typing, and both mean "ask for a new code".
      return NextResponse.json({ error: "No such code — it may have expired." }, { status: 404 });
    }
    // Re-sanitized on the way out too. It was clean going in, but this data
    // gets written straight into the store, and the check is nearly free.
    return NextResponse.json({ payload: sanitizePayload(rows[0].payload) });
  } catch {
    return NextResponse.json({ error: "Could not read that just now." }, { status: 500 });
  }
}
