import { NextResponse } from "next/server";
import { sql, hasDatabase } from "@/lib/db";
import { emailSuggestion } from "@/lib/notify";

/** Generous enough for a title and a sentence, tight enough to bound abuse. */
const MAX_TITLE = 200;
const MAX_NOTE = 1000;
const MAX_QUERY = 200;
const MAX_NAME = 120;

/**
 * Record a request for a song the hymnal doesn't have.
 *
 * Raised from the search screen's empty state — the moment someone has just
 * found the app lacking and knows exactly what they wanted. No account, and
 * nothing identifying is stored: just what they asked for and what they had
 * typed when they asked.
 */
export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "Suggestions are not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const { requester, title, note, query, hymnalId } = (body ?? {}) as Record<string, unknown>;

  const cleanTitle = typeof title === "string" ? title.trim().slice(0, MAX_TITLE) : "";
  if (!cleanTitle) {
    return NextResponse.json({ error: "A song title is required." }, { status: 400 });
  }

  const cleanNote = typeof note === "string" ? note.trim().slice(0, MAX_NOTE) || null : null;
  const cleanQuery = typeof query === "string" ? query.trim().slice(0, MAX_QUERY) || null : null;
  const cleanHymnal = typeof hymnalId === "string" ? hymnalId.trim().slice(0, 64) || null : null;
  const cleanName = typeof requester === "string" ? requester.trim().slice(0, MAX_NAME) || null : null;

  try {
    await sql!`
      INSERT INTO song_suggestions (requester, title, note, query, hymnal_id)
      VALUES (${cleanName}, ${cleanTitle}, ${cleanNote}, ${cleanQuery}, ${cleanHymnal})
    `;
  } catch {
    // The suggestion is a nicety; never surface a database error as a stack.
    return NextResponse.json({ error: "Could not save that just now." }, { status: 500 });
  }

  // Saved first, mailed second, and the mail is allowed to fail: the row is
  // the record, the email is only how it reaches someone. A bounced send must
  // not cost the suggestion or show the person an error.
  const emailed = await emailSuggestion({
    requester: cleanName,
    title: cleanTitle,
    note: cleanNote,
    query: cleanQuery,
    hymnalId: cleanHymnal,
  });

  return NextResponse.json({ ok: true, emailed }, { status: 201 });
}
