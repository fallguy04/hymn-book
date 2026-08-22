import data from "@/data/pending-songs.json";

/**
 * Songs the congregation sings that the app cannot print the words to.
 *
 * A title is a fact and carries no copyright, so listing one costs nothing and
 * is unambiguously legal. That is worth doing on its own: the question people
 * actually ask mid-service is "what number is that?", and an answer of "we know
 * that song, here is who wrote it, we can't show the words yet" is far better
 * than a search that comes back empty and implies the song doesn't exist.
 *
 * These deliberately are NOT part of any hymnal. Folding fifty-odd wordless
 * entries into Other Songs would put them in the page-through and the contents
 * list, so swiping through the book mid-service would keep landing on pages
 * with nothing to sing. They surface in search, where someone is asking a
 * question, and nowhere else.
 */
export interface PendingSong {
  title: string;
  author?: string;
  year?: number;
  /** "copyright" — known and still protected. "unknown" — nobody has identified it. */
  status: "copyright" | "unknown";
  /** Where the congregation knows it from, when that's worth saying. */
  found?: string;
}

const SONGS: PendingSong[] = (data.songs as PendingSong[])
  .slice()
  .sort((a, b) => a.title.localeCompare(b.title));

export const listPending = (): PendingSong[] => SONGS;

export const pendingCount = (): number => SONGS.length;

/** Why this one has no words, in a sentence the congregation can act on. */
export function pendingReason(song: PendingSong): string {
  if (song.status === "unknown") {
    return "We haven't identified who wrote this, so we can't tell whether we may print it. If you know, please say.";
  }
  const who = song.author ? `${song.author}${song.year ? `, ${song.year}` : ""}` : "its publisher";
  return `Still in copyright (${who}). We've asked for permission to print the words.`;
}

/**
 * Title and author only. Searching the words would be pointless — there are no
 * words here — so a match is on the name of the song or who wrote it.
 */
export function searchPending(query: string, limit = 8): PendingSong[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  const scored: { song: PendingSong; score: number }[] = [];
  for (const song of SONGS) {
    const title = song.title.toLowerCase();
    let score = -1;
    if (title === term) score = 0;
    else if (title.startsWith(term)) score = 1;
    else if (title.includes(term)) score = 2;
    else if (song.author?.toLowerCase().includes(term)) score = 3;
    if (score >= 0) scored.push({ song, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.song.title.localeCompare(b.song.title))
    .slice(0, limit)
    .map(({ song }) => song);
}
