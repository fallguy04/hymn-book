import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { emailSongForReview } from "@/lib/notify";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { guessMeter, parsePastedSong, toStanzas } from "@/lib/song-text";
import { approvedSongs, createSubmission, statusesOf } from "@/lib/submissions";

const MAX_TITLE = 120;
const MAX_WORDS = 8000;
const MAX_NAME = 120;
const MAX_STANZAS = 30;

/**
 * Songs added in the app.
 *
 * GET: every approved song, for every phone to fold into More Songs. With
 * `?mine=1001,1004`, also where those stand, so a phone can tell its own
 * additions apart from ones still waiting.
 *
 * POST: add one. The words are tidied the same way `npm run add-song` tidies
 * them, saved as pending, and mailed to the maintainer with a review link.
 */
export async function GET(request: Request) {
  if (!hasDatabase) return NextResponse.json({ songs: [], statuses: {} });

  const mine = (new URL(request.url).searchParams.get("mine") ?? "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger)
    .slice(0, 100);

  try {
    const [songs, statuses] = await Promise.all([approvedSongs(), statusesOf(mine)]);
    return NextResponse.json(
      { songs, statuses },
      // Approvals are rare; a minute's delay reaching everyone costs nothing.
      { headers: { "Cache-Control": mine.length ? "no-store" : "public, s-maxage=60, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("[songs] list failed:", (error as Error).message);
    return NextResponse.json({ error: "Could not load songs just now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Per address, and a whole congregation on the church Wi-Fi shares one.
  if (!rateLimit(clientKey(request, "add-song"), { limit: 10, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many songs from this connection for now. Try again in an hour." },
      { status: 429 },
    );
  }
  if (!hasDatabase) {
    return NextResponse.json({ error: "Adding songs isn't set up." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const title = text(body.title, MAX_TITLE);
  const words = text(body.words, MAX_WORDS);
  const author = text(body.author, MAX_NAME) || null;
  const requester = text(body.requester, MAX_NAME) || null;

  if (!title) return NextResponse.json({ error: "A song needs a title." }, { status: 400 });

  const { blocks } = parsePastedSong(words);
  if (!blocks.some((b) => !b.refrain)) {
    return NextResponse.json(
      { error: "Couldn't find the verses in that. Paste just the words of the song." },
      { status: 400 },
    );
  }
  const { stanzas, refrains } = toStanzas(blocks.slice(0, MAX_STANZAS));
  const meter = guessMeter(blocks);

  try {
    const { song, id, token } = await createSubmission({ title, author, meter, stanzas, refrains }, requester);
    const reviewUrl = `${new URL(request.url).origin}/review/${id}?t=${token}`;
    const emailed = await emailSongForReview(song, requester, reviewUrl);
    if (!emailed) console.warn("[songs] saved", id, "but the review email was not sent");
    return NextResponse.json({ song }, { status: 201 });
  } catch (error) {
    console.error("[songs] save failed:", (error as Error).message);
    return NextResponse.json({ error: "That didn't save. Try again in a minute." }, { status: 500 });
  }
}
