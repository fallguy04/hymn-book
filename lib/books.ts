import { type Hymn, type Hymnal, isNumbered, lineText } from "./hymnals";
import { COMMUNITY_FROM } from "./community";

/**
 * How books and hymns are named on screen — in one place.
 *
 * The audit found the same book called five things in five files ("Hymnal",
 * "A Collection of Hymns", "the hymnal", "OTHER", "Hymn N"), and a hymn named
 * by its editor's label in one place and its first line in another. Every
 * component asks here instead, so renaming a book is one line.
 */

/** The longest number anyone can call out. The collection stops at 558. */
export const MAX_DIGITS = 3;

/** What people call the book out loud. */
export const bookName = (book: Hymnal): string => (isNumbered(book) ? "Hymnal" : book.shortName);

/** "hymn" in the collection, "song" in the book of everything else. */
export const itemNoun = (book: Hymnal): "hymn" | "song" => (isNumbered(book) ? "hymn" : "song");

export const countLabel = (count: number, book: Hymnal): string =>
  `${count} ${itemNoun(book)}${count === 1 ? "" : "s"}`;

/**
 * One sentence that says what the book is. The second book's name alone never
 * explained it — "Other" read as leftovers, and nothing on a phone said these
 * are the songs the congregation sings that the printed book doesn't carry.
 */
const BLURBS: Record<string, string> = {
  brethren: "The Old German Baptist Brethren Church hymnbook, 32nd edition, as published.",
  "other-songs": "Songs we sing that aren't in the printed hymnal, like Amazing Grace and It Is Well.",
};
export const bookBlurb = (book: Hymnal): string => BLURBS[book.id] ?? book.subtitle;

/** The editor's label without its closing full stop: "Eternity of God". */
const cleanLabel = (title: string): string => title.trim().replace(/\.$/, "");

/**
 * A first line as people say it. The book sets the opening word in capitals
 * ("THROUGH endless years…"), which reads as shouting in a list, and most
 * lines end mid-clause on a comma.
 */
export function spokenFirstLine(hymn: Hymn): string {
  const raw = lineText(hymn.stanzas[0]?.[0] ?? "");
  const tamed = raw.replace(/^([^a-z]*?)([A-Z])([A-Z’'-]+)(?=[\s,.;:!?]|$)/, (_, lead, first, rest) =>
    `${lead}${first}${rest.toLowerCase()}`,
  );
  return tamed.replace(/[,;:\s]+$/, "");
}

/**
 * The name to lead with in any list, preview or result.
 *
 * In the collection that is the first line: the printed titles are topical
 * labels ("Desiring to praise worthily."), and 131 of them are scripture
 * references, while everyone knows hymn 84 as "Come thou fount". The other
 * book's titles are the names people actually use.
 */
export function primaryName(book: Hymnal, hymn: Hymn): string {
  if (!isNumbered(book)) return hymn.title || spokenFirstLine(hymn);
  return spokenFirstLine(hymn) || cleanLabel(hymn.title) || `Hymn ${hymn.number}`;
}

/** The label under it, where there is one worth showing. */
export function secondaryName(book: Hymnal, hymn: Hymn): string | null {
  if (!isNumbered(book) || !hymn.title) return null;
  return cleanLabel(hymn.title);
}

/** How a hymn is announced: "Hymn 245" in the collection, its title elsewhere. */
export function hymnHeading(book: Hymnal, hymn: Hymn): string {
  return isNumbered(book) ? `Hymn ${hymn.number}` : primaryName(book, hymn);
}

/**
 * Each book's address. "/hymn/245" is what someone types, reads aloud, and
 * sees in a message preview; the old "/?h=245&b=other-songs" was none of
 * those. A book with no route here still gets a working link by query.
 */
export const ROUTES: Record<string, "hymn" | "song"> = { brethren: "hymn", "other-songs": "song" };

export function hymnPath(book: Hymnal, number: number): string {
  // Songs added in the app have no page built for them, so they're linked by
  // query, which the app reads once it has loaded them.
  const segment = number < COMMUNITY_FROM ? ROUTES[book.id] : undefined;
  return segment ? `/${segment}/${number}` : `/?h=${number}&b=${encodeURIComponent(book.id)}`;
}

/** The reverse of `hymnPath`, for the path a page was opened at. */
export function parseHymnPath(pathname: string): { hymnalId: string; number: number } | null {
  const match = pathname.match(/^\/(hymn|song)\/(\d{1,4})\/?$/);
  if (!match) return null;
  const hymnalId = Object.keys(ROUTES).find((id) => ROUTES[id] === match[1]);
  return hymnalId ? { hymnalId, number: Number(match[2]) } : null;
}
